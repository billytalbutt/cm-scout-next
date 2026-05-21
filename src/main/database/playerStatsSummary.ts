/**
 * Fast `player stats.dat` summary decode (CM “Senior club” style totals).
 *
 * Two layouts at a `player.dat` id anchor (int32 LE):
 * - **Slot A:** apps/goals/assists @ +91 / +92 / +93 (when +59 === apps, goals @ +60)
 * - **Slot B:** apps/goals/assists @ +76 / +77 / +78 — Senior club aggregate (+91 often 0)
 * - **Grid-extra (v4 = 0, many id hits):** Dyer-style — +18/+19/+20 early season, +110/+77/+78 after goals appear
 * - **Off-grid record (v4 = -1):** Tsigalko-style — +57/+53/+64 or +92/+96/+64 when season advances
 * - **Embedded-id record (v4 ∉ {0, -1}):** Cole-style — Senior club @ rec+13 / +26 / +30
 */

import type { PlayerRecord, PlayerSavePerformanceStats } from './types'

export const PLAYER_STATS_SUMMARY_VERSION = 7

/** `player.dat` id sits at byte 40 within a 128-byte record; anchor may be that id pointer. */
export const OFF_GRID_RECORD_ID_OFFSET = 40

/** CM off-grid records (Tsigalko / Cole-style) use -1 at anchor+4; senior grid rows use 0. */
export const OFF_GRID_ANCHOR_V4 = -1

/** Players with many id hits (e.g. Dyer) are grid-only; off-grid matching is false positives. */
export const OFF_GRID_MAX_PLAYER_ID_HITS = 8

export const PLAYER_STATS_SUMMARY_FIELDS = {
  apps: 91,
  goals: 92,
  assists: 93,
  appsAlt: 59,
  goalsAlt: 60,
  assistsAlt: 61,
  appsSenior: 76,
  goalsSenior: 77,
  assistsSenior: 78,
  /** Off-grid record (id @ +40): research grid V0 counting stats. */
  appsOffGrid: 52,
  goalsOffGrid: 44,
  assistsOffGrid: 53,
  goalsOffGridAlt: 60,
  assistsOffGridAlt: 61,
  /** Cole / embedded-id Senior club (record@anchor−40, id @ anchor). */
  appsEmbedded: 13,
  goalsEmbedded: 26,
  assistsEmbedded: 30,
  /** Tsigalko / v4=−1 primary Senior club triple (anchor-relative). */
  appsOffGridV4Primary: 57,
  goalsOffGridV4Primary: 53,
  assistsOffGridV4: 64,
  /** Tsigalko / v4=−1 when apps grow past primary slot. */
  appsOffGridV4Alt: 92,
  goalsOffGridV4Alt: 96,
  /** Dyer / v4=0 alternate Senior club layouts (anchor-relative). */
  appsGridExtraA: 110,
  goalsGridExtraA: 77,
  assistsGridExtraA: 78,
  appsGridExtraB: 18,
  goalsGridExtraB: 19,
  assistsGridExtraB: 20,
} as const

const F = PLAYER_STATS_SUMMARY_FIELDS

const MAX_PLAUSIBLE_PLUS20 = 10_000_000
const MAX_PLAUSIBLE_PLUS32 = 10_000_000
/** Senior-club +76 rows above this are usually another stat kind, not the season total. */
const MAX_SENIOR_SLOT_APPS = 15

/** Last relative byte read on standard +91/+76 grid rows. */
const SLOT_GRID_MAX_REL = F.assists + 1

/** Last relative byte for Dyer/Tsigalko grid-extra slot @ +110. */
const GRID_EXTRA_MAX_REL = F.appsGridExtraA + 1

export interface SummaryStatsTriple {
  apps: number
  goals: number
  assists: number
}

function readU8(buf: Buffer, anchor: number, rel: number): number | null {
  const i = anchor + rel
  if (i < 0 || i >= buf.length) return null
  return buf.readUInt8(i)
}

function readU8Or0(buf: Buffer, anchor: number, rel: number): number {
  return readU8(buf, anchor, rel) ?? 0
}

export function plausibleSummaryStats(apps: number, goals: number, assists: number): boolean {
  if (apps < 1 || apps > MAX_SENIOR_SLOT_APPS || goals > 60 || assists > 40) return false
  if (goals > apps || assists > apps) return false
  if (goals > Math.ceil(apps * 0.85)) return false
  if (apps > 12 && goals > 6) return false
  if (apps >= 9 && assists > goals + 1) return false
  if (goals === 0 && assists > Math.max(2, Math.floor(apps / 3))) return false
  if (apps > 10 && goals === 0) return false
  return true
}

