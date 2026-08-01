/**
 * Fetches and decodes audio from the server, with one shared promise per URL so
 * a bed used by three themes is only downloaded once.
 *
 * There is no fallback: if a file is missing or will not decode, the load fails
 * and the caller reports it. A failed URL is dropped from the cache so the next
 * attempt retries rather than replaying the failure.
 */
export interface LoadFailure {
  url: string;
  message: string;
}

export class AssetLoader {
  private cache = new Map<string, Promise<AudioBuffer>>();
  private inflight = 0;

  constructor(
    private ctx: AudioContext,
    private opts: {
      fetchInit?: RequestInit;
      onError?: (failure: LoadFailure) => void;
      onBusy?: (busy: boolean) => void;
    }
  ) {}

  get busy(): boolean {
    return this.inflight > 0;
  }

  /** Resolves to the decoded buffer, or rejects with a described failure. */
  load(url: string): Promise<AudioBuffer> {
    const hit = this.cache.get(url);
    if (hit) return hit;

    const task = this.track(async () => {
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
        // decodeAudioData rejects with a bare DOMException in most browsers
        throw this.fail(url, "could not decode" + (err instanceof Error && err.message ? ": " + err.message : ""));
      }
    });

    task.catch(() => this.cache.delete(url));
    this.cache.set(url, task);
    return task;
  }

  /** Warms the cache without touching the graph. Failures are reported, not thrown. */
  async prefetch(urls: string[]): Promise<void> {
    await Promise.allSettled(urls.map((url) => this.load(url)));
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
