import { CmBinaryReader, readLatin1String } from './cmBinaryReader'
import { ageFromBirthYearOnly, ageOnGameDate, tcmDateToIso } from './dates'
import type {
  BlockInfo,
  ContractRecord,
  ParsedDatabase,
  PlayerRecord,
  StaffRecord,
  UiPlayerRow,
} from './types'

/**
 * CM0102 `index.dat` is a block archive (same on-disk format the game and CM Scout read).
 * This parser loads the blocks we need for a player-centric scout view:
 * general.dat (game date), nation.dat, club.dat, first/second/common_names.dat,
 * player.dat, staff.dat, and contract.dat (for club/wage when present).
 * The player table lists playable humans (staff rows tied to player.dat); it does not
 * list every non-player staff row. CM Scout (the original app) has many extra screens
 * and may touch other blocks — feature parity with that entire program is not claimed here.
 */

function readBlocksDirectory(buf: Buffer): { compressed: boolean; blocks: BlockInfo[]; headerEnd: number } {
  let o = 0
  const marker = buf.readUInt32LE(o)
  o += 4
  const compressed = marker === 4
  o += 4 // skip
  const n = buf.readUInt32LE(o)
  o += 4
  const blocks: BlockInfo[] = []
  for (let i = 0; i < n; i++) {
    const position = buf.readInt32LE(o)
    o += 4
    const size = buf.readInt32LE(o)
    o += 4
    const nameBuf = buf.subarray(o, o + 260)
    o += 260
    const name = readLatin1String(nameBuf, 260)
    blocks.push({ position, size, name })
  }
  return { compressed, blocks, headerEnd: o }
}

function blockData(file: Buffer, compressed: boolean, b: BlockInfo): Buffer {
  const r = new CmBinaryReader(file, compressed)
  r.seek(b.position)
  return r.readBytes(b.size)
}

function parsePlayer(buf: Buffer, off: number): PlayerRecord {
  let o = off
  const id = buf.readInt32LE(o)
  o += 4
  const squad_number = buf.readUInt8(o)
  o += 1
  const current_ability = buf.readUInt16LE(o)
  o += 2
  const potential_ability = buf.readInt16LE(o)
  o += 2
  const home_reputation = buf.readUInt16LE(o)
  o += 2
  const current_reputation = buf.readUInt16LE(o)
  o += 2
  const world_reputation = buf.readUInt16LE(o)
  o += 2
  const rb = () => buf.readInt8(o++)
  return {
    id,
    squad_number,
    current_ability,
    potential_ability,
    home_reputation,
    current_reputation,
    world_reputation,
    goalkeeper: rb(),
    sweeper: rb(),
    defender: rb(),
    defensive_midfielder: rb(),
    midfielder: rb(),
    attacking_midfielder: rb(),
    attacker: rb(),
    wing_back: rb(),
    right_side: rb(),
    left_side: rb(),
    centre_side: rb(),
    free_role: rb(),
    acceleration: rb(),
    aggression: rb(),
    agility: rb(),
    anticipation: rb(),
    balance: rb(),
    bravery: rb(),
    consistency: rb(),
    corners: rb(),
    crossing: rb(),
    decisions: rb(),
    dirtiness: rb(),
    dribbling: rb(),
    finishing: rb(),
    flair: rb(),
    free_kicks: rb(),
    handling: rb(),
    heading: rb(),
    important_matches: rb(),
    injury_proneness: rb(),
    jumping: rb(),
    influence: rb(),
    left_foot: rb(),
    long_shots: rb(),
    marking: rb(),
    off_the_ball: rb(),
    natural_fitness: rb(),
    one_on_ones: rb(),
    pace: rb(),
    passing: rb(),
    penalties: rb(),
    positioning: rb(),
    reflexes: rb(),
    right_foot: rb(),
    stamina: rb(),
    strength: rb(),
    tackling: rb(),
    teamwork: rb(),
    technique: rb(),
    throw_ins: rb(),
    versatility: rb(),
    creativity: rb(),
    work_rate: rb(),
    morale: buf.readInt8(o),
  }
}

