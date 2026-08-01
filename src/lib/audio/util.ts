export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Fisher-Yates. `avoidFirstId` keeps a reshuffle from opening with the motif
 * that just played, which is the one repeat a listener always notices.
 */
export function shuffle<T extends { id: string }>(items: T[], avoidFirstId?: string): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (avoidFirstId && out.length > 1 && out[0].id === avoidFirstId) {
    const swap = 1 + Math.floor(Math.random() * (out.length - 1));
    [out[0], out[swap]] = [out[swap], out[0]];
  }
  return out;
}

/**
 * Ramps a param without the clicks a bare setValue causes. Uses a linear ramp
 * from wherever the param actually is now, which keeps interrupted fades smooth.
 */
export function ramp(param: AudioParam, value: number, seconds: number, ctx: BaseAudioContext) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  if (seconds <= 0) param.setValueAtTime(value, now);
  else param.linearRampToValueAtTime(value, now + seconds);
}