function readSlotA(buf: Buffer, anchor: number): SummaryStatsTriple | null {
  const apps = readU8(buf, anchor, F.apps)
  if (apps == null || apps < 1) return null

  let goals = readU8Or0(buf, anchor, F.goals)
  let assists = readU8Or0(buf, anchor, F.assists)

  const appsAlt = readU8Or0(buf, anchor, F.appsAlt)
  if (appsAlt === apps) {
    goals = readU8Or0(buf, anchor, F.goalsAlt)
    const ast93 = readU8Or0(buf, anchor, F.assists)
    const ast61 = readU8Or0(buf, anchor, F.assistsAlt)
    assists = ast93 > 0 ? ast93 : ast61
  }

  if (!plausibleSummaryStats(apps, goals, assists)) return null
  return { apps, goals, assists }
}

function readSlotB(buf: Buffer, anchor: number): SummaryStatsTriple | null {
  const apps = readU8(buf, anchor, F.appsSenior)
  if (apps == null || apps < 1) return null
  const goals = readU8Or0(buf, anchor, F.goalsSenior)
  const assists = readU8Or0(buf, anchor, F.assistsSenior)
  if (!plausibleSummaryStats(apps, goals, assists)) return null
  return { apps, goals, assists }
}

/** Senior-club aggregate uses slot B when slot A apps byte is zero. */
export function isSlotBSeniorAggregate(buf: Buffer, anchor: number): boolean {
  const apps = readU8(buf, anchor, F.apps)
  return (apps ?? 1) < 1 && readSlotB(buf, anchor) != null
}

/** Record start when `anchor` points at the int32 player id (id also at record+40). */
export function offGridRecordStart(
  buf: Buffer,
  anchor: number,
  playerDatId: number,
  playerIdHitCount?: number,
): number | null {
  if (anchor < OFF_GRID_RECORD_ID_OFFSET) return null
  /** Senior-club rows (Dyer) use v4 === 0 at the id anchor; off-grid stars use v4 = -1. */
  if (buf.readInt32LE(anchor + 4) !== OFF_GRID_ANCHOR_V4) return null
  if (
    playerIdHitCount != null &&
    playerIdHitCount > OFF_GRID_MAX_PLAYER_ID_HITS
  ) {
    return null
  }
  const rec = anchor - OFF_GRID_RECORD_ID_OFFSET
  if (rec < 0 || rec + F.assists + 1 > buf.length) return null
  if (buf.readInt32LE(anchor) !== playerDatId) return null
  if (buf.readInt32LE(rec + OFF_GRID_RECORD_ID_OFFSET) !== playerDatId) return null
  return rec
}

/**
 * Cole-style 128 B record: `player.dat` id at anchor (= rec+40), anchor+4 is not 0 or −1.
 * Senior club combined totals live at rec+13 / +26 / +30 (verified Blackburn saves).
 */
export function embeddedIdRecordStart(
  buf: Buffer,
  anchor: number,
  playerDatId: number,
): number | null {
  if (anchor < OFF_GRID_RECORD_ID_OFFSET) return null
  const v4 = buf.readInt32LE(anchor + 4)
  if (v4 === 0 || v4 === OFF_GRID_ANCHOR_V4) return null
  const rec = anchor - OFF_GRID_RECORD_ID_OFFSET
  if (rec < 0 || rec + F.assistsEmbedded + 1 > buf.length) return null
  if (buf.readInt32LE(anchor) !== playerDatId) return null
  if (buf.readInt32LE(rec + OFF_GRID_RECORD_ID_OFFSET) !== playerDatId) return null
  return rec
}

function readEmbeddedIdRecordStats(buf: Buffer, recStart: number): SummaryStatsTriple | null {
  const apps = readU8(buf, recStart, F.appsEmbedded)
  const goals = readU8(buf, recStart, F.goalsEmbedded)
  const assists = readU8(buf, recStart, F.assistsEmbedded)
  if (apps == null || goals == null || assists == null) return null
  if (!plausibleSummaryStats(apps, goals, assists)) return null
  return { apps, goals, assists }
}

function pickPlausibleU8(...values: number[]): number {
  for (const v of values) {
    if (v >= 0 && v <= 60) return v
  }
  return 0
}

function readTripleAt(
  buf: Buffer,
  base: number,
  appsRel: number,
  goalsRel: number,
  assistsRel: number,
): SummaryStatsTriple | null {
  const maxRel = Math.max(appsRel, goalsRel, assistsRel)
  if (base < 0 || base + maxRel >= buf.length) return null
  const apps = readU8(buf, base, appsRel)
  const goals = readU8(buf, base, goalsRel)
  const assists = readU8(buf, base, assistsRel)
  if (apps == null || goals == null || assists == null) return null
  if (!plausibleSummaryStats(apps, goals, assists)) return null
  return { apps, goals, assists }
}

