import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseIndexDat, readArchiveBlock } from './parser'
import {
  PLAYER_STATS_SUMMARY_FIELDS,
  decodePlayerStatsSummaryAtAnchor,
  parsePlayerStatsSummary,
  readSummaryStatsAtAnchor,
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

  it('uses goals at +60 when +59 matches apps at +91 (CM duplicate slot)', () => {
    const buf = Buffer.alloc(300, 0)
    const anchor = 80
    buf.writeInt32LE(118, anchor)
    buf.writeUInt8(10, anchor + 59)
    buf.writeUInt8(2, anchor + 60)
    buf.writeUInt8(1, anchor + 61)
    buf.writeUInt8(10, anchor + 91)
    buf.writeUInt8(3, anchor + 92)
    buf.writeUInt8(1, anchor + 93)
    const stats = readSummaryStatsAtAnchor(buf, anchor)
    expect(stats).toEqual({ apps: 10, goals: 2, assists: 1 })
  })

  it('uses +91 apps when Senior slot +76 understates appearances', () => {
    const buf = Buffer.alloc(500, 0)
    const players = [{ id: 7 } as PlayerRecord]
    buf.writeInt32LE(7, 100)
    buf.writeUInt8(5, 100 + 76)
    buf.writeUInt8(1, 100 + 77)
    buf.writeUInt8(2, 100 + 78)
    buf.writeInt32LE(7, 400)
    buf.writeUInt8(10, 400 + 91)
    buf.writeUInt8(1, 400 + 77)
    buf.writeUInt8(2, 400 + 78)
    const map = parsePlayerStatsSummary(buf, players)
    expect(map.get(7)).toMatchObject({ apps: 10, goals: 1, assists: 2 })
  })

  it('picks higher +91 apps for same senior goals/assists when season advances', () => {
    const buf = Buffer.alloc(600, 0)
    const players = [{ id: 118 } as PlayerRecord]
    buf.writeInt32LE(118, 100)
    buf.writeUInt8(10, 100 + 76)
    buf.writeUInt8(1, 100 + 77)
    buf.writeUInt8(2, 100 + 78)
    buf.writeInt32LE(118, 350)
    buf.writeUInt8(11, 350 + 91)
    buf.writeUInt8(1, 350 + 77)
    buf.writeUInt8(2, 350 + 78)
    const map = parsePlayerStatsSummary(buf, players)
    expect(map.get(118)).toMatchObject({ apps: 11, goals: 1, assists: 2 })
  })

  it('reads Senior club totals from +76/+77/+78 when +91 is zero', () => {
    const buf = Buffer.alloc(200, 0)
    const anchor = 40
    buf.writeInt32LE(118, anchor)
    buf.writeUInt8(10, anchor + 76)
    buf.writeUInt8(1, anchor + 77)
    buf.writeUInt8(2, anchor + 78)
    const stats = readSummaryStatsAtAnchor(buf, anchor)
    expect(stats).toEqual({ apps: 10, goals: 1, assists: 2 })
  })

  it.skipIf(!existsSync(BLACKBURN_SAV))(
    'Joe Cole decodes embedded-id Senior club record (player.dat id 5451)',
    () => {
      const file = readFileSync(BLACKBURN_SAV)
      const db = parseIndexDat(file)
      const statsBuf = readArchiveBlock(file, 'player stats.dat')
      const map = parsePlayerStatsSummary(statsBuf!, db.players)
      expect(map.get(5451)).toMatchObject({ apps: 7, goals: 2, assists: 2 })
    },
    30_000,
  )

  it.skipIf(!existsSync(BLACKBURN_SAV))(
    'Joe Cole gains an appearance on progressed Blackburn save',
    () => {
      const progressed =
        process.env.CM0102_PROGRESS_SAV ??
        'C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'
      if (!existsSync(progressed)) return
      const file = readFileSync(progressed)
      const db = parseIndexDat(file)
      const statsBuf = readArchiveBlock(file, 'player stats.dat')
      const map = parsePlayerStatsSummary(statsBuf!, db.players)
      expect(map.get(5451)).toMatchObject({ apps: 9, goals: 2, assists: 2 })
    },
    30_000,
  )

  it.skipIf(!existsSync(BLACKBURN_SAV))(
    'Maxim Tsigalko decodes v4=-1 Senior club on Blackburn save',
    () => {
      const file = readFileSync(BLACKBURN_SAV)
      const db = parseIndexDat(file)
      const statsBuf = readArchiveBlock(file, 'player stats.dat')
      const map = parsePlayerStatsSummary(statsBuf!, db.players)
      expect(map.get(27755)).toMatchObject({ apps: 7, goals: 6, assists: 2 })
    },
    30_000,
  )

  it.skipIf(!existsSync(BLACKBURN_SAV))(
    'Maxim Tsigalko uses alt Senior slot when season advances',
    () => {
      const progressed =
        process.env.CM0102_PROGRESS_SAV ??
        'C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'
      if (!existsSync(progressed)) return
      const file = readFileSync(progressed)
      const db = parseIndexDat(file)
      const statsBuf = readArchiveBlock(file, 'player stats.dat')
      const map = parsePlayerStatsSummary(statsBuf!, db.players)
      expect(map.get(27755)).toMatchObject({ apps: 10, goals: 7, assists: 2 })
    },
    30_000,
  )

  it.skipIf(!existsSync(BLACKBURN_SAV))(
    'Kieron Dyer matches CM Senior club totals on Blackburn save',
    () => {
    const file = readFileSync(BLACKBURN_SAV)
    const db = parseIndexDat(file)
    const statsBuf = readArchiveBlock(file, 'player stats.dat')
    expect(statsBuf).toBeTruthy()
    const map = parsePlayerStatsSummary(statsBuf!, db.players)
    const staff = db.staff.find((s) => s.id === 152)
    expect(staff).toBeTruthy()
    expect(db.players[staff!.player_id]!.id).toBe(118)
    expect(map.get(118)).toMatchObject({ apps: 8, goals: 0, assists: 1 })
    },
    30_000,
  )

  it.skipIf(!existsSync(BLACKBURN_SAV))(
    'Kieron Dyer advances appearances on progressed Blackburn save',
    () => {
      const progressed =
        process.env.CM0102_PROGRESS_SAV ??
        'C:/Users/bitalb/Downloads/Blackburn_Uncompressed_New/Blackburn Uncompressed New.sav'
      if (!existsSync(progressed)) return
      const file = readFileSync(progressed)
      const db = parseIndexDat(file)
      const statsBuf = readArchiveBlock(file, 'player stats.dat')
      const map = parsePlayerStatsSummary(statsBuf!, db.players)
      expect(map.get(118)).toMatchObject({ apps: 11, goals: 1, assists: 2 })
      expect(map.get(27755)).toMatchObject({ apps: 10, goals: 7, assists: 2 })
    },
    30_000,
  )
})
