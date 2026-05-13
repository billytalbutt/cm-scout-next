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
  getProfile: (staffIndex: number) => ipcRenderer.invoke('get-profile', staffIndex),
  getStaffProfile: (staffIndex: number) => ipcRenderer.invoke('get-staff-profile', staffIndex),
  getEffectivenessDetail: (staffIndex: number) => ipcRenderer.invoke('get-effectiveness-detail', staffIndex),
  saveRegenBaseline: () => ipcRenderer.invoke('save-regen-baseline'),
  clearRegenBaseline: () => ipcRenderer.invoke('clear-regen-baseline'),
})