/** Senior club on v4=−1 anchors (Tsigalko): +57/+53/+64, or +92/+96/+64 when season advances. */
function readOffGridV4MinusOneSenior(buf: Buffer, anchor: number): SummaryStatsTriple | null {
  const primary = readTripleAt(
    buf,
    anchor,
    F.appsOffGridV4Primary,
    F.goalsOffGridV4Primary,
    F.assistsOffGridV4,
  )
  const alt = readTripleAt(buf, anchor, F.appsOffGridV4Alt, F.goalsOffGridV4Alt, F.assistsOffGridV4)
  if (primary && alt) {
    if (alt.goals > primary.goals && alt.apps > primary.apps && alt.goals <= primary.apps) return alt
    return primary
  }
  if (primary) return primary
  if (alt) return alt
  return null
}

export type GridSeniorSlot = 'A' | 'B'

/** Which grid-extra triple produced `stats` at this anchor (CM Dyer-style layouts). */
export function gridSeniorSlotForStats(
  buf: Buffer,
  anchor: number,
  stats: SummaryStatsTriple,
): GridSeniorSlot | null {
  const slotA = readTripleAt(
    buf,
    anchor,
    F.appsGridExtraA,
    F.goalsGridExtraA,
    F.assistsGridExtraA,
  )
  if (
    slotA &&
    slotA.apps === stats.apps &&
    slotA.goals === stats.goals &&
    slotA.assists === stats.assists
  ) {
    return 'A'
  }
  const slotB = readTripleAt(
    buf,
    anchor,
    F.appsGridExtraB,
    F.goalsGridExtraB,
    F.assistsGridExtraB,
  )
  if (
    slotB &&
    slotB.apps === stats.apps &&
    slotB.goals === stats.goals &&
    slotB.assists === stats.assists
  ) {
    return 'B'
  }
  return null
}

/** Dyer-style v4=0 Senior club: +110/+77/+78 when apps≥10, else +18/+19/+20. */
function readGridSeniorExtras(buf: Buffer, anchor: number): SummaryStatsTriple | null {
  const slotA = readTripleAt(
    buf,
    anchor,
    F.appsGridExtraA,
    F.goalsGridExtraA,
    F.assistsGridExtraA,
  )
  const slotB = readTripleAt(
    buf,
    anchor,
    F.appsGridExtraB,
    F.goalsGridExtraB,
    F.assistsGridExtraB,
  )
  if (slotA && slotA.apps >= 10) return slotA
  if (slotB && slotB.apps >= 3) return slotB
  if (slotA) return slotA
  if (slotB) return slotB
  return null
}

function isHighHitGridOnlyPlayer(idHitCount: number | undefined): boolean {
  return idHitCount != null && idHitCount > OFF_GRID_MAX_PLAYER_ID_HITS
}

/** Per-save peaks on Dyer-style grid-extra bytes (v4 = 0 id anchors). */
export interface GridExtraPeaks {
  maxBApps: number
  maxAApps: number
  maxAGoals: number
}

function recordGridExtraPeaks(
  buf: Buffer,
  anchor: number,
  playerDatId: number,
  peaksByPlayer: Map<number, GridExtraPeaks>,
): void {
  if (buf.readInt32LE(anchor + 4) !== 0) return
  const slotB = readTripleAt(
    buf,
    anchor,
    F.appsGridExtraB,
    F.goalsGridExtraB,
    F.assistsGridExtraB,
  )
  const slotA = readTripleAt(
    buf,
    anchor,
    F.appsGridExtraA,
    F.goalsGridExtraA,
    F.assistsGridExtraA,
  )
  const peaks = peaksByPlayer.get(playerDatId) ?? { maxBApps: 0, maxAApps: 0, maxAGoals: 0 }
  if (slotB && slotB.apps <= 10 && (slotB.goals > 0 || slotB.assists > 0)) {
    peaks.maxBApps = Math.max(peaks.maxBApps, slotB.apps)
  }
  if (slotA && slotA.apps >= 10) {
    if (slotA.apps > peaks.maxAApps || (slotA.apps === peaks.maxAApps && slotA.goals > peaks.maxAGoals)) {
      peaks.maxAApps = slotA.apps
      peaks.maxAGoals = slotA.goals
    }
  }
  peaksByPlayer.set(playerDatId, peaks)
}

function preferGridExtraSlotA(peaks: GridExtraPeaks | undefined): boolean {
  return (peaks?.maxAApps ?? 0) >= 10 && (peaks?.maxAGoals ?? 0) > 0
}

