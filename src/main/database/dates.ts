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

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/** Encode ISO calendar date as CM TCMDate (8 bytes: day-of-year−1, year, leap flag). */
export function tcmDateBytesFromIso(iso: string | null, fallbackYear = 0): Buffer {
  const out = Buffer.alloc(8)
  if (iso) {
    const [y, m, d] = iso.split('-').map(Number)
    if ([y, m, d].every((n) => Number.isFinite(n))) {
      const day = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000)
      out.writeInt16LE(day, 0)
      out.writeInt16LE(y, 2)
      out.writeInt32LE(isLeapYear(y) ? 1 : 0, 4)
      return out
    }
  }
  if (fallbackYear >= 1870 && fallbackYear < 2100) {
    out.writeInt16LE(0, 0)
    out.writeInt16LE(fallbackYear, 2)
    out.writeInt32LE(isLeapYear(fallbackYear) ? 1 : 0, 4)
  }
  return out
}

/** Write TCMDate at `off` from `YYYY-MM-DD`, or zero the block when iso is empty/invalid. */
export function writeTcmDateAtIso(buf: Buffer, off: number, iso: string | null | undefined): void {
  if (!iso?.trim()) {
    buf.fill(0, off, off + 8)
    return
  }
  tcmDateBytesFromIso(iso.trim()).copy(buf, off)
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
