import { useMemo } from 'react'
import { formatIsoDateUk } from '../../../shared/dateDisplay'
import type { ProfilePayload } from '../vite-env.d'
import { applyProfileHighlightPack, highlightPackForArchetype } from '../profileHighlightApply'
import { NaturalRoleHighlightPicker } from './NaturalRoleHighlightPicker'
import { RegenProfileHint } from './RegenProfileHint'
import {
  FeetMoraleBlock,
  fmtContractMoney,
  fmtMoney,
  HoverTip,
  InfoDot,
  InstructionHintRow,
  ProfileAttrColumn,
  ProfilePlayerIdentity,
  type ProfileTabId,
} from './profileUi'

type Props = {
  profile: ProfilePayload
  showEngineAttrs: boolean
  activeTab: ProfileTabId
  profileHighlightArchetypeId: string
  onHighlightArchetypeId: (archetypeId: string) => void
  onOpenPredecessor?: (staffIndex: number) => void
}

export function PlayerProfileTabViews({
  profile,
  showEngineAttrs,
  activeTab,
  profileHighlightArchetypeId,
  onHighlightArchetypeId,
  onOpenPredecessor,
}: Props) {
  const displayProfile = useMemo(() => {
    const pack = highlightPackForArchetype(profile, profileHighlightArchetypeId)
    if (!pack) return profile
    return applyProfileHighlightPack(profile, pack)
  }, [profile, profileHighlightArchetypeId])

  const p = displayProfile

  const naturalRolePicker =
    profile.effByArchetype && profile.effByArchetype.length > 0 ? (
      <NaturalRoleHighlightPicker
        profile={profile}
        activeArchetypeId={profileHighlightArchetypeId}
        onSelectArchetype={onHighlightArchetypeId}
      />
    ) : null

  if (activeTab === 'attributes') {
    return (
      <div className="space-y-3">
        {naturalRolePicker}
        <HoverTip
          tip={
            <p>
              Row tint and amber rings follow the Eff % recipe for the role selected (
              <span className="font-mono text-zinc-200">{p.highlightRolesLabel}</span>).{' '}
              <span className="font-semibold text-sky-400">Blue labels</span> mark forum key attributes for that
              position (e.g. marking / tackling / positioning for a DM). Use Eff % by recipe below scouting on the main
              window, or the tiles above in this pop-out.
            </p>
          }
        >
          <h3 className="mb-1 flex cursor-default items-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Attributes
            <InfoDot />
          </h3>
        </HoverTip>
        <div
          key={`attr-${profileHighlightArchetypeId}`}
          className="grid grid-cols-3 gap-x-2 border-t border-zinc-800/60 pt-2"
        >
          <ProfileAttrColumn cells={p.attrColumns[0]} showEngineAttrs={showEngineAttrs} />
          <ProfileAttrColumn cells={p.attrColumns[1]} showEngineAttrs={showEngineAttrs} />
          <div className="min-w-0">
            <ProfileAttrColumn cells={p.attrColumns[2]} showEngineAttrs={showEngineAttrs} />
            <FeetMoraleBlock feet={p.feetMorale} showEngineAttrs={showEngineAttrs} />
          </div>
        </div>
      </div>
    )
  }

  if (activeTab === 'hidden') {
    return (
      <div className="space-y-3">
        {naturalRolePicker}
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Hidden
          <span className="ml-2 font-normal normal-case text-zinc-600">
            · <span className="font-semibold text-sky-400">Blue</span> = community bankers (consistency, big games,
            fitness, professionalism)
          </span>
        </h3>
        <div
          key={`hidden-${profileHighlightArchetypeId}`}
          className="grid grid-cols-3 gap-x-2 border-t border-zinc-800/60 pt-2"
        >
          <ProfileAttrColumn cells={p.hiddenColumns[0]} showEngineAttrs={showEngineAttrs} />
          <ProfileAttrColumn cells={p.hiddenColumns[1]} showEngineAttrs={showEngineAttrs} />
          <ProfileAttrColumn cells={p.hiddenColumns[2]} showEngineAttrs={showEngineAttrs} />
        </div>
      </div>
    )
  }

  if (activeTab === 'contract') {
    return profile.contract ? (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
        <h3 className="mb-2 font-semibold text-zinc-300">Contract</h3>
        <div className="grid grid-cols-2 gap-1 text-zinc-400">
          <span>Wage</span>
          <span className="text-right text-zinc-200">{fmtMoney(profile.contract.wage)}</span>
          <span>Goal bonus</span>
          <span className="text-right text-zinc-200">{fmtContractMoney(profile.contract.goalBonus)}</span>
          <span>Assist bonus</span>
          <span className="text-right text-zinc-200">{fmtContractMoney(profile.contract.assistBonus)}</span>
          <span>Release fee</span>
          <span className="text-right text-zinc-200">{fmtContractMoney(profile.contract.releaseFee)}</span>
          <span>Contract type</span>
          <span className="text-right text-zinc-200">{profile.contract.typeLabel}</span>
          <span>Started</span>
          <span className="text-right font-mono text-zinc-200">
            {profile.contract.dateStarted ? formatIsoDateUk(profile.contract.dateStarted) : '—'}
          </span>
          <span>Expires</span>
          <span className="text-right font-mono text-zinc-200">
            {profile.contract.contractExpires ? formatIsoDateUk(profile.contract.contractExpires) : '—'}
          </span>
          <span>Bosman / free</span>
          <span className="text-right text-zinc-200">{profile.contract.leavingOnBosman ? 'Yes' : 'No'}</span>
          <span>Min-fee release</span>
          <span className="text-right text-zinc-200">{profile.contract.minimumReleaseClause ? 'Yes' : 'No'}</span>
        </div>
      </div>
    ) : (
      <p className="text-xs text-zinc-500">No contract data for this player.</p>
    )
  }

  if (activeTab === 'transfer') {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
        <h3 className="mb-2 font-semibold text-zinc-300">Transfer</h3>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-zinc-400">
          <span>Value</span>
          <span className="text-right font-mono text-zinc-200">{fmtMoney(profile.transfer.value)}</span>
          <span>Listed by club</span>
          <span className={`text-right ${profile.transfer.listedByClub ? 'text-emerald-300' : 'text-zinc-500'}`}>
            {profile.transfer.listedByClub ? 'Yes' : 'No'}
          </span>
          <span>Listed by request</span>
          <span className={`text-right ${profile.transfer.listedByRequest ? 'text-emerald-300' : 'text-zinc-500'}`}>
            {profile.transfer.listedByRequest ? 'Yes' : 'No'}
          </span>
          <span>Listed for loan</span>
          <span className={`text-right ${profile.transfer.listedForLoan ? 'text-emerald-300' : 'text-zinc-500'}`}>
            {profile.transfer.listedForLoan ? 'Yes' : 'No'}
          </span>
          <span>Future transfer</span>
          <span className="text-right text-zinc-200">{profile.transfer.futureTransferToClubName ?? '—'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {profile.regen?.isLikely && (
        <RegenProfileHint
          regen={profile.regen}
          variant="section"
          onOpenPredecessor={onOpenPredecessor}
        />
      )}

      {naturalRolePicker}

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
        <h3 className="mb-1.5 font-semibold text-zinc-300">Player Instructions</h3>
        <ul className="space-y-1.5">
          {profile.tacticalInstructionHints.map((h) => (
            <InstructionHintRow key={h.id} label={h.label} tier={h.tier} reason={h.reason} />
          ))}
        </ul>
      </div>

      <CurrentSeasonStatsTable seasonStats={profile.seasonStats} />
    </div>
  )
}

function statNum(v: number | null | undefined): string {
  return v != null && v !== 0 ? String(v) : v === 0 ? '0' : '—'
}
function statRating(v: number | null | undefined): string {
  return v != null ? v.toFixed(2) : '—'
}
function statRate(v: number | null | undefined): string {
  return v != null ? v.toFixed(1) : '—'
}

/** CM-style current-season breakdown: per scope (League/Cup/Continental/Senior) + per competition. */
export function CurrentSeasonStatsTable({
  seasonStats,
}: {
  seasonStats: ProfilePayload['seasonStats']
}) {
  const scopes = seasonStats.cmHistoryScopes ?? []
  const comps = seasonStats.cmCompetitionRows ?? []
  const visibleScopes = scopes.filter(
    (s) => s.key === 'seniorClub' || s.apps > 0 || s.goals > 0 || s.assists > 0,
  )
  const hasData = seasonStats.cmHistoryAvailable && visibleScopes.length > 0

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
      <h3 className="mb-2 font-semibold text-zinc-300">
        Current season
        {seasonStats.cmHistorySeasonLabel ? (
          <span className="ml-2 font-mono text-sm font-normal text-emerald-200/90">
            {seasonStats.cmHistorySeasonLabel}
          </span>
        ) : null}
      </h3>

      {!hasData ? (
        <p className="px-1 py-2 text-zinc-500">
          {seasonStats.savePerformanceHint ?? 'No current-season stats decoded for this player.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-emerald-900/40 bg-emerald-950/20">
          <table className="w-full min-w-[22rem] border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-500">
                <th className="px-2 py-1.5 font-medium">Competition</th>
                <th className="px-2 py-1.5 text-right font-mono font-medium">Apps</th>
                <th className="px-2 py-1.5 text-right font-mono font-medium">Gls</th>
                <th className="px-2 py-1.5 text-right font-mono font-medium">Ast</th>
                <th className="px-2 py-1.5 text-right font-mono font-medium">MoM</th>
                <th className="px-2 py-1.5 text-right font-mono font-medium">Drb</th>
                <th className="px-2 py-1.5 text-right font-mono font-medium">Av R</th>
              </tr>
            </thead>
            <tbody>
              {visibleScopes.map((s) => {
                const senior = s.key === 'seniorClub'
                return (
                  <tr
                    key={s.key}
                    className={
                      senior
                        ? 'border-t border-emerald-800/50 bg-emerald-950/40 font-semibold'
                        : 'border-b border-zinc-800/40'
                    }
                  >
                    <td className="px-2 py-1.5 text-zinc-100">{s.label}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-200">{statNum(s.apps)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-200">{statNum(s.goals)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-zinc-300">{statNum(s.assists)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-zinc-300">{statNum(s.mom)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-zinc-300">{statRate(s.dribbles)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-amber-200">{statRating(s.averageRating)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {comps.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            By competition
          </p>
          <div className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950/40">
            <table className="w-full min-w-[22rem] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-500">
                  <th className="px-2 py-1.5 font-medium">Competition</th>
                  <th className="px-2 py-1.5 text-right font-mono font-medium">Apps</th>
                  <th className="px-2 py-1.5 text-right font-mono font-medium">Gls</th>
                  <th className="px-2 py-1.5 text-right font-mono font-medium">Ast</th>
                  <th className="px-2 py-1.5 text-right font-mono font-medium">MoM</th>
                  <th className="px-2 py-1.5 text-right font-mono font-medium">Av R</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c) => (
                  <tr key={c.competitionId} className="border-b border-zinc-800/40">
                    <td className="max-w-[14rem] truncate px-2 py-1.5 text-zinc-100" title={c.competitionName}>
                      {c.competitionName}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-200">{statNum(c.apps)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-200">{statNum(c.goals)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-zinc-300">{statNum(c.assists)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-zinc-300">{statNum(c.mom)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-amber-200">{statRating(c.averageRating)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export function PlayerProfileHeader({ profile }: { profile: ProfilePayload }) {
  return (
    <div className="border-b border-zinc-800/80 pb-3">
      <ProfilePlayerIdentity profile={profile} compact />
      <p className="mt-2 text-sm">
        <span className="text-zinc-500">CA</span>{' '}
        <span className="font-mono text-emerald-300">{profile.ca}</span>
        <span className="mx-2 text-zinc-600">|</span>
        <span className="text-zinc-500">PA</span>{' '}
        <span className="font-mono text-emerald-300">{profile.pa}</span>
      </p>
    </div>
  )
}
