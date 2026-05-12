import { ListFilterCombo } from './ListFilterCombo'

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
    />
  )
}
