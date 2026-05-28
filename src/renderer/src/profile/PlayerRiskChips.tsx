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
  if (!injuryRisk && !disciplineRisk && !lowConsistencyRisk) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {injuryRisk && (
        <span className="rounded-md border border-amber-700/50 bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-200/90">
          Injury risk
        </span>
      )}
      {disciplineRisk && (
        <span className="rounded-md border border-orange-700/50 bg-orange-950/40 px-2 py-0.5 text-[10px] font-medium text-orange-200/90">
          Discipline risk
        </span>
      )}
      {lowConsistencyRisk && (
        <span className="rounded-md border border-zinc-600/50 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
          Low consistency
        </span>
      )}
    </div>
  )
}
