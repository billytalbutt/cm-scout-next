/**
 * Probe `player stats history.tmp` and `player stats.dat` for (player.dat id, club_comp id) pairs.
 * CM0102Patcher Scouter comments row size 0x2f (47) — validated by scanning windows around id hits.
 */

import { buildCompetitionNamesById, competitionNameFromMaps } from './competitionNames'
import type { ClubCompRecord, StaffCompRecord } from './clubComp'

export const PLAYER_STATS_HISTORY_ROW_BYTES_CANDIDATE = 0x2f // 47 — SaveReader.cs

export interface PlayerCompWindowHit {
  source: 'player stats history.tmp' | 'player stats.dat'
  offset: number
  playerDatId: number
  competitionId: number
  competitionName: string
  playerRel: number
  compRel: number
  windowStart: number
  hex: string
  /** u8 at compRel+? guessed stat bytes if plausible */
  u8NearComp: Array<{ rel: number; value: number; label: string }>
}

const ENGLISH_CLUB_COMP_IDS = {
  premier: 7,
  faCup: 351,
  leagueCup: 352,
  championsLeague: 326,
  uefaCup: 328,
  clubWorldCup: 104,
} as const

export function defaultBlackburnClubCompIds(): number[] {
  return Object.values(ENGLISH_CLUB_COMP_IDS)
}

function findInt32Offsets(buf: Buffer, value: number, maxHits = 500): number[] {
  const needle = Buffer.allocUnsafe(4)
  needle.writeInt32LE(value, 0)
  const out: number[] = []
  let pos = 0
  while (out.length < maxHits) {
    const i = buf.indexOf(needle, pos)
    if (i === -1) break
    out.push(i)
    pos = i + 1
  }
  return out
}

function plausibleStatU8(v: number): string | null {
  if (v >= 0 && v <= 60) return 'apps?'
  if (v >= 50 && v <= 100) return 'rating?'
  return null
}

export function scanWindowsAroundIdHits(
  buf: Buffer,
  source: PlayerCompWindowHit['source'],
  playerDatId: number,
  compIds: ReadonlySet<number>,
  competitionNames: Map<number, string>,
  windowRadius = 48,
  maxIdHits = 80,
): PlayerCompWindowHit[] {
  const out: PlayerCompWindowHit[] = []
  const seen = new Set<string>()

  for (const idOff of findInt32Offsets(buf, playerDatId, maxIdHits)) {
    const w0 = Math.max(0, idOff - windowRadius)
    const w1 = Math.min(buf.length, idOff + windowRadius + 4)

    for (let off = w0; off <= w1 - 4; off += 4) {
      const comp = buf.readInt32LE(off)
      if (!compIds.has(comp)) continue
      const key = `${idOff}:${off}:${comp}`
      if (seen.has(key)) continue
      seen.add(key)

      const u8NearComp: PlayerCompWindowHit['u8NearComp'] = []
      for (let rel = -16; rel <= 24; rel++) {
        const i = off + rel
        if (i < 0 || i >= buf.length) continue
        const v = buf.readUInt8(i)
        const label = plausibleStatU8(v)
        if (label) u8NearComp.push({ rel, value: v, label })
      }

      const windowStart = Math.max(0, off - 32)
      const hexLen = Math.min(96, buf.length - windowStart)
      out.push({
        source,
        offset: off,
        playerDatId,
        competitionId: comp,
        competitionName: competitionNameFromMaps(comp, competitionNames, playerDatId),
        playerRel: idOff - off,
        compRel: 0,
        windowStart,
        hex: buf.subarray(windowStart, windowStart + hexLen).toString('hex'),
        u8NearComp: u8NearComp.slice(0, 12),
      })
    }
  }

  return out.sort((a, b) => a.competitionId - b.competitionId || a.offset - b.offset)
}

/** Try fixed 47-byte records: player id and comp id anywhere in row. */
export function scanFixedStrideRecords(
  buf: Buffer,
  source: PlayerCompWindowHit['source'],
  stride: number,
  playerDatId: number,
  compIds: ReadonlySet<number>,
  competitionNames: Map<number, string>,
  headerBytes = 0,
  maxRows = 200_000,
): PlayerCompWindowHit[] {
  const out: PlayerCompWindowHit[] = []
  let rows = 0
  for (let row = headerBytes; row + stride <= buf.length && rows < maxRows; row += stride, rows++) {
    let hasPlayer = false
    let comp = -1
    let playerRel = -1
    let compRel = -1
    for (let rel = 0; rel <= stride - 4; rel += 4) {
      const v = buf.readInt32LE(row + rel)
      if (v === playerDatId) {
        hasPlayer = true
        playerRel = rel
      }
      if (compIds.has(v)) {
        comp = v
        compRel = rel
      }
    }
    if (!hasPlayer || comp < 0) continue
    out.push({
      source,
      offset: row + compRel,
      playerDatId,
      competitionId: comp,
      competitionName: competitionNameFromMaps(comp, competitionNames, playerDatId),
      playerRel,
      compRel,
      windowStart: row,
      hex: buf.subarray(row, row + stride).toString('hex'),
      u8NearComp: [],
    })
  }
  return out
}

