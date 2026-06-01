/**

 * Integration proof: bank balance bytes in a real CM0102 `.sav` change on disk after

 * the same patch path Merlin uses (`buildPatchedArchiveForClubEdits` + writeFileSync).

 *

 * Requires a local uncompressed save (default: Blackburn Uncompressed.sav).

 * Override: CM0102_GOLDEN_SAV, optional CM0102_PROGRESS_SAV for second save.

 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { tmpdir } from 'node:os'

import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {

  DEFAULT_GOLDEN_SAV,

  DEFAULT_PROGRESS_SAV,

} from '../../../fixtures/player-stats/goldenSavePath'

import { buildPatchedArchiveForClubEdits, findHumanManagedClubId } from '../clubEditorSave'

import {

  clubCashAbsoluteOffset,

  patchClubCashOnArchive,

  verifyClubCashOnArchive,

} from './clubCashPatch'

import { CLUB_CASH_OFF } from './clubStadiumDiskLayout'

import { CLUB_ROW_BYTES } from './clubRecords'

import { loadSaveBlocksFast } from './saveBlocksFast'

import { parseIndexDat } from './parser'

import { findBlock } from './playerStaffDiskLayout'



const MARKER_POUNDS = 99_000_000

const INTEGRATION_TIMEOUT_MS = 120_000



type SaveCase = { label: string; path: string }



function saveCases(): SaveCase[] {

  const out: SaveCase[] = []

  if (existsSync(DEFAULT_GOLDEN_SAV)) out.push({ label: 'golden', path: DEFAULT_GOLDEN_SAV })

  if (existsSync(DEFAULT_PROGRESS_SAV) && DEFAULT_PROGRESS_SAV !== DEFAULT_GOLDEN_SAV) {

    out.push({ label: 'progress', path: DEFAULT_PROGRESS_SAV })

  }

  return out

}



function findClubIdByName(clubs: Map<number, { name: string }>, needle: string): number | null {

  for (const [id, c] of clubs) {

    if (c.name.toLowerCase().includes(needle.toLowerCase())) return id

  }

  return null

}



function cashRawAt(

  archive: Buffer,

  blocks: ReturnType<typeof loadSaveBlocksFast>['blocks'],

  clubId: number,

): { raw: number; display: number; offset: number } | { error: string } {

  const off = clubCashAbsoluteOffset(archive, blocks, clubId)

  if (typeof off !== 'number') return { error: off.error }

  const raw = archive.readInt32LE(off)

  return {

    raw,

    display: raw,

    offset: off,

  }

}



/** Full Merlin in-place save simulation on a temp copy of the save file. */

function simulateInPlaceClubSave(

  sourcePath: string,

  clubId: number,

  values: Record<string, number>,

  blocks: ReturnType<typeof loadSaveBlocksFast>['blocks'],

  compressed: boolean,

  dbMinimal: Parameters<typeof buildPatchedArchiveForClubEdits>[3],

): {

  tempPath: string

  before: { raw: number; display: number; offset: number }

  after: { raw: number; display: number; offset: number }

} {

  const original = readFileSync(sourcePath)

  const beforeCash = cashRawAt(original, blocks, clubId)

  if ('error' in beforeCash) throw new Error(beforeCash.error)



  const built = buildPatchedArchiveForClubEdits(

    original,

    blocks,

    compressed,

    dbMinimal,

    clubId,

    values,

  )

  if (!built.ok) throw new Error(built.error)



  const dir = mkdtempSync(join(tmpdir(), 'cm-merlin-cash-int-'))

  const tempPath = join(dir, 'patched.sav')

  writeFileSync(tempPath, built.buffer)

  const fromDisk = readFileSync(tempPath)



  const verified = verifyClubCashOnArchive(fromDisk, blocks, clubId, values.cash!)

  if (!verified.ok) throw new Error(verified.error)



  const afterCash = cashRawAt(fromDisk, blocks, clubId)

  if ('error' in afterCash) throw new Error(afterCash.error)



  return {

    tempPath,

    before: beforeCash,

    after: afterCash,

  }

}



