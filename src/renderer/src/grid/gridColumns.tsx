import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { formatIsoDateUk } from '../../../shared/dateDisplay'
import { GRID_COLUMN_CATALOG } from '../../../shared/gridColumnCatalog'
import { contractTypeLabel } from '../../../shared/contractTypes'
import { FlagEmoji } from '../profile/profileUi'
import { EffPercentCell } from './EffPercentCell'
import { EliteEngineStar } from './EliteEngineStar'

const LABEL = new Map(GRID_COLUMN_CATALOG.map((e) => [e.id, e.label]))

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}

function attrColor(v: number, invert = false): string {
  const x = invert ? 21 - v : v
  if (x >= 18) return 'text-emerald-300 font-semibold'
  if (x >= 15) return 'text-emerald-200/90'
  if (x >= 12) return 'text-zinc-200'
  if (x >= 8) return 'text-amber-200/80'
  return 'text-rose-300/90'
}

export function createGridColumnHelper() {
  return createColumnHelper<GridPlayerRow>()
}

export type GridColumnHelper = ReturnType<typeof createGridColumnHelper>

function csNumCell({ getValue }: { getValue: () => number | null | undefined }) {
  const v = getValue()
  return v == null || v === undefined ? (
    <span className="text-zinc-600">—</span>
  ) : (
    <span className="font-mono text-sky-100/90">{v}</span>
  )
}

export function buildGridColumns(helper: GridColumnHelper, visibleIds: readonly string[]): ColumnDef<GridPlayerRow>[] {
  const out: ColumnDef<GridPlayerRow>[] = []
  const h = helper
  for (const id of visibleIds) {
    const lab = LABEL.get(id) ?? id
    const col = defFor(id, lab, h)
    if (col) out.push(col)
  }
  return out
}

