/** Display ISO calendar dates as UK style DD/MM/YYYY (internal storage stays YYYY-MM-DD). */
export function formatIsoDateUk(iso: string | null | undefined): string {
  if (iso == null) return ''
  const s = String(iso).trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return s
  return `${m[3]}/${m[2]}/${m[1]}`
}
