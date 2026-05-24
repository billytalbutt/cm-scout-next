/**
 * Fast save introspection without full `parseIndexDat` (large saves take minutes).
 */
import { readFileSync } from 'node:fs'
import { readArchiveBlock, readBlocksDirectory } from './parser'
import { parseClubRecords } from './clubRecords'
import type { BlockInfo, ClubRecord } from './types'

export type FastSaveIndex = {
  file: Buffer
  compressed: boolean
  blocks: BlockInfo[]
  clubsById: Map<number, ClubRecord>
}

export function loadSaveBlocksFast(path: string, file?: Buffer): FastSaveIndex {
  const buf = file ?? readFileSync(path)
  const { compressed, blocks } = readBlocksDirectory(buf)
  const clubBuf = readArchiveBlock(buf, 'club.dat')
  if (!clubBuf) throw new Error('Archive is missing club.dat.')
  return {
    file: buf,
    compressed,
    blocks,
    clubsById: parseClubRecords(clubBuf),
  }
}