function parseStaff(buf: Buffer, off: number): StaffRecord {
  let o = off
  const id = buf.readInt32LE(o)
  o += 4
  const first_name_id = buf.readInt32LE(o)
  o += 4
  const second_name_id = buf.readInt32LE(o)
  o += 4
  const common_name_id = buf.readInt32LE(o)
  o += 4
  const dob_iso = tcmDateToIso(buf, o)
  o += 8
  const year_of_birth = buf.readUInt16LE(o)
  o += 2
  const first_nation_id = buf.readInt32LE(o)
  o += 4
  const second_nation_id = buf.readInt32LE(o)
  o += 4
  o += 2 // int apps, int goals
  o += 4 // national_job_id
  o += 1 // job_for_nation
  o += 8 // date joined nation
  o += 8 // date expires nation
  const club_job_id = buf.readInt32LE(o)
  o += 4
  const job_for_club = buf.readInt8(o)
  o += 1
  o += 8 // date joined club
  o += 8 // date expires club
  const wage = buf.readInt32LE(o)
  o += 4
  const value = buf.readInt32LE(o)
  o += 4
  const adaptability = buf.readInt8(o++)
  const ambition = buf.readInt8(o++)
  const determination = buf.readInt8(o++)
  const loyalty = buf.readInt8(o++)
  const pressure = buf.readInt8(o++)
  const professionalism = buf.readInt8(o++)
  const sportsmanship = buf.readInt8(o++)
  const temperament = buf.readInt8(o++)
  o += 3 // playing squad, classification, club valuation
  const player_id = buf.readInt32LE(o)
  return {
    id,
    first_name_id,
    second_name_id,
    common_name_id,
    dob_iso,
    year_of_birth,
    first_nation_id,
    second_nation_id,
    club_job_id,
    job_for_club,
    player_id,
    wage,
    value,
    adaptability,
    ambition,
    determination,
    loyalty,
    pressure,
    professionalism,
    sportsmanship,
    temperament,
  }
}

function parseNameRow(buf: Buffer, off: number): string {
  return readLatin1String(buf.subarray(off, off + 51), 51)
}

/** nation.dat row: GroupMembership sbyte at 0x7F — value 2 == EU-style free movement (community loaders). */
const NATION_GROUP_MEMBERSHIP_OFF = 0x7f

function parseNations(data: Buffer): { names: Map<number, string>; euEligible: Map<number, boolean> } {
  const ROW = 290
  const n = Math.floor(data.length / ROW)
  const names = new Map<number, string>()
  const euEligible = new Map<number, boolean>()
  for (let i = 0; i < n; i++) {
    const row = data.subarray(i * ROW, (i + 1) * ROW)
    if (row.length < NATION_GROUP_MEMBERSHIP_OFF + 1) continue
    const id = row.readInt32LE(0)
    const nm = readLatin1String(row.subarray(4, 55), 51)
    names.set(id, nm)
    euEligible.set(id, row.readInt8(NATION_GROUP_MEMBERSHIP_OFF) === 2)
  }
  return { names, euEligible }
}

function parseClubs(data: Buffer): Map<number, string> {
  const ROW = 581
  const n = Math.floor(data.length / ROW)
  const m = new Map<number, string>()
  for (let i = 0; i < n; i++) {
    const row = data.subarray(i * ROW, (i + 1) * ROW)
    const id = row.readInt32LE(0)
    const nm = readLatin1String(row.subarray(4, 55), 51)
    m.set(id, nm)
  }
  return m
}

function staffDisplayName(
  s: StaffRecord,
  firstNames: string[],
  secondNames: string[],
  commonNames: string[],
): string {
  const fn = firstNames[s.first_name_id] ?? ''
  const sn = secondNames[s.second_name_id] ?? ''
  const cn = commonNames[s.common_name_id] ?? ''
  if (cn.trim()) return cn.trim()
  return `${fn} ${sn}`.trim() || `#${s.id}`
}

function isValidPlayerRow(
  s: StaffRecord,
  firstNames: string[],
  secondNames: string[],
  commonNames: string[],
  nPlayers: number,
): boolean {
  if (s.player_id < 0 || s.player_id >= nPlayers) return false
  const fn = firstNames[s.first_name_id] ?? ''
  const sn = secondNames[s.second_name_id] ?? ''
  const cn = commonNames[s.common_name_id] ?? ''
  return !!(fn || sn || cn)
}

