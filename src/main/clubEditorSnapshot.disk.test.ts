/**
 * Proves club editor snapshot reads cash from on-disk club.dat (same as integration patch tests).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_GOLDEN_SAV } from '../../fixtures/player-stats/goldenSavePath'
import { buildClubEditorSnapshot } from './clubEditorSave'
import { loadSaveBlocksFast } from './database/saveBlocksFast'
import { patchClubCashOnArchive } from './database/clubCashPatch'
import { readArchiveFromDisk } from './archiveSync'
import { readArchiveBlock } from './database/parser'
import { parseStadiumRecords } from './database/stadiumRecords'
import type { ParsedDatabase } from './database/types'

function miniDb(fast: ReturnType<typeof loadSaveBlocksFast>): ParsedDatabase {
  const stadiumBuf = readArchiveBlock(fast.file, 'stadium.dat')
  return {
    compressed: fast.compressed,
    clubsById: fast.clubsById,
    stadiumsById: stadiumBuf ? parseStadiumRecords(stadiumBuf) : new Map(),
    nationNames: new Map(),
    clubNames: new Map(),
    staff: [],
    players: [],
    blocks: fast.blocks,
  } as ParsedDatabase
}

const run = existsSync(DEFAULT_GOLDEN_SAV)

describe.skipIf(!run)('buildClubEditorSnapshot vs disk', () => {
  it('snapshot cash matches club.dat after external disk change', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cm-snap-disk-'))
    const copyPath = join(dir, 'test.sav')
    try {
      writeFileSync(copyPath, readFileSync(DEFAULT_GOLDEN_SAV))
      let fast = loadSaveBlocksFast(copyPath)
      let clubId = 0
      for (const [id, c] of fast.clubsById) {
        if (c.name.toLowerCase().includes('blackburn')) {
          clubId = id
          break
        }
      }
      expect(clubId).toBeGreaterThan(0)

      const db = miniDb(fast)
      const before = buildClubEditorSnapshot(fast.file, fast.blocks, fast.compressed, db, clubId)
      expect('error' in before).toBe(false)
      if ('error' in before) return

      const target = 99_000_000
      const out = Buffer.from(fast.file)
      const patch = patchClubCashOnArchive(out, fast.blocks, clubId, target)
      expect(patch.ok).toBe(true)
      writeFileSync(copyPath, out)

      const { buffer } = readArchiveFromDisk(copyPath)
      fast = loadSaveBlocksFast(copyPath, buffer)
      const after = buildClubEditorSnapshot(buffer, fast.blocks, fast.compressed, miniDb(fast), clubId)
      expect('error' in after).toBe(false)
      if ('error' in after) return

      expect(after.values.cash).toBe(target)
      expect(before.values.cash).not.toBe(target)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
