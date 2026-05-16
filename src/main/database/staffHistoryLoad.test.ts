import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectStaffHistorySearchDirs, loadStaffHistoryForArchive } from './staffHistoryLoad'

const GAME_DATA = 'C:/Users/bitalb/Downloads/Game/Game/Data'
const HAS_GAME_DATA = existsSync(join(GAME_DATA, 'staff_history.dat'))

function norm(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase()
}

describe('collectStaffHistorySearchDirs', () => {
  it('includes Game/Data when loading a save under Downloads/Game', () => {
    const dirs = collectStaffHistorySearchDirs('C:/Users/bitalb/Downloads/Game/Game/Blackburn.sav')
    expect(dirs.some((d) => norm(d) === norm(GAME_DATA))).toBe(true)
  })
})

describe.skipIf(!HAS_GAME_DATA)('loadStaffHistoryForArchive', () => {
  it('loads staff_history.dat from Game/Data for Blackburn install layout', () => {
    const dirs = collectStaffHistorySearchDirs('C:/Users/bitalb/Downloads/Game/Game/test.sav')
    const result = loadStaffHistoryForArchive(null, dirs)
    expect(result.parsed).toBe(true)
    expect(result.byStaffId?.size).toBeGreaterThan(1000)
    expect(result.sourcePath).toContain('staff_history.dat')
    const withHistory = [...(result.byStaffId?.values() ?? [])].find((rows) => rows.length > 0)
    expect(withHistory?.length).toBeGreaterThan(0)
  })
})
