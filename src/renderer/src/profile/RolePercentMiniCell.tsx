import { cmScoutRoleTierCellClass, cmScoutRoleTierLabelClass } from './profileUi'

type Props = {
  label: string
  percent: string
  tier: 0 | 1 | 2 | undefined
  selected?: boolean
  onClick?: () => void
  title?: string
}

/** Compact role % tile — matches the 7-column CM Scout row under the profile. */
export function RolePercentMiniCell({ label, percent, tier, selected, onClick, title }: Props) {
  const cellClass = cmScoutRoleTierCellClass(tier)
  const labelClass = cmScoutRoleTierLabelClass(tier)
  const selectedClass = selected ? 'brightness-110 contrast-125' : ''
  const inner = (
    <>
      <div className={`truncate text-[8px] font-medium uppercase tracking-tight ${labelClass}`}>{label}</div>
      <div className="font-mono text-[10px] tabular-nums">{percent}</div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={`min-w-0 cursor-pointer rounded px-0.5 py-1 text-center transition hover:brightness-110 ${cellClass} ${selectedClass}`}
      >
        {inner}
      </button>
    )
  }

  return (
    <div
      title={title}
      className={`min-w-0 rounded px-0.5 py-1 text-center ${cellClass} ${selectedClass}`}
    >
      {inner}
    </div>
  )
}
