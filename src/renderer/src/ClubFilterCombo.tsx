import { ListFilterCombo } from './ListFilterCombo'

const CLUB_PLACEHOLDER_EXAMPLES = [
  'Real Madrid',
  'Manchester United',
  'AC Milan',
  'Barcelona',
  'Juventus',
  'Bayern Munich',
] as const

type Props = {
  clubs: string[]
  value: string
  onChange: (next: string) => void
}

export function ClubFilterCombo({ clubs, value, onChange }: Props) {
  return (
    <ListFilterCombo
      items={clubs}
      value={value}
      onChange={onChange}
      emptyPlaceholder="Club (load database for club list)"
      exampleCandidates={CLUB_PLACEHOLDER_EXAMPLES}
    />
  )
}
