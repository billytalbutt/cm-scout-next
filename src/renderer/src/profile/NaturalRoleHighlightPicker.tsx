import { useMemo } from 'react'
import type { ProfilePayload } from '../vite-env.d'
import { cmScoutRoleValueTierByRole } from './profileUi'
import { RolePercentMiniCell } from './RolePercentMiniCell'

type Props = {
  profile: ProfilePayload
  activeArchetypeId: string
  onSelectArchetype: (archetypeId: string) => void
}

/**
 * Eff % by recipe (natural roles) — click a tile to drive attribute / hidden highlights.
 * AMC and wide AM are separate tiles (both differ from CM Scout’s single “AM” column).
 */
export function NaturalRoleHighlightPicker({ profile, activeArchetypeId, onSelectArchetype }: Props) {
  const rows = profile.effByArchetype
  if (!rows?.length) return null

  const tierByRowIndex = useMemo(() => {
    const percents = rows.map((r) => r.percent)
    return cmScoutRoleValueTierByRole(percents)
  }, [rows])

  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
        Eff % by recipe (natural roles)
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {rows.map((row, rowIndex) => {
          const tier = tierByRowIndex.get(rowIndex)
          return (
            <RolePercentMiniCell
              key={row.archetypeId}
              label={row.archetypeLabel}
              percent={`${row.percent.toFixed(1)}%`}
              tier={tier}
              selected={activeArchetypeId === row.archetypeId}
              title={`Highlight key attributes for ${row.archetypeLabel} recipe`}
              onClick={() => onSelectArchetype(row.archetypeId)}
            />
          )
        })}
      </div>
    </div>
  )
}
