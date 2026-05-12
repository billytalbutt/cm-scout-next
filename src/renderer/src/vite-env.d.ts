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
        Array<{
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

export interface ProfilePayload {
  isDemo?: boolean
  name: string
  nation: string
  club: string
  dobIso: string | null
  euPassport: boolean
  ca: number
  pa: number
  ca18: Array<{ key: string; raw: number; inGame: number; inMatch: number }>
  other: Record<string, { raw: number; inGame: number; inMatch: number }>
  mentalStaff: Record<string, { raw: number; inGame: number; inMatch: number }>
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
  positions: Record<string, number>
}
