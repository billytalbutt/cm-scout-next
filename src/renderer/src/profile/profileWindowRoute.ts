export type ProfileWindowRoute = {
  kind: 'player' | 'staff'
  staffIndex: number
}

/** `#/profile/player/123` or `#/profile/staff/45` */
export function parseProfileWindowRoute(hash: string): ProfileWindowRoute | null {
  const m = /^#\/profile\/(player|staff)\/(\d+)$/.exec(hash.trim())
  if (!m) return null
  const staffIndex = Number(m[2])
  if (!Number.isFinite(staffIndex) || staffIndex < 0) return null
  return { kind: m[1] as 'player' | 'staff', staffIndex }
}