function compareHighHitGridExtras(
  buf: Buffer,
  anchorA: number,
  anchorB: number,
  a: SummaryStatsTriple,
  b: SummaryStatsTriple,
  peaks: GridExtraPeaks | undefined,
): number {
  const srcA = gridSeniorSlotForStats(buf, anchorA, a)
  const srcB = gridSeniorSlotForStats(buf, anchorB, b)
  const useSlotA = preferGridExtraSlotA(peaks)

  if (useSlotA) {
    if (srcA === 'A' && srcB !== 'A') return 1
    if (srcB === 'A' && srcA !== 'A') return -1
    if (srcA === 'A' && srcB === 'A') {
      if (a.apps !== b.apps) return a.apps - b.apps
      if (a.goals !== b.goals) return b.goals - a.goals
      return a.assists - b.assists
    }
    return 0
  }

  if (srcA === 'B' && srcB !== 'B') return 1
  if (srcB === 'B' && srcA !== 'B') return -1
  if (srcA === 'B' && srcB === 'B') {
    if (peaks && peaks.maxBApps > 0) {
      const aAtPeak = a.apps === peaks.maxBApps
      const bAtPeak = b.apps === peaks.maxBApps
      if (aAtPeak !== bAtPeak) return aAtPeak ? 1 : -1
    }
    if (a.apps !== b.apps) return a.apps - b.apps
    if (a.assists !== b.assists) return a.assists - b.assists
    if (a.goals !== b.goals) return b.goals - a.goals
  }
  return 0
}

function readOffGridRecordStats(buf: Buffer, recStart: number): SummaryStatsTriple | null {
  const senior = readSlotB(buf, recStart)
  if (senior && (readU8(buf, recStart, F.apps) ?? 1) < 1) return senior

  const apps = readU8(buf, recStart, F.appsOffGrid)
  if (apps == null || apps < 1) return null

  const goals = pickPlausibleU8(
    readU8(buf, recStart, F.goalsOffGrid),
    readU8(buf, recStart, F.goalsOffGridAlt),
    readU8(buf, recStart, F.goalsSenior),
    readU8(buf, recStart, F.goals),
  )
  const assists = pickPlausibleU8(
    readU8(buf, recStart, F.assistsOffGrid),
    readU8(buf, recStart, F.assistsOffGridAlt),
    readU8(buf, recStart, F.assistsSenior),
    readU8(buf, recStart, F.assists),
  )

  if (!plausibleSummaryStats(apps, goals, assists)) return null
  return { apps, goals, assists }
}

export function isPlausibleSeniorSlotStats(stats: SummaryStatsTriple): boolean {
  return (
    stats.apps >= 5 &&
    stats.apps <= MAX_SENIOR_SLOT_APPS &&
    stats.goals >= 1 &&
    stats.goals <= Math.max(2, Math.floor(stats.apps / 2)) &&
    stats.assists <= stats.apps
  )
}

/** Pick the best-decoding slot group at this id anchor. */
export function readSummaryStatsAtAnchor(
  buf: Buffer,
  anchor: number,
  playerDatId?: number,
  idHitCount?: number,
): SummaryStatsTriple | null {
  if (anchor < 0 || anchor + SLOT_GRID_MAX_REL > buf.length) return null

  const pid = playerDatId ?? buf.readInt32LE(anchor)
  const gridOnly = isHighHitGridOnlyPlayer(idHitCount)

  if (buf.readInt32LE(anchor + 4) === OFF_GRID_ANCHOR_V4) {
    const offSenior = readOffGridV4MinusOneSenior(buf, anchor)
    if (offSenior) return offSenior
  }

  if (buf.readInt32LE(anchor + 4) === 0) {
    const gridExtra = readGridSeniorExtras(buf, anchor)
    if (gridExtra) return gridExtra
    if (gridOnly) return null
  }

  if (gridOnly) return null

  const slotB = readSlotB(buf, anchor)
  const slotA = readSlotA(buf, anchor)

  if (slotB && (readU8(buf, anchor, F.apps) ?? 1) < 1) return slotB
  if (slotA) return slotA
  if (slotB) return slotB

  const embedded = embeddedIdRecordStart(buf, anchor, pid)
  if (embedded != null) return readEmbeddedIdRecordStats(buf, embedded)

  const rec = offGridRecordStart(buf, anchor, pid)
  if (rec != null) return readOffGridRecordStats(buf, rec)

  return null
}

export function isSummaryCandidateAnchor(
  buf: Buffer,
  anchor: number,
  idHitCount?: number,
): boolean {
  if (anchor < 0 || anchor + F.assists + 1 > buf.length) return false

  const playerDatId = buf.readInt32LE(anchor)
  const gridOnly = isHighHitGridOnlyPlayer(idHitCount)

  if (buf.readInt32LE(anchor + 4) === OFF_GRID_ANCHOR_V4) {
    return readOffGridV4MinusOneSenior(buf, anchor) != null
  }

  if (buf.readInt32LE(anchor + 4) === 0) {
    if (readGridSeniorExtras(buf, anchor) != null) return true
    if (gridOnly) return false
  }

  if (gridOnly) return false

  const embedded = embeddedIdRecordStart(buf, anchor, playerDatId)
  if (embedded != null) return readEmbeddedIdRecordStats(buf, embedded) != null

  const rec = offGridRecordStart(buf, anchor, playerDatId)
  if (rec != null) return readOffGridRecordStats(buf, rec) != null

  if (buf.readInt32LE(anchor + 4) !== 0) return false
  const p20 = buf.readInt32LE(anchor + 20)
  const p32 = buf.readInt32LE(anchor + 32)
  if (p20 >= MAX_PLAUSIBLE_PLUS20 || p32 >= MAX_PLAUSIBLE_PLUS32) return false
  if (p20 < 0 || p32 < 0) return false
  return readSummaryStatsAtAnchor(buf, anchor, playerDatId, idHitCount) != null
}

