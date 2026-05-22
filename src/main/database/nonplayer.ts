/**
 * `nonplayer.dat` rows (`TNonPlayer` in CM0102Patcher SaveChanger/Structures.cs) — one per backroom profile.
 * `staff.dat` `non_player_id` (int at byte 0x69) is the **row index** into this file (see CM0102Patcher
 * `hl.nonPlayers[staff.NonPlayer]`), not necessarily the `id` field stored in that row.
 */
import type { NonPlayerRecord } from './types'

export const NONPLAYER_ROW_BYTES = 68

function parseNonPlayerRow(row: Buffer): NonPlayerRecord {
  let o = 0
  const id = row.readInt32LE(o)
  o += 4
  const currentAbility = row.readUInt16LE(o)
  o += 2
  const potentialAbility = row.readUInt16LE(o)
  o += 2
  const homeReputation = row.readUInt16LE(o)
  o += 2
  const currentReputation = row.readUInt16LE(o)
  o += 2
  const worldReputation = row.readUInt16LE(o)
  o += 2
  const rb = () => row.readInt8(o++)
  const attacking = rb()
  const business = rb()
  const coaching = rb()
  const coachingGks = rb()
  const coachingTechnique = rb()
  const directness = rb()
  const discipline = rb()
  const freeRoles = rb()
  const interference = rb()
  const judgement = rb()
  const judgingPotential = rb()
  const manHandling = rb()
  const marking = rb()
  const motivating = rb()
  const offside = rb()
  const patience = rb()
  const physiotherapy = rb()
  const pressing = rb()
  const resources = rb()
  const tactics = rb()
  const youngsters = rb()
  const goalKeeperPref = row.readInt32LE(o)
  o += 4
  const sweeperPref = row.readInt32LE(o)
  o += 4
  const defenderPref = row.readInt32LE(o)
  o += 4
  const defensiveMidfielderPref = row.readInt32LE(o)
  o += 4
  const midfielderPref = row.readInt32LE(o)
  o += 4
  const attackingMidfielderPref = row.readInt32LE(o)
  o += 4
  const attackerPref = row.readInt32LE(o)
  o += 4
  const wingBackPref = row.readInt32LE(o)
  o += 4
  const formation = row.readInt8(o)
  return {
    id,
    currentAbility,
    potentialAbility,
    homeReputation,
    currentReputation,
    worldReputation,
    attacking,
    business,
    coaching,
    coachingGks,
    coachingTechnique,
    directness,
    discipline,
    freeRoles,
    interference,
    judgement,
    judgingPotential,
    manHandling,
    marking,
    motivating,
    offside,
    patience,
    physiotherapy,
    pressing,
    resources,
    tactics,
    youngsters,
    goalKeeperPref,
    sweeperPref,
    defenderPref,
    defensiveMidfielderPref,
    midfielderPref,
    attackingMidfielderPref,
    attackerPref,
    wingBackPref,
    formation,
  }
}

/** One `NonPlayerRecord` per `nonplayer.dat` row, index = row number in the file. */
export function parseNonPlayerData(data: Buffer): NonPlayerRecord[] {
  const rows: NonPlayerRecord[] = []
  const n = Math.floor(data.length / NONPLAYER_ROW_BYTES)
  for (let i = 0; i < n; i++) {
    const off = i * NONPLAYER_ROW_BYTES
    const row = data.subarray(off, off + NONPLAYER_ROW_BYTES)
    if (row.length < NONPLAYER_ROW_BYTES) continue
    rows.push(parseNonPlayerRow(row))
  }
  return rows
}

/** Resolve `staff.dat` `non_player_id` to the linked backroom profile row. */
export function nonPlayerForStaffLink(
  link: number,
  rows: NonPlayerRecord[] | undefined,
): NonPlayerRecord | undefined {
  if (link <= 0 || !rows?.length || link >= rows.length) return undefined
  return rows[link]
}