describe('club cash on real save (integration)', () => {

  const cases = saveCases()

  const run = cases.length > 0



  it.skipIf(!run)('save files are present for integration tests', () => {

    expect(cases.length).toBeGreaterThan(0)

  })



  describe.each(cases)('$label save ($path)', ({ path }) => {

    it.skipIf(!run)(

      'TClub.Cash @ byte 101 changes on disk after full Merlin save path',

      async () => {

        const fast = loadSaveBlocksFast(path)

        expect(fast.compressed, 'needs uncompressed save').toBe(false)



        const clubId = findClubIdByName(fast.clubsById, 'Blackburn') ?? findClubIdByName(fast.clubsById, 'Rovers')

        expect(clubId, 'Blackburn Rovers in save').not.toBeNull()

        const id = clubId!



        const result = simulateInPlaceClubSave(path, id, { cash: MARKER_POUNDS }, fast.blocks, fast.compressed, {
          clubsById: fast.clubsById,
        } as Parameters<typeof buildPatchedArchiveForClubEdits>[3])



        expect(result.before.display, 'sanity: before != marker').not.toBe(MARKER_POUNDS)

        expect(result.after.display).toBe(MARKER_POUNDS)

        expect(result.after.raw, 'raw int32 on disk').not.toBe(result.before.raw)



        const disk = readFileSync(result.tempPath)

        const clubBlock = findBlock(fast.blocks, 'club.dat')!

        const blockEnd = clubBlock.position + clubBlock.size

        expect(result.after.offset).toBeGreaterThanOrEqual(clubBlock.position)

        expect(result.after.offset + 4).toBeLessThanOrEqual(blockEnd)



        const newRaw = disk.readInt32LE(result.after.offset)

        expect(newRaw).toBe(result.after.raw)

        expect(newRaw).toBe(MARKER_POUNDS)



        const clubAfter = loadSaveBlocksFast(path, disk).clubsById.get(id)

        expect(clubAfter?.cash, 'parseClubRecords agrees').toBe(MARKER_POUNDS)



        rmSync(join(result.tempPath, '..'), { recursive: true, force: true })

      },

      INTEGRATION_TIMEOUT_MS,

    )



    it.skipIf(!run)(

      'only the target club row cash changes in club.dat (not every club)',

      () => {

        const fast = loadSaveBlocksFast(path)

        const clubId = findClubIdByName(fast.clubsById, 'Blackburn')!

        const clubBlock = findBlock(fast.blocks, 'club.dat')!

        const before = fast.file.subarray(clubBlock.position, clubBlock.position + clubBlock.size)



        const out = Buffer.from(fast.file)

        const patch = patchClubCashOnArchive(out, fast.blocks, clubId, MARKER_POUNDS)

        expect(patch.ok).toBe(true)

        const after = out.subarray(clubBlock.position, clubBlock.position + clubBlock.size)



        let changedRows = 0

        const n = Math.floor(before.length / CLUB_ROW_BYTES)

        for (let i = 0; i < n; i++) {

          const b = before.subarray(i * CLUB_ROW_BYTES, (i + 1) * CLUB_ROW_BYTES)

          const a = after.subarray(i * CLUB_ROW_BYTES, (i + 1) * CLUB_ROW_BYTES)

          if (!b.equals(a)) {

            changedRows++

            if (b.readInt32LE(0) === clubId) {

              expect(a.readInt32LE(CLUB_CASH_OFF), 'target row cash updated').toBe(

                out.readInt32LE(clubBlock.position + i * CLUB_ROW_BYTES + CLUB_CASH_OFF),

              )

            }

          }

        }

        expect(changedRows, 'rows changed in club.dat').toBe(1)

      },

      INTEGRATION_TIMEOUT_MS,

    )



    it.skipIf(!run)(

      'human managed club id is known (for editor warnings)',

      async () => {

        const fast = loadSaveBlocksFast(path)

        const db = parseIndexDat(fast.file, { staffHistorySearchDirs: [] })

        const humanId = findHumanManagedClubId(db)

        expect(humanId, 'playable manager club in save').not.toBeNull()

        expect(humanId!).toBeGreaterThan(0)

        const cash = cashRawAt(fast.file, fast.blocks, humanId!)

        expect('error' in cash).toBe(false)

      },

      INTEGRATION_TIMEOUT_MS,

    )



    it.skipIf(!run)(

      'club row index equals club id (CM save layout)',

      () => {

        const fast = loadSaveBlocksFast(path)

        const clubBlock = findBlock(fast.blocks, 'club.dat')!

        const slice = fast.file.subarray(clubBlock.position, clubBlock.position + clubBlock.size)

        let mismatches = 0

        const n = Math.floor(slice.length / CLUB_ROW_BYTES)

        for (let i = 0; i < n; i++) {

          const id = slice.readInt32LE(i * CLUB_ROW_BYTES)

          if (id > 0 && id !== i) mismatches++

        }

        expect(mismatches, 'id !== row index count').toBe(0)

      },

      INTEGRATION_TIMEOUT_MS,

    )



    it.skipIf(!run)(

      'parsed club cash matches raw bytes at offset 101 before patch',

      () => {

        const fast = loadSaveBlocksFast(path)

        const clubId = findClubIdByName(fast.clubsById, 'Blackburn')!

        const disk = cashRawAt(fast.file, fast.blocks, clubId)

        const parsed = fast.clubsById.get(clubId)

        expect('error' in disk).toBe(false)

        expect(parsed?.cash).toBe(disk.display)

      },

      INTEGRATION_TIMEOUT_MS,

    )

  })

})


