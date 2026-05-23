import {
  cmScoutIndexFromEffectivenessArchetypeId,
} from '../../../shared/profileHighlightRole'
import type { ProfilePayload } from '../vite-env.d'

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

  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
        Eff % by recipe (natural roles)
      </p>
      <p className="mt-0.5 text-[9px] leading-snug text-zinc-600">
        Green = best recipe %. Click a role to update attribute highlights above.
      </p>
      <div className="mt-1 grid grid-cols-4 gap-1 text-center">
        {rows.map((row) => {
          const roleIdx = cmScoutIndexFromEffectivenessArchetypeId(row.archetypeId)
          if (roleIdx == null) return null
          const highlightActive = activeRoleIdx === roleIdx
          return (
            <button
              key={row.archetypeId}
              type="button"
              title={`Highlight key attributes for ${row.archetypeLabel}`}
              onClick={() => onSelectRole(roleIdx)}
              className={`cursor-pointer rounded px-1 py-1 text-center transition hover:bg-zinc-800/60 ${
                row.isWinner ? 'bg-emerald-950/40 ring-1 ring-emerald-500/45' : 'bg-zinc-900/50'
              } ${
                highlightActive ? 'ring-2 ring-sky-400/70 ring-offset-1 ring-offset-zinc-900' : ''
              }`}
            >
              <p className="text-[8px] uppercase tracking-wide text-zinc-500">{row.archetypeLabel}</p>
              <p
                className={`font-mono text-[11px] ${
                  row.isWinner ? 'text-emerald-200' : 'text-zinc-300'
                }`}
              >
                {row.percent.toFixed(1)}%
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
