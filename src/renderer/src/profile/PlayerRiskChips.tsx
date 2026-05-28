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
  const parts: { key: string; label: string; tone: 'alert' | 'muted' }[] = []
  if (injuryRisk) parts.push({ key: 'injury', label: 'Injury risk', tone: 'alert' })
  if (disciplineRisk) parts.push({ key: 'discipline', label: 'Discipline risk', tone: 'alert' })
  if (lowConsistencyRisk) parts.push({ key: 'consistency', label: 'Low consistency', tone: 'muted' })

  if (parts.length === 0) return null

  return (
    <p className="text-[11px] leading-snug text-zinc-500">
      {parts.map((part, i) => (
        <span key={part.key}>
          {i > 0 && <span className="text-zinc-600"> · </span>}
          <span className={part.tone === 'alert' ? 'text-rose-300/90' : 'text-zinc-400'}>{part.label}</span>
        </span>
      ))}
    </p>
  )
}
