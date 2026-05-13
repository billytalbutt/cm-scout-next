import type { ParsedDatabase } from './database/types'

export interface ClubListRow {
  id: number
  name: string
  nation: string
  division: string
  reputation: number
  cash: number
  stadiumId: number
}

export function filterClubListRows(db: ParsedDatabase, q: string): ClubListRow[] {
  const clubs = db.clubsById
  if (!clubs || clubs.size === 0) return []
  const ql = q.trim().toLowerCase()
  const out: ClubListRow[] = []
  for (const c of clubs.values()) {
    if (ql && !c.name.toLowerCase().includes(ql)) continue
    const nation = db.nationNames.get(c.nationId) ?? ''
    const comp = db.clubCompsById?.get(c.divisionCompId)
    const division = comp?.name ?? (c.divisionCompId ? `#${c.divisionCompId}` : '—')
    out.push({
      id: c.id,
      name: c.name,
      nation,
      division,
      reputation: c.reputation,
      cash: c.cash,
      stadiumId: c.stadiumId,
    })
  }
  out.sort((a, b) => b.reputation - a.reputation || a.name.localeCompare(b.name))
  return out
}

export interface ClubSquadPlayerRow {
  staffIndex: number
  name: string
  ca: number
  pa: number
  club: string
}

export function buildClubSquadPlayerRows(db: ParsedDatabase, clubId: number): ClubSquadPlayerRow[] {
  const club = db.clubsById?.get(clubId)
  if (!club) return []
  const { staff, players, clubNames, firstNames, secondNames, commonNames } = db
  const nPlayers = players.length
  const clubLabel = club.name
  const out: ClubSquadPlayerRow[] = []
  const seen = new Set<number>()
  for (const sid of club.squadStaffIds) {
    if (sid <= 0 || seen.has(sid)) continue
    seen.add(sid)
    const staffIndex = staff.findIndex((s) => s.id === sid)
    if (staffIndex < 0) continue
    const s = staff[staffIndex]!
    if (s.player_id < 0 || s.player_id >= nPlayers) continue
    const p = players[s.player_id]
    if (!p) continue
    const fn = firstNames[s.first_name_id] ?? ''
    const sn = secondNames[s.second_name_id] ?? ''
    const cn = commonNames[s.common_name_id] ?? ''
    const name = cn.trim() || `${fn} ${sn}`.trim() || `#${s.id}`
    out.push({
      staffIndex,
      name,
      ca: p.current_ability,
      pa: p.potential_ability,
      club: clubNames.get(s.club_job_id) ?? clubLabel,
    })
  }
  out.sort((a, b) => b.ca - a.ca || a.name.localeCompare(b.name))
  return out
}