function sideFieldsOk(buf: Buffer, anchor: number): boolean {
  const p20 = buf.readInt32LE(anchor + 20)
  const p32 = buf.readInt32LE(anchor + 32)
  return p20 > 0 && p32 > 0 && p20 < 500 && p32 < 500
}

export function compareSummaryCandidates(
  buf: Buffer,
  anchorA: number,
  anchorB: number,
  idHitCount?: number,
  gridPeaks?: GridExtraPeaks,
): number {
  const playerDatId = buf.readInt32LE(anchorA)
  const a = readSummaryStatsAtAnchor(buf, anchorA, playerDatId, idHitCount)
  const b = readSummaryStatsAtAnchor(buf, anchorB, playerDatId, idHitCount)
  if (!a || !b) return 0

  const extraA = readGridSeniorExtras(buf, anchorA)
  const extraB = readGridSeniorExtras(buf, anchorB)
  const seniorA = isSlotBSeniorAggregate(buf, anchorA)
  const seniorB = isSlotBSeniorAggregate(buf, anchorB)
  if (extraA && !extraB && seniorB) return 1
  if (extraB && !extraA && seniorA) return -1
  if (extraA && extraB) {
    if (isHighHitGridOnlyPlayer(idHitCount)) {
      const gridCmp = compareHighHitGridExtras(buf, anchorA, anchorB, a, b, gridPeaks)
      if (gridCmp !== 0) return gridCmp
    } else if (a.apps !== b.apps) {
      return a.apps - b.apps
    }
    if (a.goals !== b.goals) return b.goals - a.goals
    if (a.assists !== b.assists) return a.assists - b.assists
  }
  const embeddedA =
    embeddedIdRecordStart(buf, anchorA, playerDatId) != null &&
    readEmbeddedIdRecordStats(buf, embeddedIdRecordStart(buf, anchorA, playerDatId)!) != null
  const embeddedB =
    embeddedIdRecordStart(buf, anchorB, playerDatId) != null &&
    readEmbeddedIdRecordStats(buf, embeddedIdRecordStart(buf, anchorB, playerDatId)!) != null
  const gridA = readGridSeniorExtras(buf, anchorA)
  const gridB = readGridSeniorExtras(buf, anchorB)
  if (gridA && embeddedB) return 1
  if (gridB && embeddedA) return -1
  if (seniorA !== seniorB) return seniorA ? 1 : -1

  if (seniorA && seniorB) {
    const okA = isPlausibleSeniorSlotStats(a)
    const okB = isPlausibleSeniorSlotStats(b)
    if (okA !== okB) return okA ? 1 : -1
    if (a.goals !== b.goals) return b.goals - a.goals
    if (a.assists !== b.assists) return a.assists - b.assists
    const bandA = a.apps >= 9 && a.apps <= 12
    const bandB = b.apps >= 9 && b.apps <= 12
    if (bandA !== bandB) return bandA ? 1 : -1
    if (a.apps !== b.apps) return a.apps - b.apps
    return 0
  }

  if (a.apps !== b.apps) return a.apps - b.apps
  if (a.goals !== b.goals) return b.goals - a.goals
  if (a.assists !== b.assists) return a.assists - b.assists

  const sideA = sideFieldsOk(buf, anchorA)
  const sideB = sideFieldsOk(buf, anchorB)
  if (sideA !== sideB) return sideA ? 1 : -1
  return 0
}

export function decodePlayerStatsSummaryAtAnchor(
  buf: Buffer,
  anchor: number,
  idHitCount?: number,
): PlayerSavePerformanceStats | null {
  const playerDatId = buf.readInt32LE(anchor)
  const stats = readSummaryStatsAtAnchor(buf, anchor, playerDatId, idHitCount)
  if (!stats) return null
  return {
    apps: stats.apps,
    goals: stats.goals,
    assists: stats.assists,
    averageRating: null,
    layout: 'summaryV1',
  }
}

function seniorStatKey(goals: number, assists: number): string {
  return `${goals}-${assists}`
}

function bumpMaxApps91(
  playerDatId: number,
  key: string,
  apps91: number,
  maxApps91ByStatKey: Map<number, Map<string, number>>,
): void {
  const byKey = maxApps91ByStatKey.get(playerDatId) ?? new Map<string, number>()
  byKey.set(key, Math.max(byKey.get(key) ?? 0, apps91))
  maxApps91ByStatKey.set(playerDatId, byKey)
}

