import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parseIndexDat } from './parser'
import type { PlayerSavePerformanceStats } from './types'

const goldenSav = process.env.CM0102_GOLDEN_SAV
const goldenJsonPath = process.env.CM0102_GOLDEN_JSON

type GoldenPerComp = {
  competitionId: number
  apps: number
  goals: number
  assists?: number | null
  averageRating?: number | null
}

type GoldenEntry = {
  apps: number | null
  goals: number | null
  assists: number | null
  averageRating?: number | null
  layout?: PlayerSavePerformanceStats['layout']
  perCompetition?: GoldenPerComp[]
}

type GoldenFile = Record<string, GoldenEntry>

describe('player stats.dat golden (integration)', () => {
  const run = Boolean(goldenSav && goldenJsonPath)

  it.skipIf(!run)('parsed savePerformance matches golden JSON', async () => {
    const savPath = goldenSav!
    const jsonPath = goldenJsonPath!
    const file = await readFile(savPath)
    const db = parseIndexDat(file)
    const actual = db.savePerformanceByPlayerDatId
    expect(actual, 'save block present').toBeDefined()

    const raw = JSON.parse(await readFile(jsonPath, 'utf8')) as GoldenFile
    for (const [idStr, expected] of Object.entries(raw)) {
      const id = Number(idStr)
      expect(Number.isFinite(id), `invalid player id key: ${idStr}`).toBe(true)
      const got = actual!.get(id)
      expect(got, `missing stats for player.dat id ${id}`).toBeDefined()
      expect(got!.apps).toBe(expected.apps)
      expect(got!.goals).toBe(expected.goals)
      expect(got!.assists).toBe(expected.assists)
      if (expected.averageRating !== undefined) {
        expect(got!.averageRating).toBe(expected.averageRating)
      }
      if (expected.layout != null) {
        expect(got!.layout).toBe(expected.layout)
      }
      if (expected.perCompetition?.length) {
        const perComp = db.savePerformancePerCompByPlayerDatId?.get(id)
        expect(perComp?.length).toBe(expected.perCompetition.length)
        for (let i = 0; i < expected.perCompetition.length; i++) {
          const exp = expected.perCompetition[i]!
          const row = perComp!.find((r) => r.competitionId === exp.competitionId)
          expect(row, `missing per-comp row compId=${exp.competitionId}`).toBeDefined()
          expect(row!.apps).toBe(exp.apps)
          expect(row!.goals).toBe(exp.goals)
          if (exp.assists !== undefined) expect(row!.assists).toBe(exp.assists)
          if (exp.averageRating !== undefined) expect(row!.averageRating).toBe(exp.averageRating)
        }
      }
    }
  })
})
