import { synthBed, synthMusicLayer, type MusicSpec } from "./synth";

/**
 * Fetches and decodes audio, with one shared promise per URL so a bed used by
 * three themes is still only downloaded once. When a source has no URL — or the
 * fetch fails — it falls back to the synthesiser, which is what makes the
 * console usable before any audio has been produced.
 */
export class AssetLoader {
  private cache = new Map<string, Promise<AudioBuffer>>();
  private inflight = 0;

  constructor(
    private ctx: AudioContext,
    private opts: { synthFallback: boolean; onError?: (message: string) => void; onBusy?: (busy: boolean) => void }
  ) {}

  get busy(): boolean {
    return this.inflight > 0;
  }

  bed(bedId: string, src: string | null): Promise<AudioBuffer> {
    return this.get(src ?? "synth:bed:" + bedId, src, () => synthBed(this.ctx.sampleRate, bedId));
  }

  music(spec: MusicSpec, src: string | null): Promise<AudioBuffer> {
    const key = src ?? `synth:music:${spec.themeId}:${spec.variantId}:${spec.mode}:${spec.layer}`;
    return this.get(key, src, () => synthMusicLayer(this.ctx.sampleRate, spec));
  }

  private get(key: string, src: string | null, fallback: () => Promise<AudioBuffer>): Promise<AudioBuffer> {
    const hit = this.cache.get(key);
    if (hit) return hit;

    const task = this.track(async () => {
      if (src) {
        try {
          const res = await fetch(src);
          if (!res.ok) throw new Error(res.status + " " + res.statusText);
          return await this.ctx.decodeAudioData(await res.arrayBuffer());
        } catch (err) {
          const message = `${src}: ${err instanceof Error ? err.message : String(err)}`;
          this.opts.onError?.(message);
          if (!this.opts.synthFallback) throw err;
        }
      }
      if (!this.opts.synthFallback) throw new Error("no source for " + key);
      return fallback();
    });

    // a failed load should not be cached forever
    task.catch(() => this.cache.delete(key));
    this.cache.set(key, task);
    return task;
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