function defFor(
  id: string,
  lab: string,
  h: GridColumnHelper,
): ColumnDef<GridPlayerRow> | null {
  if (id.startsWith('attr_')) {
    const i = Number(id.slice(5))
    if (!Number.isFinite(i) || i < 0 || i > 47) return null
    const invert = i === 23 || i === 38
    return h.accessor((r) => r.attr48?.[i] ?? -1, {
      id,
      header: lab,
      cell: ({ getValue }) => {
        const v = getValue()
        return v < 0 ? <span className="text-zinc-600">—</span> : <span className={attrColor(v, invert)}>{v}</span>
      },
    })
  }
  if (id.startsWith('role_')) {
    const i = Number(id.slice(5))
    if (!Number.isFinite(i) || i < 0 || i > 6) return null
    return h.accessor((r) => r.role7?.[i] ?? -1, {
      id,
      header: lab,
      cell: ({ getValue }) => {
        const v = getValue()
        return v < 0 ? <span className="text-zinc-600">—</span> : <span>{v.toFixed(1)}%</span>
      },
    })
  }

  switch (id) {
    case 'rating':
      return h.accessor((r) => r.cmScoutRatingBp ?? -1, {
        id,
        header: () => (
          <span
            className="cursor-help border-b border-dotted border-zinc-500"
            title="Intrinsic ‘BP’: max weighted % among roles where the player is natural (≥15). Uses in-game CA18 display + clamped raw mentals (same weights as classic CM Scout / WeightsSet_CMScout.txt) so headline % tracks CM Scout on the same save. Per-role columns can read higher if that role is not “suitable.”"
          >
            {lab}
          </span>
        ),
        cell: ({ row }) => {
          const v = row.original.cmScoutRatingBp
          return v == null ? <span className="text-zinc-600">—</span> : <span>{v.toFixed(1)}%</span>
        },
      })
    case 'effRating':
      return h.accessor(
        (r) => (r.effArchetype === 'Unsure' || r.effPercent == null ? undefined : r.effPercent),
        {
          id,
          sortUndefined: 'last',
          header: () => (
            <span
              className="cursor-help border-b border-dotted border-zinc-500"
              title="Eff %: weighted recipe + engine hiddens for each natural role. DMC/DC differ — DMC scores Dec/Ant in the recipe; DC applies a brain read. Not CM Scout %."
            >
              {lab}
            </span>
          ),
          cell: ({ row }) => {
            const pct = row.original.effPercent
            const role = row.original.effArchetype
            const cm = row.original.cmScoutRatingBp
            if (!role) return <span className="text-zinc-600">—</span>
            return (
              <EffPercentCell
                staffIndex={row.original.staffIndex}
                playerName={row.original.name}
                effPercent={pct ?? null}
                effArchetype={role}
                cmScoutRatingBp={cm}
              />
            )
          },
        },
      )
    case 'staffId':
      return h.accessor('staffId', { id, header: lab })
    case 'staffIndex':
      return h.accessor('staffIndex', { id, header: lab })
    case 'name':
      return h.accessor('name', {
        id,
        header: lab,
        cell: (info) => (
          <span className="flex items-center gap-2">
            {info.row.original.eliteEngineBadgeKind && info.row.original.eliteEngineBadgeTitle && (
              <EliteEngineStar
                title={info.row.original.eliteEngineBadgeTitle}
                detail={info.row.original.eliteEngineBadgeDetail ?? ''}
              />
            )}
            <span>{info.getValue()}</span>
          </span>
        ),
      })
    case 'age':
      return h.accessor((r) => r.age ?? -1, {
        id,
        header: lab,
        cell: ({ row }) => (row.original.age == null ? '—' : String(row.original.age)),
      })
    case 'nation':
      return h.accessor('nation', {
        id,
        header: lab,
        cell: ({ row }) => {
          const s = row.original.secondNation
          return s ? (
            <span>
              {row.original.nation}
              <span className="text-zinc-500"> / {s}</span>
            </span>
          ) : (
            row.original.nation
          )
        },
      })
    case 'eu':
      return h.accessor((r) => (r.euPassport ? 1 : 0), {
        id,
        header: lab,
        cell: ({ row }) =>
          row.original.euPassport ? (
            <FlagEmoji emoji="🇪🇺" size="grid" title="EU passport (1st or 2nd nation)" />
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      })
    case 'club':
      return h.accessor('club', { id, header: lab })
    case 'ca':
      return h.accessor('ca', { id, header: lab })
    case 'pa':
      return h.accessor('pa', { id, header: lab })
    case 'wage':
      return h.accessor('wage', {
        id,
        header: lab,
        cell: (info) => fmtMoney(info.getValue()),
      })
    case 'value':
      return h.accessor('value', {
        id,
        header: lab,
        cell: (info) => fmtMoney(info.getValue()),
      })
    case 'shCareerApps':
      return h.accessor('staffHistCareerApps', { id, header: lab })
    case 'shCareerGoals':
      return h.accessor('staffHistCareerGoals', { id, header: lab })
    case 'shSeasonApps':
      return h.accessor('staffHistSeasonApps', { id, header: lab })
    case 'shSeasonGoals':
      return h.accessor('staffHistSeasonGoals', { id, header: lab })
    case 'curApps':
      return h.accessor('curSeasonApps', { id, header: lab })
    case 'curGoals':
      return h.accessor('curSeasonGoals', { id, header: lab })
    case 'carApps':
      return h.accessor('careerAppsTotal', { id, header: lab })
    case 'carGoals':
      return h.accessor('careerGoalsTotal', { id, header: lab })
    case 'curAst':
      return h.accessor((r) => r.curSeasonAssists ?? null, {
        id,
        header: lab,
        sortUndefined: 'last',
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null ? <span className="text-zinc-600">—</span> : <span className="font-mono">{v}</span>
        },
      })
    case 'curAvR':
      return h.accessor((r) => r.curSeasonAvgRating ?? null, {
        id,
        header: lab,
        sortUndefined: 'last',
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null ? (
            <span className="text-zinc-600">—</span>
          ) : (
            <span className="font-mono">{v.toFixed(2)}</span>
          )
        },
      })
    case 'spfApps':
      return h.accessor((r) => r.spfApps ?? null, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null ? <span className="text-zinc-600">—</span> : <span className="font-mono">{v}</span>
        },
      })
    case 'spfGoals':
      return h.accessor((r) => r.spfGoals ?? null, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null ? <span className="text-zinc-600">—</span> : <span className="font-mono">{v}</span>
        },
      })
    case 'spfAst':
      return h.accessor((r) => r.spfAst ?? null, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null ? <span className="text-zinc-600">—</span> : <span className="font-mono">{v}</span>
        },
      })
    case 'csApps':
      return h.accessor((r) => r.csApps, {
        id,
        header: lab,
        cell: csNumCell,
      })
    case 'csGoals':
      return h.accessor((r) => r.csGoals, {
        id,
        header: lab,
        cell: csNumCell,
      })
    case 'csAst':
      return h.accessor((r) => r.csAst, {
        id,
        header: lab,
        cell: csNumCell,
      })
    case 'csLeagueGoals':
      return h.accessor((r) => r.csLeagueGoals, {
        id,
        header: lab,
        cell: csNumCell,
      })
    case 'csLeagueAst':
      return h.accessor((r) => r.csLeagueAst, {
        id,
        header: lab,
        cell: csNumCell,
      })
    case 'csCupGoals':
      return h.accessor((r) => r.csCupGoals, {
        id,
        header: lab,
        cell: csNumCell,
      })
    case 'csIntlApps':
      return h.accessor((r) => r.csIntlApps, {
        id,
        header: lab,
        cell: csNumCell,
      })
    case 'csCompCount':
      return h.accessor((r) => r.csCompCount, {
        id,
        header: lab,
        cell: csNumCell,
      })
    case 'csAvR':
      return h.accessor((r) => r.csAvR ?? null, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null ? (
            <span className="text-zinc-600">—</span>
          ) : (
            <span className="font-mono text-sky-100/90">{v.toFixed(2)}</span>
          )
        },
      })
    case 'isRegen':
      return h.accessor(
        (r) => (r.isRegenLikely === true ? 2 : r.isEliteProspect === true ? 1 : 0),
        {
          id,
          header: lab,
          cell: ({ row }) =>
            row.original.isRegenLikely === true ? (
              <span className="text-amber-200/90">Linked</span>
            ) : row.original.isEliteProspect === true ? (
              <span className="text-emerald-300/90">Prospect</span>
            ) : (
              <span className="text-zinc-600">—</span>
            ),
        },
      )
    case 'regenOf':
      return h.accessor((r) => r.regenOf ?? '', {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const s = getValue()
          return !s ? (
            <span className="text-zinc-600">—</span>
          ) : (
            <span className="max-w-[10rem] truncate text-zinc-200" title={s}>
              {s}
            </span>
          )
        },
      })
    case 'playerId':
      return h.accessor((r) => r.playerId ?? -1, { id, header: lab, cell: ({ getValue }) => (getValue() < 0 ? '—' : String(getValue())) })
    case 'squadNumber':
      return h.accessor((r) => r.squadNumber ?? -1, { id, header: lab, cell: ({ getValue }) => (getValue() < 0 ? '—' : String(getValue())) })
    case 'leftFoot':
      return h.accessor((r) => r.leftFoot ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'rightFoot':
      return h.accessor((r) => r.rightFoot ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'morale':
      return h.accessor((r) => r.morale ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'staffYob':
      return h.accessor((r) => r.staffYob ?? -1, { id, header: lab, cell: ({ getValue }) => (getValue() < 0 ? '—' : String(getValue())) })
    case 'repHome':
      return h.accessor((r) => r.repHome ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(Math.min(20, v))}>{v}</span>
        },
      })
    case 'repCurrent':
      return h.accessor((r) => r.repCurrent ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(Math.min(20, v))}>{v}</span>
        },
      })
    case 'repWorld':
      return h.accessor((r) => r.repWorld ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(Math.min(20, v))}>{v}</span>
        },
      })
    case 'posGk':
      return h.accessor((r) => r.posGk ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'posSw':
      return h.accessor((r) => r.posSw ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'posD':
      return h.accessor((r) => r.posD ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'posDm':
      return h.accessor((r) => r.posDm ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'posM':
      return h.accessor((r) => r.posM ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'posAm':
      return h.accessor((r) => r.posAm ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'posAtt':
      return h.accessor((r) => r.posAtt ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'posWb':
      return h.accessor((r) => r.posWb ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'posRight':
      return h.accessor((r) => r.posRight ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'posLeft':
      return h.accessor((r) => r.posLeft ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'posCentre':
      return h.accessor((r) => r.posCentre ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'posFreeRole':
      return h.accessor((r) => r.posFreeRole ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'stAdaptability':
      return h.accessor((r) => r.stAdaptability ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'stAmbition':
      return h.accessor((r) => r.stAmbition ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'stDetermination':
      return h.accessor((r) => r.stDetermination ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'stLoyalty':
      return h.accessor((r) => r.stLoyalty ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'stPressure':
      return h.accessor((r) => r.stPressure ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'stProfessionalism':
      return h.accessor((r) => r.stProfessionalism ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'stSportsmanship':
      return h.accessor((r) => r.stSportsmanship ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'stTemperament':
      return h.accessor((r) => r.stTemperament ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v < 0 ? '—' : <span className={attrColor(v)}>{v}</span>
        },
      })
    case 'cClubId':
      return h.accessor((r) => r.cClubId ?? -1, { id, header: lab, cell: ({ getValue }) => (getValue() == null || getValue()! < 0 ? '—' : String(getValue())) })
    case 'cGoalBonus':
      return h.accessor((r) => r.cGoalBonus ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          if (v == null || v < 0) return '—'
          return fmtMoney(v)
        },
      })
    case 'cAssistBonus':
      return h.accessor((r) => r.cAssistBonus ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          if (v == null || v < 0) return '—'
          return fmtMoney(v)
        },
      })
    case 'cCleanSheetBonus':
      return h.accessor((r) => r.cCleanSheetBonus ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          if (v == null || v < 0) return '—'
          return fmtMoney(v)
        },
      })
    case 'cReleaseFee':
      return h.accessor((r) => r.cReleaseFee ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          if (v == null || v < 0) return '—'
          return fmtMoney(v)
        },
      })
    case 'cDateStarted':
    case 'cDateExpires':
      return h.accessor((r) => (id === 'cDateStarted' ? r.cDateStarted : r.cDateExpires) ?? '', {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const s = getValue()
          return !s ? (
            <span className="text-zinc-600">—</span>
          ) : (
            <span className="font-mono text-[11px] text-zinc-300">{formatIsoDateUk(s)}</span>
          )
        },
      })
    case 'cType':
      return h.accessor((r) => r.cType ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          if (v == null || v < 0) return '—'
          return <span className="text-[11px] text-zinc-300">{contractTypeLabel(v)}</span>
        },
      })
    case 'cBosman':
      return h.accessor((r) => (r.cBosman === true ? 1 : 0), {
        id,
        header: lab,
        cell: ({ row }) =>
          row.original.cBosman === true ? (
            <span className="text-emerald-400/90">Y</span>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      })
    case 'cMinFeeRc':
      return h.accessor((r) => (r.cMinFeeRc === true ? 1 : 0), {
        id,
        header: lab,
        cell: ({ row }) =>
          row.original.cMinFeeRc === true ? (
            <span className="text-emerald-400/90">Y</span>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      })
    case 'cNonPromoRc':
      return h.accessor((r) => (r.cNonPromoRc === true ? 1 : 0), {
        id,
        header: lab,
        cell: ({ row }) =>
          row.original.cNonPromoRc === true ? (
            <span className="text-emerald-400/90">Y</span>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      })
    case 'cNonPlayingRc':
      return h.accessor((r) => (r.cNonPlayingRc === true ? 1 : 0), {
        id,
        header: lab,
        cell: ({ row }) =>
          row.original.cNonPlayingRc === true ? (
            <span className="text-emerald-400/90">Y</span>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      })
    case 'cRelegationRc':
      return h.accessor((r) => (r.cRelegationRc === true ? 1 : 0), {
        id,
        header: lab,
        cell: ({ row }) =>
          row.original.cRelegationRc === true ? (
            <span className="text-emerald-400/90">Y</span>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      })
    case 'cTlClub':
      return h.accessor((r) => (r.cTlClub === true ? 1 : 0), {
        id,
        header: lab,
        cell: ({ row }) =>
          row.original.cTlClub === true ? (
            <span className="text-emerald-400/90">Y</span>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      })
    case 'cTlRequest':
      return h.accessor((r) => (r.cTlRequest === true ? 1 : 0), {
        id,
        header: lab,
        cell: ({ row }) =>
          row.original.cTlRequest === true ? (
            <span className="text-emerald-400/90">Y</span>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      })
    case 'cLoanListed':
      return h.accessor((r) => (r.cLoanListed === true ? 1 : 0), {
        id,
        header: lab,
        cell: ({ row }) =>
          row.original.cLoanListed === true ? (
            <span className="text-emerald-400/90">Y</span>
          ) : (
            <span className="text-zinc-600">—</span>
          ),
      })
    case 'cTransferStatus':
      return h.accessor((r) => r.cTransferStatus ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null || v < 0 ? '—' : String(v)
        },
      })
    case 'cSquadStatus':
      return h.accessor((r) => r.cSquadStatus ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null || v < 0 ? '—' : String(v)
        },
      })
    case 'cTransferArranged':
      return h.accessor((r) => r.cTransferArranged ?? -1, {
        id,
        header: lab,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null || v < 0 ? '—' : String(v)
        },
      })
    default:
      return null
  }
}
