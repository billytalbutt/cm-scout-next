/**
 * Probe Blackburn Rovers cash bytes in club.dat (golden save).
 */
import { readFileSync } from 'node:fs'
import { DEFAULT_GOLDEN_SAV } from '../fixtures/player-stats/goldenSavePath'
import { parseIndexDat } from '../src/main/database/parser'
import {
  buildPatchedArchiveForClubEdits,
  buildClubEditorSnapshot,
} from '../src/main/clubEditorSave'
import { CLUB_CASH_OFF } from '../src/main/database/clubStadiumDiskLayout'
import { CLUB_ROW_BYTES } from '../src/main/database/clubRecords'
import { readCashDisplay, writeCashDisplay, cm2LongToNormal } from '../src/shared/cm2LongFormat'

const SAVE = process.env.CM0102_GOLDEN_SAV ?? DEFAULT_GOLDEN_SAV

async function main() {
  const buf = readFileSync(SAVE)
  const db = await parseIndexDat(buf, { staffHistorySearchDirs: [] })
  const blackburn = [...(db.clubsById?.values() ?? [])].find((c) =>
    c.name.toLowerCase().includes('blackburn'),
  )
  if (!blackburn) {
    console.log('Blackburn not found')
    return
  }
  console.log('Club:', blackburn.id, blackburn.name, 'parsed cash £', blackburn.cash.toLocaleString())
  console.log('compressed:', db.compressed)

  const snap = buildClubEditorSnapshot(buf, db.blocks, db.compressed, db, blackburn.id)
  if ('error' in snap) {
    console.log('snapshot error:', snap.error)
    return
  }
  console.log('editor snapshot cash:', snap.values.cash?.toLocaleString())

  const clubBlock = db.blocks.find((b) => b.name === 'club.dat')
  if (!clubBlock) return
  const slice = buf.subarray(clubBlock.position, clubBlock.position + clubBlock.size)
  const row = Math.floor(
    [...Array(Math.floor(slice.length / CLUB_ROW_BYTES)).keys()].find(
      (i) => slice.readInt32LE(i * CLUB_ROW_BYTES) === blackburn.id,
    ) ?? -1,
  )
  const raw = slice.readInt32LE(row * CLUB_ROW_BYTES + CLUB_CASH_OFF)
  console.log('raw int32 @+101:', raw, '0x' + (raw >>> 0).toString(16))
  console.log('readCashDisplay(raw):', readCashDisplay(raw))
  console.log('cm2LongToNormal(raw):', cm2LongToNormal(raw), '×1000 =', cm2LongToNormal(raw) * 1000)

  const target = 50_000_000
  const patched = buildPatchedArchiveForClubEdits(buf, db.blocks, db.compressed, db, blackburn.id, {
    cash: target,
  })
  if (!patched.ok) {
    console.log('patch failed:', patched.error)
    return
  }
  const snap2 = buildClubEditorSnapshot(
    patched.buffer,
    db.blocks,
    db.compressed,
    db,
    blackburn.id,
  )
  if ('error' in snap2) {
    console.log('post-patch snapshot error:', snap2.error)
    return
  }
  console.log('\nAfter patch to £50M:')
  console.log('  snapshot cash:', snap2.values.cash?.toLocaleString())
  const slice2 = patched.buffer.subarray(clubBlock.position, clubBlock.position + clubBlock.size)
  const raw2 = slice2.readInt32LE(row * CLUB_ROW_BYTES + CLUB_CASH_OFF)
  console.log('  raw:', raw2, '0x' + (raw2 >>> 0).toString(16))
  console.log('  readCashDisplay:', readCashDisplay(raw2))
  console.log('  writeCashDisplay(50M):', writeCashDisplay(target), '0x' + (writeCashDisplay(target) >>> 0).toString(16))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
