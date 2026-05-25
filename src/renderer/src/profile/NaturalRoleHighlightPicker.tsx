import { useMemo } from 'react'
import { cmScoutIndexFromEffectivenessArchetypeId } from '../../../shared/profileHighlightRole'
import type { ProfilePayload } from '../vite-env.d'
import { cmScoutRoleValueTierByRole } from './profileUi'
import { RolePercentMiniCell } from './RolePercentMiniCell'

type Props = {
  profile: ProfilePayload
  activeRoleIdx: number
  onSelectRole: (roleCmScoutIndex: number) => void
}

/**
 * Eff % by recipe (natural roles) — click a tile to drive attribute / hidden highlights.
 */
export function NaturalRoleHighlightPicker({ profile, activeRoleIdx, onSelectRole }: Props) {
  const rows = profile.effByArchetype
  if (!rows?.length) return null

  const tierByRowIndex = useMemo(() => {
    const percents = rows.map((r) => r.percent)
    return cmScoutRoleValueTierByRole(percents)
  }, [rows])

  const colClass =
    rows.length >= 7 ? 'grid-cols-7' : rows.length >= 5 ? 'grid-cols-5' : 'grid-cols-4'

  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
        Eff % by recipe (natural roles)
      </p>
      <div className={`mt-1 grid ${colClass} gap-1 text-center`}>
        {rows.map((row, rowIndex) => {
          const roleIdx = cmScoutIndexFromEffectivenessArchetypeId(row.archetypeId)
          if (roleIdx == null) return null
          const tier = tierByRowIndex.get(rowIndex)
          return (
            <RolePercentMiniCell
              key={row.archetypeId}
              label={row.archetypeLabel}
              percent={`${row.percent.toFixed(1)}%`}
              tier={tier}
              selected={activeRoleIdx === roleIdx}
              title={`Highlight key attributes for ${row.archetypeLabel}`}
              onClick={() => onSelectRole(roleIdx)}
            />
          )
        })}
      </div>
    </div>
  )
}
