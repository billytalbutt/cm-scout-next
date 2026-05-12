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
      capped: boolean
    }>,
  getProfile: (staffIndex: number) => ipcRenderer.invoke('get-profile', staffIndex),
  saveRegenBaseline: () => ipcRenderer.invoke('save-regen-baseline'),
  clearRegenBaseline: () => ipcRenderer.invoke('clear-regen-baseline'),
})