/** Track +76/+91 senior rows per goals/assists key (first pass). */
function recordSeniorSlotBBase(
  buf: Buffer,
  anchor: number,
  playerDatId: number,
  max76ByStatKey: Map<number, Map<string, number>>,
): void {
  const slotB = readSlotB(buf, anchor)
  if (!slotB || !isPlausibleSeniorSlotStats(slotB)) return
  const key = seniorStatKey(slotB.goals, slotB.assists)
  const byKey = max76ByStatKey.get(playerDatId) ?? new Map<string, number>()
  byKey.set(key, Math.max(byKey.get(key) ?? 0, slotB.apps))
  max76ByStatKey.set(playerDatId, byKey)
}

/**
 * Track +91 apps on duplicate id hits (second pass).
 * CM often updates +91 on a sibling hit while +76 on the primary hit lags or sits on another anchor.
 */
function recordSeniorSlotAApps(
  buf: Buffer,
  anchor: number,
  playerDatId: number,
  max76ByStatKey: Map<number, Map<string, number>>,
  maxApps91ByStatKey: Map<number, Map<string, number>>,
): void {
  const apps91 = readU8(buf, anchor, F.apps)
  if (apps91 == null || apps91 < 9 || apps91 > MAX_SENIOR_SLOT_APPS) return

  const slotB = readSlotB(buf, anchor)
  if (slotB && isPlausibleSeniorSlotStats(slotB)) {
    const key = seniorStatKey(slotB.goals, slotB.assists)
    bumpMaxApps91(playerDatId, key, apps91, maxApps91ByStatKey)
    return
  }

  const goals = readU8(buf, anchor, F.goalsSenior)
  const assists = readU8(buf, anchor, F.assistsSenior)
  const key = seniorStatKey(goals, assists)
  if (plausibleSummaryStats(apps91, goals, assists)) {
    const base76 = max76ByStatKey.get(playerDatId)?.get(key) ?? 0
    if (base76 === 0 || (apps91 > base76 && apps91 - base76 <= 6)) {
      bumpMaxApps91(playerDatId, key, apps91, maxApps91ByStatKey)
    }
    return
  }

  const by76 = max76ByStatKey.get(playerDatId)
  if (!by76?.size) return
  for (const [statKey, base76] of by76) {
    if (base76 <= 0 || apps91 <= base76 || apps91 - base76 > 6) continue
    const sep = statKey.indexOf('-')
    const g = Number(statKey.slice(0, sep))
    const a = Number(statKey.slice(sep + 1))
    if (!plausibleSummaryStats(apps91, g, a)) continue
    bumpMaxApps91(playerDatId, statKey, apps91, maxApps91ByStatKey)
  }
}

/** CM often stores Senior-club apps at +91 on another id hit; goals/assists stay @ +77/+78. */
function resolveSeniorClubApps(
  stats: SummaryStatsTriple,
  maxAppsSlotAForStat: number,
  max76ForStat: number,
): number {
  if (maxAppsSlotAForStat <= stats.apps) return stats.apps
  if (maxAppsSlotAForStat > MAX_SENIOR_SLOT_APPS) return stats.apps
  if (stats.apps >= 9 && maxAppsSlotAForStat > stats.apps + 1) return stats.apps
  if (max76ForStat > 0 && maxAppsSlotAForStat - max76ForStat > 6) return stats.apps
  if (maxAppsSlotAForStat - stats.apps > 6) return stats.apps
  return maxAppsSlotAForStat
}

