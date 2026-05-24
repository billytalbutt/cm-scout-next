import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  archiveSiblingsLookOutOfSync,
  pickNewestArchivePath,
  readArchiveFromDisk,
  writeArchiveToDiskSiblings,
} from './archiveSync'

describe('archiveSync', () => {
  it('writes the same bytes to .sav and index.dat siblings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cm-archive-sync-'))
    try {
      const sav = join(dir, 'test.sav')
      const idx = join(dir, 'index.dat')
      writeFileSync(sav, Buffer.from('sav-v1'))
      writeFileSync(idx, Buffer.from('index-old'))

      const written = writeArchiveToDiskSiblings(sav, Buffer.from('patched'))
      expect(written.sort()).toEqual([idx, sav].sort())
      expect(readFileSync(sav).toString()).toBe('patched')
      expect(readFileSync(idx).toString()).toBe('patched')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reads the newest sibling by mtime', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cm-archive-sync-'))
    try {
      const sav = join(dir, 'test.sav')
      const idx = join(dir, 'index.dat')
      mkdirSync(dir, { recursive: true })
      writeFileSync(sav, Buffer.from('older'))
      writeFileSync(idx, Buffer.from('newer'))
      const past = new Date(Date.now() - 60_000)
      const future = new Date(Date.now() + 60_000)
      utimesSync(sav, past, past)
      utimesSync(idx, future, future)

      const picked = pickNewestArchivePath(sav)
      const { buffer } = readArchiveFromDisk(sav)
      expect([picked, buffer.toString()]).toEqual([idx, 'newer'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('flags out-of-sync siblings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cm-archive-sync-'))
    try {
      const sav = join(dir, 'test.sav')
      const idx = join(dir, 'index.dat')
      writeFileSync(sav, Buffer.alloc(100, 1))
      writeFileSync(idx, Buffer.alloc(200, 2))
      expect(archiveSiblingsLookOutOfSync(sav)?.length).toBe(2)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
