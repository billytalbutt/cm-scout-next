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

/** True when `raw` is a valid packed CM2 long (CM0102Patcher ConvertLongToCM2Format). */
export function isPackedCm2LongOnDisk(raw: number): boolean {
  const r = Math.trunc(raw)
  return cm2LongFromNormal(cm2LongToNormal(r)) === r
}

/**
 * True when cash is stored as plain int32 pounds (common in progressed saves / some editors).
 * Vanilla packed CM2 cash uses a compact encoded int32; decoding yields £ in a different magnitude.
 */
export function cashLooksPlainOnDisk(raw: number): boolean {
  const r = Math.trunc(raw)
  if (r < 0 || r > MAX_CASH_POUNDS) return false
  if (!isPackedCm2LongOnDisk(r)) return true
  const normal = cm2LongToNormal(r)
  const decodedPounds = normal * CASH_DISPLAY_SCALE
  if (r >= 100_000 && Math.abs(decodedPounds - r) / r < 0.05) return false
  if (r >= 1_000_000 && decodedPounds > r * 1.1) return true
  if (r < 10_000_000) return false
  return false
}

/** Bank balance in pounds for UI / club browse. */
export function readCashDisplay(raw: number): number {
  const r = Math.trunc(raw)
  if (cashLooksPlainOnDisk(r)) return r
  if (isPackedCm2LongOnDisk(r)) {
    return cm2LongDiskToDisplay(r, CASH_DISPLAY_SCALE)
  }
  if (r >= 0 && r <= MAX_CASH_POUNDS) {
    return r
  }
  return cm2LongDiskToDisplay(r, CASH_DISPLAY_SCALE)
}

/**
 * Write pounds to club.dat `TClub.Cash`. Preserves on-disk encoding (plain int32 pounds vs
 * packed CM2 long) so CM Finances matches after reload — same behaviour as Graeme Kelly editor.
 */
export function writeCashDisplay(pounds: number, priorRaw?: number): number {
  const clamped = Math.min(MAX_CASH_POUNDS, Math.max(0, Math.trunc(pounds)))
  if (priorRaw !== undefined && cashLooksPlainOnDisk(priorRaw)) {
    return clamped
  }
  return writeCm0102CashToDisk(clamped)
}

/** CM0102 vanilla saves always store bank balance as packed CM2 long — use when writing from the editor. */
export function writeCm0102CashToDisk(pounds: number): number {
  return cm2LongDisplayToDisk(
    Math.min(MAX_CASH_POUNDS, Math.max(0, Math.trunc(pounds))),
    CASH_DISPLAY_SCALE,
  )
}

/** True when on-disk cash decodes to the target pounds (packed CM2 rounds to nearest £1000). */
export function cashMatchesTargetPounds(targetPounds: number, rawOnDisk: number): boolean {
  const target = Math.min(MAX_CASH_POUNDS, Math.max(0, Math.trunc(targetPounds)))
  const display = readCashDisplay(rawOnDisk)
  if (display === target) return true
  if (!isPackedCm2LongOnDisk(rawOnDisk)) return false
  const packed = writeCm0102CashToDisk(target)
  if (rawOnDisk === packed) return true
  return Math.abs(display - target) <= CASH_DISPLAY_SCALE
}
