/**
 * CM0102 packed “long” encoding for club **cash** (CM0102Patcher ConvertLongToCM2Format).
 * Some saves store plain int32 pounds instead — we detect and preserve that on write.
 */

/** Decode packed CM2 long → normal units (thousands for cash before ×1000). */
export function cm2LongToNormal(raw: number): number {
  const v = Math.trunc(raw)
  return ((v & 0xff00) >> 8) * 16384 + ((v & 0xff0000) >> 16) * 128 + ((v & 0xff000000) >>> 24)
}

/** Encode normal units → packed CM2 long. */
export function cm2LongFromNormal(normal: number): number {
  let val = Math.max(0, Math.trunc(normal))
  const v3 = Math.floor(val / 16384)
  val -= v3 * 16384
  const v2 = Math.floor(val / 128)
  val -= v2 * 128
  return (v3 << 8) | (v2 << 16) | (val << 24)
}

/** Read int32 from club/stadium row and return display value (e.g. pounds). */
export function cm2LongDiskToDisplay(raw: number, displayScale: number): number {
  return cm2LongToNormal(raw) * displayScale
}

/** Display value (e.g. pounds) → int32 to write on disk. */
export function cm2LongDisplayToDisk(display: number, displayScale: number): number {
  const normal = Math.max(0, Math.trunc(display)) / displayScale
  return cm2LongFromNormal(normal)
}

/** True when raw int32 already looks like plain pounds, not packed cash. */
export function cashLooksPlainOnDisk(raw: number): boolean {
  if (raw < 0 || raw > 2_000_000_000) return false
  // Packed bytes decode to modest “normal” units; plain millions blow up cm2LongToNormal.
  return cm2LongToNormal(raw) > 200_000
}

/** Bank balance in pounds for UI / filters. */
export function readCashDisplay(raw: number): number {
  if (cashLooksPlainOnDisk(raw)) return raw
  return cm2LongDiskToDisplay(raw, 1000)
}

/** Write pounds using the same representation as before (plain or packed). */
export function writeCashDisplay(pounds: number, priorRaw: number): number {
  const p = Math.max(0, Math.trunc(pounds))
  if (cashLooksPlainOnDisk(priorRaw)) return Math.min(2_000_000_000, p)
  return cm2LongDisplayToDisk(p, 1000)
}
