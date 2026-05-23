import { staffTacticsInGame, staffNpCaDivConvert } from '../src/shared/cm0102StaffNpAttributeDisplay'
import { highConvert } from '../src/shared/cm0102AttributeDisplay'

function quad(ca: number, raw: number, div: number, round: boolean) {
  const d = raw / 10 + ca / div + 10
  let r = (d * d) / 30 + d / 3 + 0.5
  if (r < 1) r = 1
  else if (r > 20) r = 20
  return round ? Math.round(r) : Math.trunc(r)
}

const cases = [
  { name: 'Pomaski', ca: 182, want: 13 },
  { name: 'Malkin', ca: 186, want: 17 },
  { name: 'Kidd', ca: 154, want: 16 },
]

for (const c of cases) {
  console.log(`\n${c.name} CA ${c.ca} want ${c.want}`)
  for (let raw = 0; raw <= 10; raw++) {
    const cur = staffTacticsInGame(c.ca, raw)
    const variants: Record<string, number> = {
      cur,
      ca35t: quad(c.ca, raw, 35, false),
      ca25r: quad(c.ca, raw, 25, true),
      ca25t: quad(c.ca, raw, 25, false),
      ca20r: quad(c.ca, raw, 20, true),
      hi: highConvert(c.ca, raw),
      hi1: Math.max(1, highConvert(c.ca, raw) - 1),
      ca25r_m1: Math.max(1, quad(c.ca, raw, 25, true) - 1),
    }
    const hit = Object.entries(variants).filter(([, v]) => v === c.want).map(([k]) => k)
    if (hit.length) console.log(`  raw ${raw}:`, hit.join(', '))
  }
}
