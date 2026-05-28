/** Availability / discipline flags — separate from Eff % (on-pitch quality only). */
export function PlayerRiskChips({
  injuryRisk,
  disciplineRisk,
  lowConsistencyRisk,
}: {
  injuryRisk?: boolean
  disciplineRisk?: boolean
  lowConsistencyRisk?: boolean
}) {
  const parts: { key: string; label: string; className: string }[] = []
  if (injuryRisk) {
    parts.push({ key: 'injury', label: 'Injury risk', className: 'font-semibold text-rose-400/95' })
  }
  if (disciplineRisk) {
    parts.push({ key: 'discipline', label: 'Discipline risk', className: 'font-semibold text-amber-300/95' })
  }
  if (lowConsistencyRisk) {
    parts.push({ key: 'consistency', label: 'Low consistency', className: 'font-semibold text-amber-200/90' })
  }

  if (parts.length === 0) return null

  return (
    <p className="text-[11px] leading-snug">
      {parts.map((part, i) => (
        <span key={part.key}>
          {i > 0 && <span className="font-normal text-zinc-600"> · </span>}
          <span className={part.className}>{part.label}</span>
        </span>
      ))}
    </p>
  )
}
