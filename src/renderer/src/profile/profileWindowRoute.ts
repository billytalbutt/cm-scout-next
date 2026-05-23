export type ProfileWindowRoute = {
  kind: 'player' | 'staff'
  staffIndex: number
}

/** True when this renderer is a profile pop-out (not the main app). */
export function isProfilePopoutWindow(): boolean {
  return parseProfileWindowRoute() != null
}

/**
 * Profile pop-out route from query (`?profileKind=player&staffIndex=123`) or hash.
 * Query is preferred — Electron `loadFile` hash often omits the slash after `#`.
 */
export function parseProfileWindowRoute(): ProfileWindowRoute | null {
  const params = new URLSearchParams(window.location.search)
  const kindParam = params.get('profileKind')
  if (kindParam === 'player' || kindParam === 'staff') {
    const staffIndex = Number(params.get('staffIndex'))
    if (Number.isFinite(staffIndex) && staffIndex >= 0) {
      return { kind: kindParam, staffIndex }
    }
  }

  const hash = window.location.hash.trim()
  const m =
    /^#\/?profile\/(player|staff)\/(\d+)$/.exec(hash) ??
    /^#profile\/(player|staff)\/(\d+)$/.exec(hash)
  if (!m) return null
  const staffIndex = Number(m[2])
  if (!Number.isFinite(staffIndex) || staffIndex < 0) return null
  return { kind: m[1] as 'player' | 'staff', staffIndex }
}
