import type { ClubDetailPayload } from '../ClubBrowsePanel'

type Props = {
  loadInfo: boolean
  detail: ClubDetailPayload | null
  selectedStaffIndex: number | null
  onOpenPlayerProfile: (staffIndex: number) => void
}

export function ClubDetailPane({ loadInfo, detail, selectedStaffIndex, onOpenPlayerProfile }: Props) {
  if (!loadInfo) {
    return <p className="text-sm text-zinc-500">Load a database to browse clubs.</p>
  }

  if (!detail) {
    return (
      <p className="text-sm text-zinc-500">
        Pick a club from the search list on the left to view squad, stadium, and club info here.
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">{detail.name}</h2>
        <p className="text-sm text-zinc-500">
          {detail.nation} · {detail.division}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-zinc-400 sm:grid-cols-3">
          <dt>Reputation</dt>
          <dd className="font-mono text-zinc-200">{detail.reputation}</dd>
          <dt>Club funds</dt>
          <dd className="font-mono text-zinc-200">{detail.cash.toLocaleString()}</dd>
          <dt>Attendance</dt>
          <dd className="font-mono text-zinc-200">{detail.attendance.toLocaleString()}</dd>
          <dt>Training facilities</dt>
          <dd className="font-mono text-zinc-200">
            {detail.training} <span className="text-zinc-500">/ 20</span>
          </dd>
        </dl>
        {detail.stadium && (
          <div className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 text-xs text-zinc-400">
            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Stadium</h3>
            <p className="font-medium text-zinc-200">{detail.stadium.name}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              <dt>Capacity</dt>
              <dd className="font-mono text-zinc-200">{detail.stadium.capacity.toLocaleString()}</dd>
              <dt>Seating</dt>
              <dd className="font-mono text-zinc-200">{detail.stadium.seatingCapacity.toLocaleString()}</dd>
              <dt>Expansion cap.</dt>
              <dd className="font-mono text-zinc-200">{detail.stadium.expansionCapacity.toLocaleString()}</dd>
              <dt>Covered</dt>
              <dd className="text-zinc-200">{detail.stadium.covered ? 'Yes' : 'No'}</dd>
              <dt>Soil heating</dt>
              <dd className="text-zinc-200">{detail.stadium.underSoilHeating ? 'Yes' : 'No'}</dd>
            </dl>
          </div>
        )}
        {detail.xiNames && detail.xiNames.length > 0 && (
          <div className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 text-xs text-zinc-400">
            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Team selected (up to 11)
            </h3>
            <ol className="list-inside list-decimal text-zinc-300">
              {detail.xiNames.map((x) => (
                <li key={x.staffId}>
                  {x.name} <span className="font-mono text-zinc-500">({x.staffId})</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Squad ({detail.squad.length})
        </h3>
        <div className="cm-scroll min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-800">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-900/95 text-zinc-500">
              <tr>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">CA</th>
                <th className="px-3 py-2">PA</th>
              </tr>
            </thead>
            <tbody>
              {detail.squad.map((p) => (
                <tr
                  key={p.staffIndex}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenPlayerProfile(p.staffIndex)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpenPlayerProfile(p.staffIndex)
                    }
                  }}
                  className={`cursor-pointer border-b border-zinc-800/50 transition hover:bg-zinc-800/40 ${
                    selectedStaffIndex === p.staffIndex ? 'bg-emerald-950/30' : ''
                  }`}
                >
                  <td className="px-3 py-1.5 font-medium text-zinc-200">{p.name}</td>
                  <td className="px-3 py-1.5 font-mono text-zinc-300">{p.ca}</td>
                  <td className="px-3 py-1.5 font-mono text-zinc-300">{p.pa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">Click a player to open their profile on the right.</p>
      </div>
    </div>
  )
}
