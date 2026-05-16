/**
 * Phase A — `player stats.dat` physical layout research.
 * Tries to find a fixed (headerBytes, stride, idOffsetInRow) grid where many row slots
 * contain a known `player.dat` id at the same relative offset. Does not replace the
 * heuristic decoder until scores and UI goldens confirm a single structure.
 *
 * Note: saves often use dense sequential `player.dat` ids (0..N-1). Membership-only
 * scoring is then meaningless; use `requirePlausiblePlus4` (default in scans) so the
 * int32 at id+4 matches one of the heuristic “stats row” bands from `playerStatsDat.ts`.
 */

export const PLAYER_STATS_LAYOUT_HEADER_PREVIEW_BYTES = 256

/**
 * `player.dat` id at anchor + plausible int32 at anchor+4 for one of the heuristic row shapes
 * (see `playerStatsDat.ts`). Used to disambiguate stride scans when id space is dense.
 */
export function plausiblePlayerStatsInt32AtPlus4(v: number): boolean {
  if (v >= 1500 && v <= 6000) return true
  if (v >= 500_000 && v <= 50_000_000) return true
  if (v >= 500 && v <= 250_000) return true
  return false
}

export interface PlayerStatsHeaderSummary {
  byteLength: number
  /** First 64 LE uint32 values (for magic / count / version guesses). */
  uint32First64: number[]
}

export interface PlayerStatsStrideCandidate {
  headerBytes: number
  stride: number
  idOffsetInRow: number
  rowsConsidered: number
  /** Rows passing the active scoring rule. */
  idHits: number
  /** Distinct player ids among passing rows. */
  distinctIdHits: number
  /** `(buf.length - headerBytes) % stride` — 0 often indicates a clean tile of rows + header. */
  bodySlackBytes: number
  /** idHits / rowsConsidered */
  hitRate: number
}

export interface PlayerStatsLayoutScanResult {
  header: PlayerStatsHeaderSummary
  best: PlayerStatsStrideCandidate | null
  top: PlayerStatsStrideCandidate[]
}

export interface ScorePlayerStatsGridOptions {
  /**
   * When true (recommended for real saves), count a row only if id is in `playerIds`
   * AND `readInt32LE` at id+4 passes `plausiblePlayerStatsInt32AtPlus4`.
   */
  requirePlausiblePlus4?: boolean
}

function clampRowsForScan(stride: number, headerBytes: number, bufLen: number, maxRows: number): number {
  const rows = Math.floor((bufLen - headerBytes) / stride)
  return Math.max(0, Math.min(rows, maxRows))
}

export function summarizePlayerStatsHeader(buf: Buffer): PlayerStatsHeaderSummary {
  const n = Math.min(PLAYER_STATS_LAYOUT_HEADER_PREVIEW_BYTES, buf.length)
  const uint32First64: number[] = []
  for (let o = 0; o + 4 <= n; o += 4) {
    uint32First64.push(buf.readUInt32LE(o))
  }
  return { byteLength: buf.length, uint32First64 }
}

/**
 * Score fixed-row grids: assumes each logical row is `stride` bytes and player.dat id
 * appears at `idOffsetInRow` from the row start (after `headerBytes` prefix).
 */
