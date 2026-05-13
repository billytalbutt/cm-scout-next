/**
 * Optional `tactics.dat` block — row layout is not fully documented in-repo; we infer row size from
 * block length using sizes that commonly divide community saves, then index rows by leading int32 id
 * (same id space as `TClub.TacticSelected` in CM0102Patcher).
 *
 * Pitch slot extraction is **experimental** and only activates when a heuristic window of 11 byte-pairs
 * looks like a 0–100 grid (adjust offsets when we lock the layout against a known-good `.sav`).
 */

export type TacticsIndexMeta = {
  rowBytes: number
  rowCount: number
  /** First row per tactic id (later rows with duplicate ids ignored). */
  byId: Map<number, Buffer>
}

const ROW_BYTE_CANDIDATES_DESC = [
  784, 800, 768, 736, 704, 672, 640, 608, 576, 568, 544, 512, 504, 496, 488, 480, 472, 464, 456, 448, 440, 432, 424,
  416, 408, 400, 392, 384, 376, 368, 360, 352, 344, 336, 328, 320,
]

export function parseTacticsDatIndex(data: Buffer): TacticsIndexMeta | null {
  if (data.length < 256) return null
  for (const rowBytes of ROW_BYTE_CANDIDATES_DESC) {
    if (data.length % rowBytes !== 0) continue
    const rowCount = data.length / rowBytes
    if (rowCount < 80 || rowCount > 2400) continue
    const byId = new Map<number, Buffer>()
    for (let i = 0; i < rowCount; i++) {
      const slice = data.subarray(i * rowBytes, (i + 1) * rowBytes)
      const tid = slice.readInt32LE(0)
      if (!byId.has(tid)) byId.set(tid, slice)
    }
    return { rowBytes, rowCount, byId }
  }
  return null
}

export type ExperimentalTacticSlot = { x: number; y: number; label: string }

const DEFAULT_LABELS = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10']

/** Try 11 (u8,u8) pairs in 0..100 — returns normalized x,y with y low = own goal / GK end (matches lab). */
export function tryExperimentalPitchFromTacticRow(row: Buffer): ExperimentalTacticSlot[] | null {
  if (row.length < 220) return null
  const bases = [96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256]
  for (const base of bases) {
    if (base + 22 > row.length) continue
    const pts: { x: number; y: number }[] = []
    let ok = true
    for (let i = 0; i < 11; i++) {
      const xb = row.readUInt8(base + i * 2)
      const yb = row.readUInt8(base + i * 2 + 1)
      if (xb > 100 || yb > 100) {
        ok = false
        break
      }
      pts.push({ x: Math.min(0.94, Math.max(0.06, xb / 100)), y: Math.min(0.92, Math.max(0.04, yb / 100)) })
    }
    if (!ok || pts.length !== 11) continue
    const spread = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y))
    if (spread < 0.12) continue
    return pts.map((p, i) => ({
      x: p.x,
      y: p.y,
      label: DEFAULT_LABELS[i] ?? `P${i}`,
    }))
  }
  return null
}
