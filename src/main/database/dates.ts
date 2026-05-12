/**
 * CM01/02 TCM dates: day = 0-based offset from 1 Jan of `year` (see CM0102Patcher TCMDate).
 * Game date in general.dat uses the same encoding as staff DOB and contract dates.
 */

export function tcmDateToIso(buf: Buffer, off: number): string | null {
  const day = buf.readInt16LE(off)
  const year = buf.readInt16LE(off + 2)
  if (day === 0 && year === 0) return null
  const ms = Date.UTC(year, 0, 1 + day)
  return new Date(ms).toISOString().slice(0, 10)
}

/** Age in whole years on `gameDateIso`, using month/day (not just calendar year). */
export function ageOnGameDate(dobIso: string | null, gameDateIso: string | null): number | null {
  if (!dobIso || !gameDateIso) return null
  const [dy, dm, dd] = dobIso.split('-').map(Number)
  const [gy, gm, gd] = gameDateIso.split('-').map(Number)
  if (![dy, dm, dd, gy, gm, gd].every((n) => Number.isFinite(n))) return null
  let age = gy - dy
  if (gm < dm || (gm === dm && gd < dd)) age -= 1
  return age
}

/** Signed day difference target − game (same UTC midnight basis as ISO strings). */
export function calendarDaysBetween(gameIso: string, targetIso: string): number | null {
  const [gy, gm, gd] = gameIso.split('-').map(Number)
  const [ty, tm, td] = targetIso.split('-').map(Number)
  if (![gy, gm, gd, ty, tm, td].every((n) => Number.isFinite(n))) return null
  const g = Date.UTC(gy, gm - 1, gd)
  const t = Date.UTC(ty, tm - 1, td)
  return Math.round((t - g) / 86400000)
}

/** Fallback when DOB bytes are missing: game calendar year − birth year only. */
export function ageFromBirthYearOnly(yearOfBirth: number, gameDateIso: string | null): number | null {
  if (!yearOfBirth || yearOfBirth < 1870) return null
  if (!gameDateIso) return null
  const y = Number(gameDateIso.slice(0, 4))
  if (!Number.isFinite(y)) return null
  return y - yearOfBirth
}