export function parseIndexDat(file: Buffer): ParsedDatabase {
  const { compressed, blocks } = readBlocksDirectory(file)
  const find = (n: string) => blocks.find((b) => b.name === n)
  const readBlock = (n: string) => {
    const b = find(n)
    if (!b) throw new Error(`Missing block ${n}`)
    return blockData(file, compressed, b)
  }

  let gameDateIso: string | null = null
  const gen = find('general.dat')
  if (gen) {
    const gbuf = blockData(file, compressed, gen)
    if (gbuf.length >= 3944 + 8) {
      gameDateIso = tcmDateToIso(gbuf, 3944)
    }
  }

  const { names: nationNames, euEligible: nationEuEligible } = parseNations(readBlock('nation.dat'))
  const clubNames = parseClubs(readBlock('club.dat'))

  const fnData = readBlock('first_names.dat')
  const snData = readBlock('second_names.dat')
  const cnData = readBlock('common_names.dat')
  const NAME_ROW = 60
  const firstNames: string[] = []
  for (let i = 0; i < fnData.length / NAME_ROW; i++) firstNames.push(parseNameRow(fnData, i * NAME_ROW))
  const secondNames: string[] = []
  for (let i = 0; i < snData.length / NAME_ROW; i++) secondNames.push(parseNameRow(snData, i * NAME_ROW))
  const commonNames: string[] = []
  for (let i = 0; i < cnData.length / NAME_ROW; i++) commonNames.push(parseNameRow(cnData, i * NAME_ROW))

  const pData = readBlock('player.dat')
  const players: PlayerRecord[] = []
  for (let i = 0; i < pData.length / 70; i++) players.push(parsePlayer(pData, i * 70))

  const sData = readBlock('staff.dat')
  const staff: StaffRecord[] = []
  for (let i = 0; i < sData.length / 110; i++) staff.push(parseStaff(sData, i * 110))

  const contractsByStaffIndex = new Map<number, ContractRecord>()
  const cBlock = find('contract.dat')
  if (cBlock) {
    const cbuf = blockData(file, compressed, cBlock)
    let o = 0
    const preCount = cbuf.readInt32LE(o)
    o += 4
    let contractCount = cbuf.readInt32LE(o)
    o += 4
    let lastPre = Buffer.alloc(0)
    for (let i = 0; i < preCount; i++) {
      lastPre = cbuf.subarray(o, o + 21)
      o += 21
    }
    if (preCount > 0 && lastPre.length >= 21) {
      contractCount = lastPre.readInt32LE(17)
    }
    for (let i = 0; i < contractCount; i++) {
      const r = cbuf.subarray(o, o + 80)
      o += 80
      const staffIndex = r.readInt32LE(0)
      const club_id = r.readInt32LE(4)
      const wage = r.readInt32LE(12)
      const goal_bonus = r.readInt32LE(16)
      const assist_bonus = r.readInt32LE(20)
      const clean_sheet_bonus = r.readInt32LE(24)
      const non_promotion_rc = r.readUInt8(28)
      const minimum_fee_rc = r.readUInt8(29)
      const non_playing_rc = r.readUInt8(30)
      const relegation_rc = r.readUInt8(31)
      const manager_job_rc = r.readUInt8(32)
      const release_fee = r.readInt32LE(33)
      const date_started_iso = tcmDateToIso(r, 37)
      const contract_expires_iso = tcmDateToIso(r, 45)
      const contract_type = r.readUInt8(53)
      const leaving_on_bosman = r.readUInt8(73)
      const transfer_arranged_for = r.readInt32LE(74)
      const transfer_status = r.readUInt8(78)
      const squad_status = r.readUInt8(79)
      if (staffIndex >= 0 && staffIndex < staff.length) {
        contractsByStaffIndex.set(staffIndex, {
          staffIndex,
          club_id,
          wage,
          goal_bonus,
          assist_bonus,
          clean_sheet_bonus,
          non_promotion_rc,
          minimum_fee_rc,
          non_playing_rc,
          relegation_rc,
          manager_job_rc,
          release_fee,
          date_started_iso,
          contract_expires_iso,
          contract_type,
          leaving_on_bosman,
          transfer_arranged_for,
          transfer_status,
          squad_status,
        })
      }
    }
  }

  return {
    compressed,
    blocks,
    nationNames,
    nationEuEligible,
    clubNames,
    firstNames,
    secondNames,
    commonNames,
    players,
    staff,
    contractsByStaffIndex,
    gameDateIso,
  }
}

export function buildUiRows(db: ParsedDatabase): UiPlayerRow[] {
  const rows: UiPlayerRow[] = []
  const {
    players,
    staff,
    nationNames,
    nationEuEligible,
    clubNames,
    firstNames,
    secondNames,
    commonNames,
    contractsByStaffIndex,
    gameDateIso,
  } = db
  staff.forEach((s, staffIndex) => {
    if (!isValidPlayerRow(s, firstNames, secondNames, commonNames, players.length)) return
    const player = players[s.player_id]
    if (!player) return
    const name = staffDisplayName(s, firstNames, secondNames, commonNames)
    const nation = nationNames.get(s.first_nation_id) ?? ''
    const secondNation =
      s.second_nation_id > 0 && s.second_nation_id !== s.first_nation_id
        ? (nationNames.get(s.second_nation_id) ?? '')
        : ''
    const club = clubNames.get(s.club_job_id) ?? ''
    const c = contractsByStaffIndex.get(staffIndex) ?? null
    const wage = c?.wage ?? s.wage
    const ageFromDob = ageOnGameDate(s.dob_iso, gameDateIso)
    const age = ageFromDob != null ? ageFromDob : ageFromBirthYearOnly(s.year_of_birth, gameDateIso)
    const euPassport =
      !!nationEuEligible.get(s.first_nation_id) ||
      (s.second_nation_id > 0 && !!nationEuEligible.get(s.second_nation_id))
    rows.push({
      staffId: s.id,
      staffIndex,
      name,
      nation,
      secondNation,
      club,
      ca: player.current_ability,
      pa: player.potential_ability,
      wage,
      value: s.value,
      age,
      euPassport,
      player,
      staff: s,
      contract: c,
    })
  })
  return rows
}
