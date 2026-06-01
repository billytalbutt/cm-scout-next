import { MERLIN_LS } from '../../../shared/merlinStorageKeys'

const LS_KEY = MERLIN_LS.regenSeen

type RegenSeenEntry = {
  /** staff.dat person ids flagged as regen at last check */
  staffIds: string[]
  checkedAt: string
}

type Store = Record<string, RegenSeenEntry>

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

export function loadRegenSeen(pathKey: string | null): RegenSeenEntry | null {
  if (!pathKey) return null
  return readAll()[pathKey] ?? null
}

export function markRegensSeen(pathKey: string | null, staffIds: string[]): void {
  if (!pathKey) return
  const all = readAll()
  all[pathKey] = {
    staffIds: [...new Set(staffIds)],
    checkedAt: new Date().toISOString(),
  }
  writeAll(all)
}

export function clearRegenSeen(pathKey: string | null): void {
  if (!pathKey) return
  const all = readAll()
  delete all[pathKey]
  writeAll(all)
}

export function newRegenStaffIds(
  pathKey: string | null,
  currentRegenStaffIds: string[],
): string[] {
  if (!pathKey) return currentRegenStaffIds
  const prev = new Set(loadRegenSeen(pathKey)?.staffIds ?? [])
  return currentRegenStaffIds.filter((id) => !prev.has(id))
}
