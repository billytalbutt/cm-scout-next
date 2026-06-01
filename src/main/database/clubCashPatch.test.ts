import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CLUB_CASH_OFF } from './clubStadiumDiskLayout'
import { CLUB_ROW_BYTES } from './clubRecords'
import {
  clampClubCashPounds,
  clubCashAbsoluteOffset,
  patchClubCashOnArchive,
  verifyClubCashOnArchive,
} from './clubCashPatch'
import type { BlockInfo } from './types'

function miniArchive(clubId: number, cashRaw: number): { buf: Buffer; blocks: BlockInfo[] } {
  const clubBlockPos = 500
  const buf = Buffer.alloc(4000)
  const clubBase = clubBlockPos + 2 * CLUB_ROW_BYTES
  buf.writeInt32LE(clubId, clubBase)
  buf.writeInt32LE(cashRaw, clubBase + CLUB_CASH_OFF)
  buf.writeInt32LE(1, clubBase + 105)
  const blocks: BlockInfo[] = [
    { name: 'club.dat', position: clubBlockPos, size: CLUB_ROW_BYTES * 5, compressed: false },
  ]
  return { buf, blocks }
}

describe('clubCashPatch (plain int32 pounds)', () => {
  it('writes plain pounds directly and verifies', () => {
    const clubId = 42
    const { buf, blocks } = miniArchive(clubId, 72_000_000)
    const patched = patchClubCashOnArchive(buf, blocks, clubId, 60_000_000)
    expect(patched.ok).toBe(true)
    const off = clubCashAbsoluteOffset(buf, blocks, clubId)
    expect(typeof off).toBe('number')
    if (typeof off !== 'number') return
    expect(buf.readInt32LE(off)).toBe(60_000_000)
    expect(verifyClubCashOnArchive(buf, blocks, clubId, 60_000_000).ok).toBe(true)
  })

  it('reads the exact in-game balance back (e.g. £34,193,944)', () => {
    const clubId = 3
    const { buf, blocks } = miniArchive(clubId, 34_193_944)
    const off = clubCashAbsoluteOffset(buf, blocks, clubId)
    if (typeof off !== 'number') return
    expect(buf.readInt32LE(off)).toBe(34_193_944)
  })

  it('supports negative balances (club in debt)', () => {
    const clubId = 9
    const { buf, blocks } = miniArchive(clubId, 50_000_000)
    const patched = patchClubCashOnArchive(buf, blocks, clubId, -5_250_000)
    expect(patched.ok).toBe(true)
    const off = clubCashAbsoluteOffset(buf, blocks, clubId)
    if (typeof off !== 'number') return
    expect(buf.readInt32LE(off)).toBe(-5_250_000)
    expect(verifyClubCashOnArchive(buf, blocks, clubId, -5_250_000).ok).toBe(true)
  })

  it('clamps to the ±£2bn int32-safe range', () => {
    expect(clampClubCashPounds(5_000_000_000)).toBe(2_000_000_000)
    expect(clampClubCashPounds(-5_000_000_000)).toBe(-2_000_000_000)
    expect(clampClubCashPounds(34_193_944)).toBe(34_193_944)
  })

  it('survives writeFileSync + readFileSync round-trip', () => {
    const clubId = 7
    const { buf, blocks } = miniArchive(clubId, 11_000_000)
    patchClubCashOnArchive(buf, blocks, clubId, 99_000_000)
    const dir = mkdtempSync(join(tmpdir(), 'cm-merlin-cash-'))
    const path = join(dir, 'test.sav')
    try {
      writeFileSync(path, buf)
      const disk = readFileSync(path)
      expect(verifyClubCashOnArchive(disk, blocks, clubId, 99_000_000).ok).toBe(true)
      const off = clubCashAbsoluteOffset(disk, blocks, clubId)
      if (typeof off === 'number') {
        expect(disk.readInt32LE(off)).toBe(99_000_000)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
