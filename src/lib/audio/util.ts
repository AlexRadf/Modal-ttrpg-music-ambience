export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

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
