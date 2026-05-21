/**
 * CM0102 packed “long” encoding for club **cash** (CM0102Patcher ConvertLongToCM2Format).
 * On disk: packed int32; in-game pounds = decode(raw) × 1000.
 *
 * Vanilla CM0102 / normal saves use packed cash. A few tools write plain int32 pounds;
 * we only treat those as plain when packed decode is clearly nonsense.
 */

const CASH_DISPLAY_SCALE = 1000
const MAX_CASH_POUNDS = 2_000_000_000

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

/** Read int32 from club row and return pounds. */
export function cm2LongDiskToDisplay(raw: number, displayScale: number): number {
  return cm2LongToNormal(raw) * displayScale
}

/** Pounds → packed int32 on disk. */
export function cm2LongDisplayToDisk(display: number, displayScale: number): number {
  const normal = Math.max(0, Math.trunc(display)) / displayScale
  return cm2LongFromNormal(normal)
}

/**
 * Plain int32 pounds (rare third-party edits). Packed decode of e.g. 21_000_000 raw
 * explodes to billions, so we trust the raw value instead.
 */
/** True when `raw` is a valid packed CM2 long (large balances encode to small ints). */
function isPackedCm2LongOnDisk(raw: number): boolean {
  return cm2LongFromNormal(cm2LongToNormal(raw)) === Math.trunc(raw)
}

export function cashLooksPlainOnDisk(raw: number): boolean {
  if (raw < 0 || raw > MAX_CASH_POUNDS) return false
  if (isPackedCm2LongOnDisk(raw)) return false
  const packedPounds = cm2LongDiskToDisplay(raw, CASH_DISPLAY_SCALE)
  if (packedPounds > MAX_CASH_POUNDS) return true
  return true
}

/** Bank balance in pounds for UI / club browse. */
export function readCashDisplay(raw: number): number {
  if (cashLooksPlainOnDisk(raw)) return raw
  return cm2LongDiskToDisplay(raw, CASH_DISPLAY_SCALE)
}

/** Write pounds — always packed for CM0102 (same as CM0102Patcher). */
export function writeCashDisplay(pounds: number, _priorRaw?: number): number {
  const p = Math.min(MAX_CASH_POUNDS, Math.max(0, Math.trunc(pounds)))
  return cm2LongDisplayToDisk(p, CASH_DISPLAY_SCALE)
}
