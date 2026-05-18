import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseIndexDat, readArchiveBlock } from './parser'
import {
  PLAYER_STATS_SUMMARY_FIELDS,
  decodePlayerStatsSummaryAtAnchor,
  parsePlayerStatsSummary,
} from './playerStatsSummary'
import type { PlayerRecord } from './types'

const BLACKBURN_SAV =
  process.env.CM0102_GOLDEN_SAV ??
  'C:/Users/bitalb/Downloads/Game/Game/Blackburn Uncompressed.sav'

describe('parsePlayerStatsSummary', () => {
  it('decodes apps/goals/assists at anchor+91..93', () => {
    const buf = Buffer.alloc(200, 0)
    const anchor = 40
    buf.writeInt32LE(118, anchor)
    buf.writeUInt8(10, anchor + PLAYER_STATS_SUMMARY_FIELDS.apps)
    buf.writeUInt8(2, anchor + PLAYER_STATS_SUMMARY_FIELDS.goals)
    buf.writeUInt8(1, anchor + PLAYER_STATS_SUMMARY_FIELDS.assists)
    const row = decodePlayerStatsSummaryAtAnchor(buf, anchor)
    expect(row).toMatchObject({ apps: 10, goals: 2, assists: 1, layout: 'summaryV1' })
  })

  it('picks aggregate row with small positive side fields over higher totals', () => {
    const buf = Buffer.alloc(400, 0)
    const players = [{ id: 7 } as PlayerRecord]
    const write = (
      anchor: number,
      apps: number,
      goals: number,
      assists: number,
      p20: number,
      p32: number,
    ) => {
      buf.writeInt32LE(7, anchor)
      buf.writeInt32LE(p20, anchor + 20)
      buf.writeInt32LE(p32, anchor + 32)
      buf.writeUInt8(apps, anchor + 91)
      buf.writeUInt8(goals, anchor + 92)
      buf.writeUInt8(assists, anchor + 93)
    }
    write(50, 14, 11, 2, 0, 0)
    write(200, 10, 2, 1, 3, 105)
    const map = parsePlayerStatsSummary(buf, players)
    expect(map.get(7)).toMatchObject({ apps: 10, goals: 2, assists: 1 })
  })

  it.skipIf(!existsSync(BLACKBURN_SAV))('Kieron Dyer matches CM Senior club totals on Blackburn save', () => {
    const file = readFileSync(BLACKBURN_SAV)
    const db = parseIndexDat(file)
    const statsBuf = readArchiveBlock(file, 'player stats.dat')
    expect(statsBuf).toBeTruthy()
    const map = parsePlayerStatsSummary(statsBuf!, db.players)
    const staff = db.staff.find((s) => s.id === 152)
    expect(staff).toBeTruthy()
    expect(db.players[staff!.player_id]!.id).toBe(118)
    expect(map.get(118)).toMatchObject({ apps: 10, goals: 2, assists: 1 })
  })
})
