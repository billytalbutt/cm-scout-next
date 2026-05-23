import { useCallback, useEffect, useState } from 'react'
import type { ProfilePayload, StaffProfilePayload } from '../vite-env.d'
import { defaultProfileHighlightRoleIdx } from '../../../shared/profileHighlightRole'
import type { ProfileWindowRoute } from './profileWindowRoute'
import { PlayerProfileHeader, PlayerProfileTabViews } from './PlayerProfileTabViews'
import { StaffProfileTabViews } from './StaffProfileTabViews'
import { ProfileTabBar, type ProfileTabId } from './profileUi'

const ENGINE_ATTRS_LS = 'cm-scout-next-profile-engine-attrs'

function loadShowEngineAttrs(): boolean {
  try {
    return localStorage.getItem(ENGINE_ATTRS_LS) === '1'
  } catch {
    return false
  }
}

export function ProfileWindowApp({ route }: { route: ProfileWindowRoute }) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [player, setPlayer] = useState<ProfilePayload | null>(null)
  const [staff, setStaff] = useState<StaffProfilePayload | null>(null)
  const [tab, setTab] = useState<ProfileTabId>('attributes')
  const [profileHighlightRoleIdx, setProfileHighlightRoleIdx] = useState(0)
  const showEngineAttrs = loadShowEngineAttrs()

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      if (route.kind === 'player') {
        const p = await window.cmapi?.getProfile(route.staffIndex)
        if (!p) {
          setErr('Player not found. Load the same save in the main window first.')
          setPlayer(null)
          return
        }
        setPlayer(p)
        setStaff(null)
        setProfileHighlightRoleIdx(defaultProfileHighlightRoleIdx(p))
        document.title = `${p.name} — CM Merlin`
      } else {
        const s = await window.cmapi?.getStaffProfile(route.staffIndex)
        if (!s) {
          setErr('Staff not found. Load the same save in the main window first.')
          setStaff(null)
          return
        }
        setStaff(s)
        setPlayer(null)
        document.title = `${s.name} — CM Merlin`
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [route.kind, route.staffIndex])

  useEffect(() => {
    void load()
  }, [load])

  const openPredecessor = useCallback((staffIndex: number) => {
    void window.cmapi?.openProfileWindow({ staffIndex, kind: 'player' })
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        Loading profile…
      </div>
    )
  }

  if (err) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center">
        <p className="text-sm text-rose-300">{err}</p>
        <button
          type="button"
          className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          onClick={() => void load()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="cm-scroll flex h-screen min-h-0 flex-col overflow-y-auto bg-zinc-950 text-zinc-100">
      <div className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-2 backdrop-blur-sm">
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Profile window</p>
      </div>
      <div className="space-y-4 px-4 py-4">
        {player && (
          <>
            <PlayerProfileHeader profile={player} />
            <ProfileTabBar active={tab} onChange={setTab} variant="player" />
            <PlayerProfileTabViews
              profile={player}
              showEngineAttrs={showEngineAttrs}
              activeTab={tab}
              profileHighlightRoleIdx={profileHighlightRoleIdx}
              onHighlightRoleIdx={setProfileHighlightRoleIdx}
              onOpenPredecessor={openPredecessor}
            />
          </>
        )}
        {staff && <StaffProfileTabViews p={staff} showEngineAttrs={showEngineAttrs} />}
      </div>
    </div>
  )
}
