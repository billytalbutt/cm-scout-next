/// <reference types="vite/client" />

export {}

type OpenResult =
  | { ok: true; path: string; compressed: boolean; gameDate: string | null; playerCount: number }
  | { ok: false; error: string }

declare global {
  interface Window {
    cmapi: {
      openDatabase: () => Promise<OpenResult>
      getRows: (filter: Record<string, unknown>) => Promise<
        | {
            total: number
            rows: Array<{
              staffId: number
              staffIndex: number
              name: string
              nation: string
              secondNation?: string
              club: string
              ca: number
              pa: number
              wage: number
              value: number
              age: number | null
              euPassport?: boolean
              cmScoutRatingBp?: number
              isDemo?: boolean
            }>
            capped: boolean
          }
        | Array<{
            staffId: number
            staffIndex: number
            name: string
            nation: string
            secondNation?: string
            club: string
            ca: number
            pa: number
            wage: number
            value: number
            age: number | null
            euPassport?: boolean
            cmScoutRatingBp?: number
            isDemo?: boolean
          }>
      >
      getProfile: (staffIndex: number) => Promise<ProfilePayload | null>
    }
  }
}

export interface ProfileAttrCell {
  key: string
  label: string
  inGame: number
  raw: number
  inMatch: number
  invert: boolean
  highlightTier?: 'primary' | 'secondary'
}

export interface ProfilePayload {
  isDemo?: boolean
  name: string
  nation: string
  secondNation: string
  nationDisplay: string
  club: string
  dobIso: string | null
  euPassport: boolean
  positionLabel: string
  ca: number
  pa: number
  attrColumns: [ProfileAttrCell[], ProfileAttrCell[], ProfileAttrCell[]]
  feetMorale: {
    left: { label: string; inGame: number; raw: number; inMatch: number; highlightTier?: 'primary' | 'secondary' }
    right: { label: string; inGame: number; raw: number; inMatch: number; highlightTier?: 'primary' | 'secondary' }
    morale: { label: string; inGame: number; raw: number; inMatch: number; highlightTier?: 'primary' | 'secondary' }
  }
  hiddenColumns: [ProfileAttrCell[], ProfileAttrCell[], ProfileAttrCell[]]
  highlightRolesLabel: string
  contract: {
    wage: number
    clubId: number
    goalBonus: number
    assistBonus: number
    releaseFee: number
    type: number
    dateStarted: string | null
    contractExpires: string | null
    leavingOnBosman: boolean
    minimumReleaseClause: boolean
    nonPromotionClause: boolean
    nonPlayingClause: boolean
    relegationClause: boolean
  } | null
}
