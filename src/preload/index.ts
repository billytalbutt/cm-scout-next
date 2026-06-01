import { contextBridge, ipcRenderer } from 'electron'
import type { DatabaseLoadProgress } from '../shared/loadProgress'

contextBridge.exposeInMainWorld('cmapi', {
  onDatabaseLoadProgress: (handler: (p: DatabaseLoadProgress) => void) => {
    const listener = (_e: unknown, p: DatabaseLoadProgress) => handler(p)
    ipcRenderer.on('database-load-progress', listener)
    return () => {
      ipcRenderer.removeListener('database-load-progress', listener)
    }
  },
  getDatabaseStatus: () =>
    ipcRenderer.invoke('get-database-status') as Promise<
      | { loaded: false }
      | { loaded: true; path: string; playableCount: number; staffDatRows: number }
    >,
  openDatabase: () =>
    ipcRenderer.invoke('open-database') as Promise<
      | {
          ok: true
          path: string
          compressed: boolean
          gameDate: string | null
          playerCount: number
          staffDatRows: number
          playerBlobRows: number
          clubs: string[]
          nations: string[]
          regenBaseline: {
            active: boolean
            savedAt?: string
            entryCount?: number
            indexPath?: string
            tracksDevelopment?: boolean
            snapshotVersion?: 1 | 2
          }
        }
      | { ok: false; error: string }
    >,
  getRows: (filter: Record<string, unknown>) =>
    ipcRenderer.invoke('get-rows', filter) as Promise<{
      total: number
      rows: Array<Record<string, unknown>>
      offset: number
      capped: boolean
    }>,
  getStaffRows: (filter: Record<string, unknown>) =>
    ipcRenderer.invoke('get-staff-rows', filter) as Promise<{
      total: number
      rows: Array<Record<string, unknown>>
      offset: number
      capped: boolean
    }>,
  getClubRows: (filter: Record<string, unknown>) =>
    ipcRenderer.invoke('get-club-rows', filter) as Promise<{
      total: number
      rows: Array<Record<string, unknown>>
      offset: number
      capped: boolean
    }>,
  getClubDetail: (clubId: number) => ipcRenderer.invoke('get-club-detail', clubId),
  getClubSquadGridRows: (clubId: number) =>
    ipcRenderer.invoke('get-club-squad-grid-rows', clubId) as Promise<Array<Record<string, unknown>>>,
  pickWorldXi: (pitchSlots: Array<{ id: string; role: string; x: number; y: number; arrow: string }>) =>
    ipcRenderer.invoke('pick-world-xi', pitchSlots) as Promise<
      | {
          ok: true
          assignments: Record<string, { staffIndex: number; name: string; rolePercent: number | null }>
          filled: number
        }
      | { ok: false; error: string }
    >,
  getProfile: (staffIndex: number) => ipcRenderer.invoke('get-profile', staffIndex),
  getStaffProfile: (staffIndex: number) => ipcRenderer.invoke('get-staff-profile', staffIndex),
  openProfileWindow: (args: {
    staffIndex: number
    kind: 'player' | 'staff'
    navigation?: import('../shared/profileNavigation').ProfileNavigationContext
  }) =>
    ipcRenderer.invoke('open-profile-window', args) as Promise<
      { ok: true } | { ok: false; error: string }
    >,
  profileWindowNavigate: (direction: 'next' | 'prev', staffIndex?: number) =>
    ipcRenderer.invoke('profile-window-navigate', { direction, staffIndex }) as Promise<
      { ok: true; staffIndex: number } | { ok: false; error: string }
    >,
  profileWindowNavState: (staffIndex?: number) =>
    ipcRenderer.invoke('profile-window-nav-state', { staffIndex }) as Promise<
      | { ok: true; hasNav: false }
      | { ok: true; hasNav: true; index: number; total: number; source: string }
      | { ok: false; error: string }
    >,
  onProfilePopoutSelection: (handler: (staffIndex: number) => void) => {
    const listener = (_e: unknown, payload: { staffIndex?: number }) => {
      const si = Math.floor(Number(payload?.staffIndex))
      if (Number.isFinite(si) && si >= 0) handler(si)
    }
    ipcRenderer.on('profile-popout-selection', listener)
    return () => {
      ipcRenderer.removeListener('profile-popout-selection', listener)
    }
  },
  getEffectivenessDetail: (staffIndex: number) => ipcRenderer.invoke('get-effectiveness-detail', staffIndex),
  saveRegenBaseline: () => ipcRenderer.invoke('save-regen-baseline'),
  clearRegenBaseline: () => ipcRenderer.invoke('clear-regen-baseline'),
  getDevelopmentRows: (filter: Record<string, unknown>) =>
    ipcRenderer.invoke('get-development-rows', filter),
  getPlayerDevelopmentDetail: (staffIndex: number) =>
    ipcRenderer.invoke('get-player-development-detail', staffIndex),
  getEditorSnapshot: (staffIndex: number) => ipcRenderer.invoke('get-editor-snapshot', staffIndex),
  getAttrFilterMins: (staffIndex: number) =>
    ipcRenderer.invoke('get-attr-filter-mins', staffIndex) as Promise<{
      staffIndex: number
      name: string
      mins: string[]
    } | null>,
  saveAttributeEdits: (
    staffIndex: number,
    changes: Record<string, number>,
    options?: { clearInjury?: boolean; clearUnhappiness?: boolean },
  ) =>
    ipcRenderer.invoke('save-attribute-edits', {
      staffIndex,
      changes,
      clearInjury: options?.clearInjury === true,
      clearUnhappiness: options?.clearUnhappiness === true,
    }),
  getStaffEditorSnapshot: (staffIndex: number) =>
    ipcRenderer.invoke('get-staff-editor-snapshot', staffIndex),
  saveStaffEdits: (staffIndex: number, changes: Record<string, number>) =>
    ipcRenderer.invoke('save-staff-edits', { staffIndex, changes }),
  getContractEditorSnapshot: (staffIndex: number) =>
    ipcRenderer.invoke('get-contract-editor-snapshot', staffIndex),
  saveContractEdits: (
    staffIndex: number,
    changes: Record<string, number>,
    dateChanges?: { date_started?: string | null; contract_expires?: string | null },
  ) => ipcRenderer.invoke('save-contract-edits', { staffIndex, changes, dateChanges }),
  getClubEditorSnapshot: (clubId: number) => ipcRenderer.invoke('get-club-editor-snapshot', clubId),
  saveClubEdits: (
    clubId: number,
    values: Record<string, number>,
    options?: { inPlace?: boolean; clearSquadUnhappiness?: boolean },
  ) =>
    ipcRenderer.invoke('save-club-edits', {
      clubId,
      values,
      inPlace: options?.inPlace === true,
      clearSquadUnhappiness: options?.clearSquadUnhappiness === true,
    }) as Promise<
      { ok: true; path: string; inPlace?: boolean; squadCleared?: number } | { ok: false; error: string }
    >,
  getShortlistStore: () =>
    ipcRenderer.invoke('get-shortlist-store') as Promise<{ version: 1; lists: unknown[] }>,
  setShortlistStore: (store: { version: 1; lists: unknown[] }) =>
    ipcRenderer.invoke('set-shortlist-store', store) as Promise<{ ok: true } | { ok: false; error: string }>,
  getShortlistPlayerRows: (payload: { staffIndices: number[]; filter?: Record<string, unknown> }) =>
    ipcRenderer.invoke('get-shortlist-player-rows', payload) as Promise<Array<Record<string, unknown>>>,
  getShortlistStaffRows: (payload: { staffIndices: number[]; filter?: Record<string, unknown> }) =>
    ipcRenderer.invoke('get-shortlist-staff-rows', payload) as Promise<Array<Record<string, unknown>>>,
  exportShortlistPls: (payload: { staffIndices: number[]; defaultName?: string }) =>
    ipcRenderer.invoke('export-shortlist-pls', payload) as Promise<
      { ok: true; path: string; count: number } | { ok: false; error: string }
    >,
  exportShortlistJson: (payload: { json: string; defaultName?: string }) =>
    ipcRenderer.invoke('export-shortlist-json', payload) as Promise<
      { ok: true; path: string } | { ok: false; error: string }
    >,
})