export function probePlayerCompPairsInSaveBlocks(opts: {
  playerStatsHistoryBuf: Buffer | null
  playerStatsBuf: Buffer | null
  playerDatId: number
  clubCompsById?: Map<number, ClubCompRecord>
  staffCompsById?: Map<number, StaffCompRecord>
  compIds?: number[]
  extraAnchorOffsets?: number[]
}): {
  competitionNames: Map<number, string>
  compIds: number[]
  windowHits: PlayerCompWindowHit[]
  stride47Hits: PlayerCompWindowHit[]
} {
  const competitionNames = buildCompetitionNamesById(opts.clubCompsById, opts.staffCompsById)
  const compIds = opts.compIds ?? defaultBlackburnClubCompIds()
  const compSet = new Set(compIds)

  const windowHits: PlayerCompWindowHit[] = []

  if (opts.playerStatsHistoryBuf?.length) {
    windowHits.push(
      ...scanWindowsAroundIdHits(
        opts.playerStatsHistoryBuf,
        'player stats history.tmp',
        opts.playerDatId,
        compSet,
        competitionNames,
        56,
        120,
      ),
    )
  }

  if (opts.playerStatsBuf?.length) {
    windowHits.push(
      ...scanWindowsAroundIdHits(
        opts.playerStatsBuf,
        'player stats.dat',
        opts.playerDatId,
        compSet,
        competitionNames,
        64,
        opts.playerDatId < 1000 ? 120 : 24,
      ),
    )
    for (const anchor of opts.extraAnchorOffsets ?? []) {
      const w0 = Math.max(0, anchor - 128)
      const w1 = Math.min(opts.playerStatsBuf.length, anchor + 256)
      const slice = opts.playerStatsBuf.subarray(w0, w1)
      const localHits = scanWindowsAroundIdHits(
        slice,
        'player stats.dat',
        opts.playerDatId,
        compSet,
        competitionNames,
        64,
        8,
      )
      for (const h of localHits) {
        windowHits.push({
          ...h,
          offset: w0 + h.offset,
          windowStart: w0 + h.windowStart,
        })
      }
    }
  }

  let stride47Hits: PlayerCompWindowHit[] = []
  if (opts.playerStatsHistoryBuf?.length) {
    for (const header of [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 60]) {
      const hits = scanFixedStrideRecords(
        opts.playerStatsHistoryBuf,
        'player stats history.tmp',
        PLAYER_STATS_HISTORY_ROW_BYTES_CANDIDATE,
        opts.playerDatId,
        compSet,
        competitionNames,
        header,
        50_000,
      )
      if (hits.length > stride47Hits.length) stride47Hits = hits
    }
  }

  return { competitionNames, compIds, windowHits, stride47Hits }
}

export function formatPlayerCompProbeReport(
  playerName: string,
  playerDatId: number,
  result: ReturnType<typeof probePlayerCompPairsInSaveBlocks>,
): string {
  const lines: string[] = []
  lines.push(`\n${playerName} (player.dat id=${playerDatId})`)
  lines.push(`  Target comp ids: ${result.compIds.join(', ')}`)
  lines.push(`  Window co-occurrence hits: ${result.windowHits.length}`)
  for (const h of result.windowHits.slice(0, 24)) {
    lines.push(
      `    ${h.source} @${h.offset}  comp [${h.competitionId}] ${h.competitionName}  (player@${h.playerRel >= 0 ? '+' : ''}${h.playerRel} from comp)`,
    )
    if (h.u8NearComp.length) {
      const u = h.u8NearComp.map((x) => `${x.rel >= 0 ? '+' : ''}${x.rel}:${x.value}`).join(' ')
      lines.push(`      u8 near comp: ${u}`)
    }
  }
  if (result.windowHits.length > 24) lines.push(`    ... ${result.windowHits.length - 24} more`)

  lines.push(`  Best 47-byte stride scan: ${result.stride47Hits.length} row(s)`)
  for (const h of result.stride47Hits.slice(0, 12)) {
    lines.push(
      `    row@${h.windowStart}  comp [${h.competitionId}] ${h.competitionName}  player@+${h.playerRel} comp@+${h.compRel}`,
    )
  }
  return lines.join('\n')
}
