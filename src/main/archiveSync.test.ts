import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  archiveSiblingsLookOutOfSync,
  pickNewestArchivePath,
  readArchiveFromDisk,
  readUserSelectedArchiveFromDisk,
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

  it('pickNewestArchivePath chooses newest sibling by mtime', () => {
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

      expect(pickNewestArchivePath(sav)).toBe(idx)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('readUserSelectedArchiveFromDisk reads the path you pass even if a sibling is newer', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cm-archive-sync-'))
    try {
      const sav = join(dir, 'test.sav')
      const idx = join(dir, 'index.dat')
      mkdirSync(dir, { recursive: true })
      writeFileSync(sav, Buffer.from('from-sav'))
      writeFileSync(idx, Buffer.from('from-index'))
      const past = new Date(Date.now() - 60_000)
      const future = new Date(Date.now() + 60_000)
      utimesSync(sav, past, past)
      utimesSync(idx, future, future)

      const { buffer, readPath } = readUserSelectedArchiveFromDisk(sav)
      expect(readPath).toBe(sav)
      expect(buffer.toString()).toBe('from-sav')

      const newest = readArchiveFromDisk(sav)
      expect(newest.readPath).toBe(idx)
      expect(newest.buffer.toString()).toBe('from-index')
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
