import { describe, expect, it } from 'vitest'
import { PROFILE_SEASON_SCOPE_ORDER } from './playerStatsCurrentSeason'
import {
  SEASON_COMP_RECORD_BYTES,
  buildSeasonCompIndex,
  classifyCompScope,
} from './seasonCompStats'
import type { ClubCompRecord } from './clubComp'
import type { PlayerRecord, StaffRecord } from './types'

function rec(opts: {
  pid: number
  staffId: number
  club: number
  apps: number
  goals: number
  assists: number
  mom: number
  ratingSum: number
  dribbles: number
}): Buffer {
  const b = Buffer.alloc(SEASON_COMP_RECORD_BYTES)
  b.writeUInt32LE(opts.pid, 0)
  b.writeUInt32LE(opts.staffId, 4)
  b.writeUInt32LE(opts.club, 8)
  b.writeUInt16LE(opts.apps, 12)
  b.writeUInt8(opts.goals, 14)
  b.writeUInt8(opts.assists, 18)
  b.writeUInt8(opts.mom, 22)
  b.writeUInt16LE(opts.ratingSum, 26)
  b.writeUInt8(opts.dribbles, 35)
  return b
}

/** Wrap a record in a block with a leading header (records are not at offset 0 in real files). */
function block(records: Buffer[], headerBytes = 17): Buffer {
  return Buffer.concat([Buffer.alloc(headerBytes, 0xab), ...records])
}

const player = (id: number): PlayerRecord => ({ id } as unknown as PlayerRecord)
const staffRow = (id: number, playerIdx: number): StaffRecord =>
  ({ id, player_id: playerIdx, int_apps: 0, int_goals: 0 } as unknown as StaffRecord)

const clubComp = (threeLetter: string, nationId: number): ClubCompRecord =>
  ({ id: 0, name: 'C', shortName: '', threeLetter, nationId, reputation: 0 } as ClubCompRecord)

describe('classifyCompScope', () => {
  const leagues = new Set<number>([7])
  it('league via division pointer or code; continental via nationless; else cup', () => {
    expect(classifyCompScope(7, undefined, leagues)).toBe('league')
    expect(classifyCompScope(38, clubComp('PRM', 179), new Set())).toBe('league')
    expect(classifyCompScope(326, clubComp('', -1), new Set())).toBe('continental')
    expect(classifyCompScope(350, clubComp('', 179), new Set())).toBe('cup')
    expect(classifyCompScope(999, undefined, new Set())).toBeNull()
  })
})

describe('buildSeasonCompIndex', () => {
  const players: PlayerRecord[] = []
  players[100] = player(100)
  const staff: StaffRecord[] = [staffRow(200, 100)]
  const clubComps = new Map<number, ClubCompRecord>([
    [38, clubComp('PRM', 179)], // league
    [350, clubComp('', 179)], // cup
    [326, clubComp('', -1)], // continental
  ])

  it('decodes verified offsets and aggregates Senior = League + Cup + Continental', () => {
    const compBlocks = [
      { compId: 38, buf: block([rec({ pid: 100, staffId: 200, club: 5, apps: 15, goals: 0, assists: 4, mom: 2, ratingSum: 116, dribbles: 62 })]) },
      { compId: 350, buf: block([rec({ pid: 100, staffId: 200, club: 5, apps: 2, goals: 1, assists: 1, mom: 1, ratingSum: 17, dribbles: 5 })]) },
      { compId: 326, buf: block([rec({ pid: 100, staffId: 200, club: 5, apps: 1, goals: 0, assists: 1, mom: 0, ratingSum: 8, dribbles: 9 })]) },
    ]
    const idx = buildSeasonCompIndex(compBlocks, staff, players, clubComps, new Set())
    const p = idx.get(100)
    expect(p).toBeTruthy()
    if (!p) return
    expect([p.leagueApps, p.leagueGoals, p.leagueAssists]).toEqual([15, 0, 4])
    expect([p.cupApps, p.cupGoals, p.cupAssists]).toEqual([2, 1, 1])
    expect([p.continentalApps, p.continentalGoals, p.continentalAssists]).toEqual([1, 0, 1])
    // Senior club = sum of the three scopes
    expect([p.seniorApps, p.seniorGoals, p.seniorAssists]).toEqual([18, 1, 6])
    // Avg rating = total rating sum / total apps = (116+17+8)/18 = 7.83
    expect(p.seniorAvgRating).toBeCloseTo(7.83, 2)
    // League avg = 116/15 = 7.73 (golden Meysam Javan)
    const league = p.scopes.find((s) => s.key === 'league')
    expect(league?.averageRating).toBeCloseTo(7.73, 2)
    expect(p.byCompetition).toHaveLength(3)
    expect(p.available).toBe(true)
  })

  it('rejects records whose staffId does not link to the player id', () => {
    const compBlocks = [
      { compId: 38, buf: block([rec({ pid: 100, staffId: 999, club: 5, apps: 15, goals: 0, assists: 4, mom: 2, ratingSum: 116, dribbles: 62 })]) },
    ]
    const idx = buildSeasonCompIndex(compBlocks, staff, players, clubComps, new Set())
    expect(idx.size).toBe(0)
  })

  it('reads goals as u8 at offset 14 (IFK Göteborg golden)', () => {
    const compBlocks = [
      {
        compId: 38,
        buf: block([
          rec({
            pid: 51985,
            staffId: 81267,
            club: 0,
            apps: 14,
            goals: 2,
            assists: 1,
            mom: 6,
            ratingSum: 100,
            dribbles: 0,
          }),
        ]),
      },
    ]
    const players: PlayerRecord[] = []
    players[51985] = player(51985)
    const staff: StaffRecord[] = [staffRow(81267, 51985)]
    const idx = buildSeasonCompIndex(compBlocks, staff, players, clubComps, new Set([38]))
    const p = idx.get(51985)!
    expect(p.leagueGoals).toBe(2)
    expect(p.leagueApps).toBe(14)
  })

  it('profile scopes omit International and Non Competitive rows', () => {
    const compBlocks = [
      { compId: 38, buf: block([rec({ pid: 100, staffId: 200, club: 5, apps: 10, goals: 2, assists: 1, mom: 1, ratingSum: 70, dribbles: 10 })]) },
    ]
    const idx = buildSeasonCompIndex(compBlocks, staff, players, clubComps, new Set())
    const keys = idx.get(100)!.scopes.map((s) => s.key)
    expect(keys).toEqual([...PROFILE_SEASON_SCOPE_ORDER])
    expect(keys).not.toContain('international')
  })
})