export function parsePlayerStatsSummary(
  buf: Buffer,
  players: readonly PlayerRecord[],
): Map<number, PlayerSavePerformanceStats> {
  const out = new Map<number, PlayerSavePerformanceStats>()
  if (!buf.length) return out

  const playerIds = new Set<number>()
  for (const p of players) playerIds.add(p.id)

  const len = buf.length
  const idHitCount = new Map<number, number>()
  const max76ByStatKey = new Map<number, Map<string, number>>()
  for (let anchor = 0; anchor <= len - 4; anchor++) {
    const playerDatId = buf.readInt32LE(anchor)
    if (!playerIds.has(playerDatId)) continue
    idHitCount.set(playerDatId, (idHitCount.get(playerDatId) ?? 0) + 1)
    if (anchor <= len - SLOT_GRID_MAX_REL && buf.readInt32LE(anchor + 4) === 0) {
      recordSeniorSlotBBase(buf, anchor, playerDatId, max76ByStatKey)
    }
  }

  const bestAnchor = new Map<number, number>()
  const maxApps91ByStatKey = new Map<number, Map<string, number>>()
  const gridPeaksByPlayer = new Map<number, GridExtraPeaks>()
  const anchorScanEnd = Math.max(0, len - GRID_EXTRA_MAX_REL)

  for (let anchor = 0; anchor <= anchorScanEnd; anchor++) {
    const playerDatId = buf.readInt32LE(anchor)
    if (!playerIds.has(playerDatId)) continue
    const hits = idHitCount.get(playerDatId) ?? 0
    if (isHighHitGridOnlyPlayer(hits)) {
      recordGridExtraPeaks(buf, anchor, playerDatId, gridPeaksByPlayer)
    }
  }

  for (let anchor = 0; anchor <= len - SLOT_GRID_MAX_REL; anchor++) {
    const playerDatId = buf.readInt32LE(anchor)
    if (!playerIds.has(playerDatId)) continue

    if (buf.readInt32LE(anchor + 4) === 0) {
      recordSeniorSlotAApps(
        buf,
        anchor,
        playerDatId,
        max76ByStatKey,
        maxApps91ByStatKey,
      )
    }
  }

  for (let anchor = 0; anchor <= anchorScanEnd; anchor++) {
    const playerDatId = buf.readInt32LE(anchor)
    if (!playerIds.has(playerDatId)) continue

    const hits = idHitCount.get(playerDatId) ?? 0
    if (!isSummaryCandidateAnchor(buf, anchor, hits)) continue

    const prevAnchor = bestAnchor.get(playerDatId)
    const peaks = gridPeaksByPlayer.get(playerDatId)
    if (
      prevAnchor != null &&
      compareSummaryCandidates(buf, anchor, prevAnchor, hits, peaks) <= 0
    ) {
      continue
    }

    bestAnchor.set(playerDatId, anchor)
  }

  for (const [playerDatId, anchor] of bestAnchor) {
    const hits = idHitCount.get(playerDatId) ?? 0
    const decoded = decodePlayerStatsSummaryAtAnchor(buf, anchor, hits)
    if (!decoded) continue
    const rec = offGridRecordStart(buf, anchor, playerDatId, hits)
    const useSeniorAppsMerge =
      isSlotBSeniorAggregate(buf, anchor) ||
      (rec != null && readU8(buf, anchor, F.apps) < 1 && readSlotB(buf, anchor) != null)

    if (useSeniorAppsMerge) {
      const stats = readSummaryStatsAtAnchor(buf, anchor, playerDatId, hits)!
      const key = seniorStatKey(stats.goals, stats.assists)
      const maxApps91 = maxApps91ByStatKey.get(playerDatId)?.get(key) ?? 0
      const max76 = max76ByStatKey.get(playerDatId)?.get(key) ?? 0
      const apps = resolveSeniorClubApps(stats, maxApps91, max76)
      out.set(playerDatId, { ...decoded, apps })
    } else {
      out.set(playerDatId, decoded)
    }
  }

  return out
}

export type SeniorClubSlotKind =
  | 'slotB-senior'
  | 'slotA'
  | 'offGrid'
  | 'embedded'
  | 'grid-extra'
  | 'other'

export interface SeniorClubAnchorInspection {
  anchor: number
  v4: number
  kind: SeniorClubSlotKind
  stats: SummaryStatsTriple
  recStart: number | null
  passesCandidateFilter: boolean
  /** Key byte offsets for CM comparison (anchor-relative unless noted). */
  raw: {
    apps91: number
    goals92: number
    ast93: number
    apps76: number
    goals77: number
    ast78: number
    apps52: number
    goals44: number
    ast53: number
    apps59: number
    goals60: number
    ast61: number
  }
}

export function classifySeniorClubSlotKind(
  buf: Buffer,
  anchor: number,
  playerDatId: number,
  idHitCount: number,
): SeniorClubSlotKind {
  if (buf.readInt32LE(anchor + 4) === OFF_GRID_ANCHOR_V4 && readOffGridV4MinusOneSenior(buf, anchor)) {
    return 'offGrid'
  }
  if (readGridSeniorExtras(buf, anchor)) return 'grid-extra'
  const rec = offGridRecordStart(buf, anchor, playerDatId, idHitCount)
  if (rec != null) return 'offGrid'
  if (embeddedIdRecordStart(buf, anchor, playerDatId) != null) return 'embedded'
  if (isSlotBSeniorAggregate(buf, anchor)) return 'slotB-senior'
  if (readU8(buf, anchor, F.apps) >= 1) return 'slotA'
  return 'other'
}

