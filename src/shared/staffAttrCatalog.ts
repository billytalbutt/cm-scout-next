/**
 * Staff / backroom attribute list for filters (matches in-game staff profile sections).
 */
export type StaffAttrSource = 'staff' | 'np'

export type StaffAttrFilterSpec = {
  key: string
  label: string
  source: StaffAttrSource
  staffField?: string
  npField?: string
  section: 'regular' | 'hidden'
}

export const STAFF_REGULAR_ATTR_FILTERS: readonly StaffAttrFilterSpec[] = [
  { key: 'adaptability', label: 'Adaptability', source: 'staff', staffField: 'adaptability', section: 'regular' },
  { key: 'coachingGks', label: 'Coaching goalkeepers', source: 'np', npField: 'coachingGks', section: 'regular' },
  { key: 'coaching', label: 'Coaching outfield players', source: 'np', npField: 'coaching', section: 'regular' },
  { key: 'determination', label: 'Determination', source: 'staff', staffField: 'determination', section: 'regular' },
  { key: 'judgement', label: 'Judging player ability', source: 'np', npField: 'judgement', section: 'regular' },
  { key: 'judgingPotential', label: 'Judging player potential', source: 'np', npField: 'judgingPotential', section: 'regular' },
  { key: 'discipline', label: 'Level of discipline', source: 'np', npField: 'discipline', section: 'regular' },
  {
    key: 'manHandling',
    label: 'Man management',
    source: 'np',
    npField: 'resources',
    section: 'regular',
  },
  { key: 'motivating', label: 'Motivating', source: 'np', npField: 'motivating', section: 'regular' },
  { key: 'tactics', label: 'Tactical knowledge', source: 'np', npField: 'tactics', section: 'regular' },
  { key: 'youngsters', label: 'Working with youngsters', source: 'np', npField: 'youngsters', section: 'regular' },
]

export const STAFF_HIDDEN_ATTR_FILTERS: readonly StaffAttrFilterSpec[] = [
  { key: 'ambition', label: 'Ambition', source: 'staff', staffField: 'ambition', section: 'hidden' },
  { key: 'loyalty', label: 'Loyalty', source: 'staff', staffField: 'loyalty', section: 'hidden' },
  { key: 'pressure', label: 'Pressure', source: 'staff', staffField: 'pressure', section: 'hidden' },
  { key: 'professionalism', label: 'Professionalism', source: 'staff', staffField: 'professionalism', section: 'hidden' },
  { key: 'sportsmanship', label: 'Sportsmanship', source: 'staff', staffField: 'sportsmanship', section: 'hidden' },
  { key: 'temperament', label: 'Temperament', source: 'staff', staffField: 'temperament', section: 'hidden' },
  { key: 'attacking', label: 'Attacking', source: 'np', npField: 'attacking', section: 'hidden' },
  { key: 'business', label: 'Business', source: 'np', npField: 'business', section: 'hidden' },
  { key: 'coachingTechnique', label: 'Coaching technique', source: 'np', npField: 'coachingTechnique', section: 'hidden' },
  { key: 'freeRoles', label: 'Free roles', source: 'np', npField: 'freeRoles', section: 'hidden' },
  { key: 'interference', label: 'Interference', source: 'np', npField: 'interference', section: 'hidden' },
  { key: 'marking', label: 'Marking', source: 'np', npField: 'marking', section: 'hidden' },
  { key: 'offside', label: 'Offside', source: 'np', npField: 'offside', section: 'hidden' },
  { key: 'patience', label: 'Patience', source: 'np', npField: 'patience', section: 'hidden' },
  { key: 'physiotherapy', label: 'Physiotherapy', source: 'np', npField: 'physiotherapy', section: 'hidden' },
  { key: 'pressing', label: 'Pressing', source: 'np', npField: 'pressing', section: 'hidden' },
  { key: 'resources', label: 'Resources', source: 'np', npField: 'resources', section: 'hidden' },
  { key: 'goalKeeperPref', label: 'Goalkeeper preference', source: 'np', npField: 'goalKeeperPref', section: 'hidden' },
  { key: 'sweeperPref', label: 'Sweeper preference', source: 'np', npField: 'sweeperPref', section: 'hidden' },
  { key: 'defenderPref', label: 'Defender preference', source: 'np', npField: 'defenderPref', section: 'hidden' },
  { key: 'defensiveMidfielderPref', label: 'Defensive midfielder preference', source: 'np', npField: 'defensiveMidfielderPref', section: 'hidden' },
  { key: 'midfielderPref', label: 'Midfielder preference', source: 'np', npField: 'midfielderPref', section: 'hidden' },
  { key: 'attackingMidfielderPref', label: 'Attacking midfielder preference', source: 'np', npField: 'attackingMidfielderPref', section: 'hidden' },
  { key: 'attackerPref', label: 'Attacker preference', source: 'np', npField: 'attackerPref', section: 'hidden' },
  { key: 'wingBackPref', label: 'Wing back preference', source: 'np', npField: 'wingBackPref', section: 'hidden' },
  { key: 'formation', label: 'Formation', source: 'np', npField: 'formation', section: 'hidden' },
]

export const ALL_STAFF_ATTR_FILTERS: readonly StaffAttrFilterSpec[] = [
  ...STAFF_REGULAR_ATTR_FILTERS,
  ...STAFF_HIDDEN_ATTR_FILTERS,
]

export const STAFF_ATTR_FILTER_COUNT = ALL_STAFF_ATTR_FILTERS.length
