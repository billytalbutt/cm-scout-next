import type { PitchSlot } from '../../../shared/tacticsPitchSnap'

const LS_KEY = 'cm-scout-next-tactics-layout-v1'

type Store = Record<string, PitchSlot[]>

function readAll(): Store {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Store
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(data: Store): void {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

export function loadSavedTacticsLayout(dbPath: string | null): PitchSlot[] | null {
  if (!dbPath) return null
  const slots = readAll()[dbPath]
  if (!Array.isArray(slots) || slots.length === 0) return null
  return slots.filter(
    (s) =>
      s &&
      typeof s.id === 'string' &&
      typeof s.role === 'string' &&
      typeof s.x === 'number' &&
      typeof s.y === 'number',
  ) as PitchSlot[]
}

export function saveTacticsLayout(dbPath: string | null, slots: PitchSlot[]): void {
  if (!dbPath) return
  const all = readAll()
  all[dbPath] = slots
  writeAll(all)
}

export function clearSavedTacticsLayout(dbPath: string | null): void {
  if (!dbPath) return
  const all = readAll()
  delete all[dbPath]
  writeAll(all)
}