/** Every id anchor that decodes to plausible Senior-club-style apps/goals/assists. */
export function inspectSeniorClubAnchorsForPlayer(
  buf: Buffer,
  playerDatId: number,
  idHitCount: number,
): SeniorClubAnchorInspection[] {
  const out: SeniorClubAnchorInspection[] = []
  const len = buf.length
  const anchorScanEnd = Math.max(0, len - GRID_EXTRA_MAX_REL)
  for (let anchor = 0; anchor <= anchorScanEnd; anchor++) {
    if (buf.readInt32LE(anchor) !== playerDatId) continue
    const stats = readSummaryStatsAtAnchor(buf, anchor, playerDatId, idHitCount)
    if (!stats) continue
    const rec =
      offGridRecordStart(buf, anchor, playerDatId, idHitCount) ??
      embeddedIdRecordStart(buf, anchor, playerDatId)
    const recStart = rec
    const base = rec ?? anchor
    out.push({
      anchor,
      v4: buf.readInt32LE(anchor + 4),
      kind: classifySeniorClubSlotKind(buf, anchor, playerDatId, idHitCount),
      stats,
      recStart,
      passesCandidateFilter: isSummaryCandidateAnchor(buf, anchor, idHitCount),
      raw: {
        apps91: readU8(buf, anchor, F.apps),
        goals92: readU8(buf, anchor, F.goals),
        ast93: readU8(buf, anchor, F.assists),
        apps76: readU8(buf, anchor, F.appsSenior),
        goals77: readU8(buf, anchor, F.goalsSenior),
        ast78: readU8(buf, anchor, F.assistsSenior),
        apps52: readU8(buf, base, F.appsOffGrid),
        goals44: readU8(buf, base, F.goalsOffGrid),
        ast53: readU8(buf, base, F.assistsOffGrid),
        apps59: readU8(buf, anchor, F.appsAlt),
        goals60: readU8(buf, anchor, F.goalsAlt),
        ast61: readU8(buf, anchor, F.assistsAlt),
      },
    })
  }
  return out
}

/** Same anchor pick as `parsePlayerStatsSummary` for one `player.dat` id. */
export function pickSummaryAnchorForPlayer(
  buf: Buffer,
  playerDatId: number,
  players: readonly PlayerRecord[],
): { anchor: number; decoded: PlayerSavePerformanceStats } | null {
  const full = parsePlayerStatsSummary(buf, players)
  const decoded = full.get(playerDatId)
  if (!decoded) return null

  const playerIds = new Set(players.map((p) => p.id))
  const len = buf.length
  const idHitCount = new Map<number, number>()
  const max76ByStatKey = new Map<number, Map<string, number>>()
  for (let anchor = 0; anchor <= len - 4; anchor++) {
    const pid = buf.readInt32LE(anchor)
    if (!playerIds.has(pid)) continue
    idHitCount.set(pid, (idHitCount.get(pid) ?? 0) + 1)
    if (anchor <= len - SLOT_GRID_MAX_REL && buf.readInt32LE(anchor + 4) === 0) {
      recordSeniorSlotBBase(buf, anchor, pid, max76ByStatKey)
    }
  }

  const maxApps91ByStatKey = new Map<number, Map<string, number>>()
  const gridPeaksByPlayer = new Map<number, GridExtraPeaks>()
  const anchorScanEnd = Math.max(0, len - GRID_EXTRA_MAX_REL)
  for (let anchor = 0; anchor <= anchorScanEnd; anchor++) {
    const pid = buf.readInt32LE(anchor)
    if (pid !== playerDatId) continue
    const hits = idHitCount.get(playerDatId) ?? 0
    if (isHighHitGridOnlyPlayer(hits)) {
      recordGridExtraPeaks(buf, anchor, pid, gridPeaksByPlayer)
    }
  }
  for (let anchor = 0; anchor <= len - SLOT_GRID_MAX_REL; anchor++) {
    const pid = buf.readInt32LE(anchor)
    if (pid !== playerDatId) continue
    if (buf.readInt32LE(anchor + 4) === 0) {
      recordSeniorSlotAApps(buf, anchor, pid, max76ByStatKey, maxApps91ByStatKey)
    }
  }

  let bestAnchor: number | null = null
  const peaks = gridPeaksByPlayer.get(playerDatId)
  for (let anchor = 0; anchor <= anchorScanEnd; anchor++) {
    if (buf.readInt32LE(anchor) !== playerDatId) continue
    const hits = idHitCount.get(playerDatId) ?? 0
    if (!isSummaryCandidateAnchor(buf, anchor, hits)) continue
    if (
      bestAnchor != null &&
      compareSummaryCandidates(buf, anchor, bestAnchor, hits, peaks) <= 0
    ) {
      continue
    }
    bestAnchor = anchor
  }
  if (bestAnchor == null) return null

  const hits = idHitCount.get(playerDatId) ?? 0
  const rec = offGridRecordStart(buf, bestAnchor, playerDatId, hits)
  const useSeniorAppsMerge =
    isSlotBSeniorAggregate(buf, bestAnchor) ||
    (rec != null && readU8(buf, bestAnchor, F.apps) < 1 && readSlotB(buf, bestAnchor) != null)

  if (!useSeniorAppsMerge) return { anchor: bestAnchor, decoded }

  const stats = readSummaryStatsAtAnchor(buf, bestAnchor, playerDatId, hits)!
  const key = seniorStatKey(stats.goals, stats.assists)
  const maxApps91 = maxApps91ByStatKey.get(playerDatId)?.get(key) ?? 0
  const max76 = max76ByStatKey.get(playerDatId)?.get(key) ?? 0
  const apps = resolveSeniorClubApps(stats, maxApps91, max76)
  return { anchor: bestAnchor, decoded: { ...decoded, apps } }
}
