/** One attribute change since the regen/development snapshot. */
export type AttrDevelopmentDelta = {
  index: number
  label: string
  before: number
  after: number
  delta: number
  /** True when the change is favourable (e.g. lower injury proneness). */
  improved: boolean
}

export type PlayerDevelopmentSummary = {
  staffId: number
  staffIndex: number
  name: string
  club: string
  age: number | null
  caBefore: number
  caAfter: number
  caDelta: number
  paBefore: number
  paAfter: number
  paDelta: number
  attrsUp: number
  attrsDown: number
  netAttrPoints: number
  topGains: AttrDevelopmentDelta[]
  topLosses: AttrDevelopmentDelta[]
  deltas: AttrDevelopmentDelta[]
}

export type DevelopmentRowsResponse = {
  ready: boolean
  reason?: 'no_snapshot' | 'legacy_snapshot'
  snapshotAt?: string
  snapshotGameDate?: string | null
  totals: {
    inSnapshot: number
    withChanges: number
    attrsImproved: number
    attrsDeclined: number
  }
  total: number
  rows: PlayerDevelopmentSummary[]
  offset: number
  capped: boolean
}

export type PlayerDevelopmentDetailResponse = {
  ready: boolean
  summary: PlayerDevelopmentSummary | null
}
