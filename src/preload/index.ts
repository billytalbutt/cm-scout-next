import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('cmapi', {
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
  getProfile: (staffIndex: number) => ipcRenderer.invoke('get-profile', staffIndex),
  getStaffProfile: (staffIndex: number) => ipcRenderer.invoke('get-staff-profile', staffIndex),
  getEffectivenessDetail: (staffIndex: number) => ipcRenderer.invoke('get-effectiveness-detail', staffIndex),
  saveRegenBaseline: () => ipcRenderer.invoke('save-regen-baseline'),
  clearRegenBaseline: () => ipcRenderer.invoke('clear-regen-baseline'),
  getEditorSnapshot: (staffIndex: number) => ipcRenderer.invoke('get-editor-snapshot', staffIndex),
  saveAttributeEdits: (staffIndex: number, changes: Record<string, number>) =>
    ipcRenderer.invoke('save-attribute-edits', { staffIndex, changes }),
  getClubEditorSnapshot: (clubId: number) => ipcRenderer.invoke('get-club-editor-snapshot', clubId),
  saveClubEdits: (clubId: number, changes: Record<string, number>) =>
    ipcRenderer.invoke('save-club-edits', { clubId, changes }),
  getShortlistPlayerRows: (staffIndices: number[]) =>
    ipcRenderer.invoke('get-shortlist-player-rows', staffIndices) as Promise<Array<Record<string, unknown>>>,
  exportShortlistPls: (payload: { staffIndices: number[]; defaultName?: string }) =>
    ipcRenderer.invoke('export-shortlist-pls', payload) as Promise<
      { ok: true; path: string; count: number } | { ok: false; error: string }
    >,
  exportShortlistJson: (payload: { json: string; defaultName?: string }) =>
    ipcRenderer.invoke('export-shortlist-json', payload) as Promise<
      { ok: true; path: string } | { ok: false; error: string }
    >,
})