export function scorePlayerStatsFixedRowGrid(
  buf: Buffer,
  playerIds: ReadonlySet<number>,
  headerBytes: number,
  stride: number,
  idOffsetInRow: number,
  maxRowsToScan = 6000,
  scoreOpts: ScorePlayerStatsGridOptions = {},
): PlayerStatsStrideCandidate | null {
  const requirePlausiblePlus4 = scoreOpts.requirePlausiblePlus4 ?? false

  if (stride < 32 || idOffsetInRow < 0 || idOffsetInRow + 4 > stride) return null
  if (headerBytes < 0 || headerBytes + stride > buf.length) return null

  const rowsConsidered = clampRowsForScan(stride, headerBytes, buf.length, maxRowsToScan)
  if (rowsConsidered < 1) return null

  const bodySlackBytes = (buf.length - headerBytes) % stride

  let idHits = 0
  const idsSeen = new Set<number>()
  for (let r = 0; r < rowsConsidered; r++) {
    const o = headerBytes + r * stride + idOffsetInRow
    if (o + 4 > buf.length) break
    const id = buf.readInt32LE(o)
    if (!playerIds.has(id)) continue
    if (requirePlausiblePlus4) {
      if (o + 8 > buf.length) continue
      const v4 = buf.readInt32LE(o + 4)
      if (!plausiblePlayerStatsInt32AtPlus4(v4)) continue
    }
    idHits++
    idsSeen.add(id)
  }

  return {
    headerBytes,
    stride,
    idOffsetInRow,
    rowsConsidered,
    idHits,
    distinctIdHits: idsSeen.size,
    bodySlackBytes,
    hitRate: idHits / rowsConsidered,
  }
}

export interface ScanPlayerStatsLayoutOptions {
  headerMax?: number
  /** Coarser = faster scan (default 4). */
  headerStep?: number
  strideMin?: number
  strideMax?: number
  strideStep?: number
  idOffsetStep?: number
  maxRowsToScan?: number
  topK?: number
  /** Minimum hit rate to include in `top` / set `best`. */
  minHitRate?: number
  /** Default true — set false only for synthetic tests with unrealistic id ranges. */
  requirePlausiblePlus4?: boolean
}

/**
 * Brute-force search (research / offline). Keep `headerStep` / `strideStep` / `idOffsetStep`
 * at 4 unless you are refining around a known-good peak.
 */
export function scanPlayerStatsFixedRowLayout(
  buf: Buffer,
  playerIds: ReadonlySet<number>,
  opts: ScanPlayerStatsLayoutOptions = {},
): PlayerStatsLayoutScanResult {
  const header = summarizePlayerStatsHeader(buf)
  const headerMax = opts.headerMax ?? 128
  const headerStep = opts.headerStep ?? 4
  const strideMin = opts.strideMin ?? 80
  const strideMax = opts.strideMax ?? 288
  const strideStep = opts.strideStep ?? 4
  const idOffsetStep = opts.idOffsetStep ?? 4
  const maxRowsToScan = opts.maxRowsToScan ?? 4000
  const topK = opts.topK ?? 12
  const minHitRate = opts.minHitRate ?? 0.02
  const requirePlausiblePlus4 = opts.requirePlausiblePlus4 ?? true

  const candidates: PlayerStatsStrideCandidate[] = []

  for (
    let headerBytes = 0;
    headerBytes <= Math.min(headerMax, buf.length);
    headerBytes += headerStep
  ) {
    for (let stride = strideMin; stride <= strideMax; stride += strideStep) {
      for (let idOffsetInRow = 0; idOffsetInRow <= stride - 4; idOffsetInRow += idOffsetStep) {
        const c = scorePlayerStatsFixedRowGrid(
          buf,
          playerIds,
          headerBytes,
          stride,
          idOffsetInRow,
          maxRowsToScan,
          { requirePlausiblePlus4 },
        )
        if (!c || c.hitRate < minHitRate) continue
        candidates.push(c)
      }
    }
  }

  candidates.sort(
    (a, b) =>
      b.hitRate - a.hitRate ||
      a.bodySlackBytes - b.bodySlackBytes ||
      b.distinctIdHits - a.distinctIdHits ||
      b.idHits - a.idHits,
  )
  const top = candidates.slice(0, topK)
  const best = top[0] ?? null

  return { header, best, top }
}

/** Yield row start offsets when a high-confidence grid is known (Phase A exit helper). */
export function* iteratePlayerStatsRowStarts(
  buf: Buffer,
  headerBytes: number,
  stride: number,
): Generator<number> {
  if (stride < 1) return
  for (let o = headerBytes; o + stride <= buf.length; o += stride) {
    yield o
  }
}
