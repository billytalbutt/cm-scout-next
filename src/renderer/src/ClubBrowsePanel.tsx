/** Shared club browse types (UI split across `clubs/ClubSearchSidebar` + `clubs/ClubDetailPane`). */

export type ClubListRow = {
  id: number
  name: string
  nation: string
  division: string
  reputation: number
  cash: number
  stadiumId: number
}

export type ClubDetailSquadRow = {
  staffIndex: number
  name: string
  ca: number
  pa: number
  club: string
}

export type ClubDetailPayload = {
  id: number
  name: string
  nation: string
  division: string
  reputation: number
  cash: number
  stadiumId: number
  attendance: number
  training: number
  squad: ClubDetailSquadRow[]
  stadium?: {
    name: string
    cityId: number
    capacity: number
    seatingCapacity: number
    expansionCapacity: number
    nearbyStadiumId: number
    covered: boolean
    underSoilHeating: boolean
  } | null
  tacticSelectedId?: number
  tacticTrainingIds?: number[]
  teamSelectedStaffIds?: number[]
  tacticsWire?: {
    tacticsBlockPresent: boolean
    tacticsRowBytes: number | null
    tacticsRowCount: number | null
    tacticRowFound: boolean
    tacticRowHexPrefix: string | null
    experimentalSlots: { x: number; y: number; label: string }[] | null
  }
  xiNames?: { staffId: number; name: string }[]
}
