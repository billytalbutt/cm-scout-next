import {
  POSITION_ROLE_FILTER_MAIN,
  POSITION_ROLE_FILTER_NICHE,
  POSITION_SIDE_FILTER_OPTIONS,
  type PositionRoleFilterId,
  type PositionSideFilterId,
} from '../../../shared/playerPositionFilter'

export type PlayerPositionFilterState = {
  roles: PositionRoleFilterId[]
  sides: PositionSideFilterId[]
}

type Props = {
  roles: PositionRoleFilterId[]
  sides: PositionSideFilterId[]
  onChange: (next: PlayerPositionFilterState) => void
}

function toggleRole(list: PositionRoleFilterId[], id: PositionRoleFilterId, on: boolean): PositionRoleFilterId[] {
  if (on) return list.includes(id) ? list : [...list, id]
  return list.filter((x) => x !== id)
}

function toggleSide(list: PositionSideFilterId[], id: PositionSideFilterId, on: boolean): PositionSideFilterId[] {
  if (on) return list.includes(id) ? list : [...list, id]
  return list.filter((x) => x !== id)
}

function RoleCheck({
  id,
  label,
  checked,
  onToggle,
}: {
  id: PositionRoleFilterId
  label: string
  checked: boolean
  onToggle: (id: PositionRoleFilterId, on: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-300">
      <input
        type="checkbox"
        className="shrink-0 rounded border-zinc-600"
        checked={checked}
        onChange={(e) => onToggle(id, e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

function SideCheck({
  id,
  label,
  checked,
  onToggle,
}: {
  id: PositionSideFilterId
  label: string
  checked: boolean
  onToggle: (id: PositionSideFilterId, on: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-300">
      <input
        type="checkbox"
        className="shrink-0 rounded border-zinc-600"
        checked={checked}
        onChange={(e) => onToggle(id, e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

/** CM Scout–style natural position + side filters (AND across all ticked boxes). */
export function PlayerPositionFilterPanel({ roles, sides, onChange }: Props) {
  const onRole = (id: PositionRoleFilterId, on: boolean) =>
    onChange({ roles: toggleRole(roles, id, on), sides })
  const onSide = (id: PositionSideFilterId, on: boolean) =>
    onChange({ roles, sides: toggleSide(sides, id, on) })

  return (
    <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-2.5 py-2">
      <p className="filter-section-heading mb-0">Positions</p>
      <p className="text-[10px] leading-snug text-zinc-600">
        Natural suitability &gt;14. Every ticked role and side must match (AND).
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
        {POSITION_ROLE_FILTER_MAIN.map((o) => (
          <RoleCheck
            key={o.id}
            id={o.id as PositionRoleFilterId}
            label={o.label}
            checked={roles.includes(o.id as PositionRoleFilterId)}
            onToggle={onRole}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-y-1.5 border-t border-zinc-800/80 pt-2 sm:grid-cols-2">
        {POSITION_ROLE_FILTER_NICHE.map((o) => (
          <RoleCheck
            key={o.id}
            id={o.id as PositionRoleFilterId}
            label={o.label}
            checked={roles.includes(o.id as PositionRoleFilterId)}
            onToggle={onRole}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-zinc-800/80 pt-2">
        {POSITION_SIDE_FILTER_OPTIONS.map((o) => (
          <SideCheck
            key={o.id}
            id={o.id as PositionSideFilterId}
            label={o.label}
            checked={sides.includes(o.id as PositionSideFilterId)}
            onToggle={onSide}
          />
        ))}
      </div>
    </div>
  )
}
