import { useMemo } from 'react'
import { CM_SCOUT_ROLE_PROFILE_UI_ORDER, CM_SCOUT_ROLE_SHORT } from '../../../shared/cmScoutRoles'
import { EliteEngineStar } from '../grid/EliteEngineStar'
import type { ProfilePayload } from '../vite-env.d'
import { applyProfileHighlightPack } from '../profileHighlightApply'
import {
  cmScoutRoleValueTierByRole,
  FeetMoraleBlock,
  fmtContractMoney,
  fmtMoney,
  HoverTip,
  InfoDot,
  playerInstructionAdvice,
  ProfileAttrColumn,
  type ProfileTabId,
} from './profileUi'

type Props = {
  profile: ProfilePayload
  showEngineAttrs: boolean
  activeTab: ProfileTabId
  profileHighlightRoleIdx: number
  onHighlightRoleIdx: (roleIdx: number) => void
  onOpenPredecessor?: (staffIndex: number) => void
}

export function PlayerProfileTabViews({
  profile,
  showEngineAttrs,
  activeTab,
  profileHighlightRoleIdx,
  onHighlightRoleIdx,
  onOpenPredecessor,
}: Props) {
  const displayProfile = useMemo(() => {
    const pack = profile.highlightPacksByCmScoutIndex?.[profileHighlightRoleIdx]
    if (!pack) return profile
    return applyProfileHighlightPack(profile, pack)
  }, [profile, profileHighlightRoleIdx])

  const p = displayProfile

  if (activeTab === 'attributes') {
    return (
      <div className="space-y-3">
        <HoverTip
          tip={
            <p>
              Row tint and amber rings follow the selected role in CM Scout % by role (
              <span className="font-mono text-zinc-200">{p.highlightRolesLabel}</span>). Click a role on the Scouting
              tab to switch.
            </p>
          }
        >
          <h3 className="mb-1 flex cursor-default items-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Attributes
            <InfoDot />
          </h3>
        </HoverTip>
        <div className="grid grid-cols-3 gap-x-2 border-t border-zinc-800/60 pt-2">
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
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Hidden</h3>
        <div className="grid grid-cols-3 gap-x-2 border-t border-zinc-800/60 pt-2">
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
          <span className="text-right font-mono text-zinc-200">{profile.contract.dateStarted ?? '—'}</span>
          <span>Expires</span>
          <span className="text-right font-mono text-zinc-200">{profile.contract.contractExpires ?? '—'}</span>
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
        <div className="rounded-lg border border-violet-800/50 bg-violet-950/25 p-3 text-xs">
          <h3 className="font-semibold text-violet-200/95">Regen lineage</h3>
          {profile.regen.ofName ? (
            <p className="mt-1.5 text-zinc-300">
              Likely regen of{' '}
              <span className="font-medium text-violet-100">{profile.regen.ofName}</span>
              {profile.regen.source === 'snapshot' ? (
                <span className="text-zinc-500"> (snapshot — GPF2-style)</span>
              ) : (
                <span className="text-zinc-500"> (heuristic)</span>
              )}
            </p>
          ) : (
            <p className="mt-1.5 text-zinc-400">Flagged as likely regen; predecessor unknown.</p>
          )}
          {profile.regen.ofStaffIndex != null && onOpenPredecessor && (
            <button
              type="button"
              className="mt-2 rounded-md border border-violet-600/40 bg-violet-900/30 px-2 py-1 text-[11px] text-violet-100 hover:bg-violet-900/50"
              onClick={() => onOpenPredecessor(profile.regen!.ofStaffIndex!)}
            >
              Open predecessor profile
            </button>
          )}
        </div>
      )}

      {profile.cmScoutRolePercents && profile.cmScoutRolePercents.length === 7 && (
        <div className="rounded-lg border border-zinc-800/90 bg-zinc-900/40 p-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">CM Scout % by role</h3>
          {profile.cmScoutRatingBp != null && (
            <p className="mt-1 font-mono text-[11px] text-emerald-300/95">
              BP (grid) <span className="text-emerald-200">{profile.cmScoutRatingBp}%</span>
            </p>
          )}
          <div className="mt-2 grid grid-cols-7 gap-1 text-center">
            {(() => {
              const percents = profile.cmScoutRolePercents!
              const tierByRole = cmScoutRoleValueTierByRole(percents)
              return CM_SCOUT_ROLE_PROFILE_UI_ORDER.map((roleIdx) => {
                const lab = CM_SCOUT_ROLE_SHORT[roleIdx]!
                const pct = percents[roleIdx]!
                const suit = profile.cmScoutRoleSuitable?.[roleIdx]
                const tier = tierByRole.get(roleIdx)
                const highlightActive = profileHighlightRoleIdx === roleIdx
                return (
                  <button
                    key={lab + roleIdx}
                    type="button"
                    title={`Highlight key attributes for ${lab}`}
                    onClick={() => onHighlightRoleIdx(roleIdx)}
                    className={`min-w-0 cursor-pointer rounded border px-0.5 py-1 transition hover:bg-zinc-800/60 ${
                      suit ? 'border-emerald-500/35 bg-emerald-500/[0.06]' : 'border-zinc-800/80 bg-zinc-950/40'
                    } ${highlightActive ? 'ring-2 ring-sky-400/70 ring-offset-1 ring-offset-zinc-900' : ''} ${
                      tier === 0 ? 'ring-1 ring-emerald-500/50' : ''
                    }`}
                  >
                    <div className="truncate text-[8px] font-medium uppercase text-zinc-500">{lab}</div>
                    <div className="font-mono text-[10px] tabular-nums text-zinc-200">{pct}%</div>
                  </button>
                )
              })
            })()}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-sky-900/40 bg-sky-950/20 p-3 text-xs">
        <h3 className="mb-1.5 font-semibold text-sky-200/95">Scouting DNA &amp; instructions</h3>
        {profile.engineMetaProfiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {profile.engineMetaProfiles.map((m) => (
              <span
                key={m.id}
                className="rounded border border-sky-600/35 bg-sky-950/40 px-1.5 py-0.5 font-mono text-[10px] text-sky-100/95"
              >
                {m.label}
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-zinc-400">{profile.freeRoleHint.headline}</p>
        <ul className="mt-2 space-y-1">
          {profile.tacticalInstructionHints.slice(0, 8).map((h) => (
            <li key={h.id} className="text-[10px] text-zinc-400">
              <span className="text-zinc-300">{h.label}</span> {playerInstructionAdvice(h.tier)}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
        <h3 className="mb-2 font-semibold text-zinc-300">
          Current season
          {profile.seasonStats.cmHistorySeasonLabel ? (
            <span className="ml-2 font-mono text-sm font-normal text-emerald-200/90">
              {profile.seasonStats.cmHistorySeasonLabel}
            </span>
          ) : null}
        </h3>
        {profile.seasonStats.currentSeasonPerformance ? (
          <p className="font-mono text-zinc-200">
            {profile.seasonStats.currentSeasonPerformance.label}:{' '}
            {profile.seasonStats.currentSeasonPerformance.apps} apps,{' '}
            {profile.seasonStats.currentSeasonPerformance.goals} goals
          </p>
        ) : (
          <p className="text-zinc-500">No current-season row resolved.</p>
        )}
      </div>
    </div>
  )
}

export function PlayerProfileHeader({ profile }: { profile: ProfilePayload }) {
  return (
    <div className="border-b border-zinc-800/80 pb-3">
      <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-white">
        {profile.eliteEngineBadgeKind && profile.eliteEngineBadgeTitle && (
          <EliteEngineStar title={profile.eliteEngineBadgeTitle} detail={profile.eliteEngineBadgeDetail ?? ''} />
        )}
        <span>{profile.name}</span>
      </h2>
      <p className="mt-1 text-sm text-emerald-200/90">{profile.positionLabel}</p>
      <p className="mt-1 text-sm text-zinc-200">{profile.nationDisplay}</p>
      <p className="text-xs text-zinc-500">{profile.club}</p>
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
