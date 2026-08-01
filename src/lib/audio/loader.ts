/**
 * Fetches and decodes audio from the server, with one shared promise per URL so
 * a bed used by three scenes is only downloaded once.
 *
 * Decoded audio is uncompressed — a 45 s stereo stem at 44.1 kHz occupies about
 * 16 MB no matter how small the .ogg was — so the cache is bounded by bytes, not
 * by entry count. Buffers in use are pinned; everything else is evicted least
 * recently used first once the budget is passed.
 *
 * There is no fallback: if a file is missing or will not decode, the load fails
 * and the caller reports it. A failed URL is dropped so the next attempt retries.
 */
export interface LoadFailure {
  url: string;
  message: string;
}

interface Entry {
  promise: Promise<AudioBuffer>;
  buffer: AudioBuffer | null;
  bytes: number;
  used: number;
  pins: number;
}

const bytesOf = (b: AudioBuffer) => b.length * b.numberOfChannels * 4;

export class AssetLoader {
  private entries = new Map<string, Entry>();
  private inflight = 0;
  private clock = 0;

  constructor(
    private ctx: AudioContext,
    private opts: {
      maxDecodedBytes: number;
      fetchInit?: RequestInit;
      onError?: (failure: LoadFailure) => void;
      onBusy?: (busy: boolean) => void;
      onFootprint?: (bytes: number) => void;
    }
  ) {}

  get busy(): boolean {
    return this.inflight > 0;
  }

  /** Decoded bytes currently held. */
  get footprint(): number {
    let total = 0;
    for (const [, e] of this.entries) total += e.bytes;
    return total;
  }

  /** True if the buffer is already decoded and can be played without waiting. */
  ready(url: string): boolean {
    return !!this.entries.get(url)?.buffer;
  }

  /** Resolves to the decoded buffer, or rejects with a described failure. */
  load(url: string): Promise<AudioBuffer> {
    const hit = this.entries.get(url);
    if (hit) {
      hit.used = ++this.clock;
      return hit.promise;
    }

    const entry: Entry = { promise: null as never, buffer: null, bytes: 0, used: ++this.clock, pins: 0 };
    entry.promise = this.track(async () => {
      const buffer = await this.fetchAndDecode(url);
      entry.buffer = buffer;
      entry.bytes = bytesOf(buffer);
      this.evict();
      return buffer;
    });

    entry.promise.catch(() => this.entries.delete(url));
    this.entries.set(url, entry);
    return entry.promise;
  }

  /**
   * Keeps a buffer resident while it is sounding. Every `pin` needs an
   * `unpin`, or the cache slowly fills with audio nothing is playing.
   */
  pin(url: string) {
    const entry = this.entries.get(url);
    if (entry) {
      entry.pins++;
      entry.used = ++this.clock;
    }
  }

  unpin(url: string) {
    const entry = this.entries.get(url);
    if (entry && entry.pins > 0) entry.pins--;
  }

  /** Warms the cache without touching the graph. Failures are reported, not thrown. */
  async prefetch(urls: string[]): Promise<void> {
    await Promise.allSettled(urls.map((url) => this.load(url)));
  }

  /** Drops everything unpinned — used when the scene changes. */
  releaseUnpinned() {
    for (const [url, entry] of this.entries) {
      if (entry.pins === 0 && entry.buffer) this.entries.delete(url);
    }
    this.opts.onFootprint?.(this.footprint);
  }

  private evict() {
    let total = this.footprint;
    if (total <= this.opts.maxDecodedBytes) {
      this.opts.onFootprint?.(total);
      return;
    }

    const candidates = [...this.entries]
      .filter(([, e]) => e.pins === 0 && e.buffer)
      .sort((a, b) => a[1].used - b[1].used);

    for (const [url, entry] of candidates) {
      if (total <= this.opts.maxDecodedBytes) break;
      this.entries.delete(url);
      total -= entry.bytes;
    }
    this.opts.onFootprint?.(total);
  }

  private async fetchAndDecode(url: string): Promise<AudioBuffer> {
    let res: Response;
    try {
      res = await fetch(url, this.opts.fetchInit);
    } catch (err) {
      throw this.fail(url, err instanceof Error ? err.message : String(err));
    }
    if (!res.ok) throw this.fail(url, res.status + " " + res.statusText);

    // a server with an SPA fallback answers 200 with index.html for a missing
    // file, which otherwise surfaces as a baffling decode error
    const type = res.headers.get("content-type") || "";
    if (/^text\/|html|json/i.test(type)) throw this.fail(url, `expected audio, server sent ${type}`);

    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0) throw this.fail(url, "empty response");

    try {
      return await this.ctx.decodeAudioData(bytes);
    } catch (err) {
      throw this.fail(url, "could not decode" + (err instanceof Error && err.message ? ": " + err.message : ""));
    }
  }

  private fail(url: string, message: string): Error {
    this.opts.onError?.({ url, message });
    return new Error(url + ": " + message);
  }

  private async track<T>(fn: () => Promise<T>): Promise<T> {
    this.inflight++;
    this.opts.onBusy?.(true);
    try {
      return await fn();
    } finally {
      this.inflight--;
      if (this.inflight === 0) this.opts.onBusy?.(false);
    }
  }
}
