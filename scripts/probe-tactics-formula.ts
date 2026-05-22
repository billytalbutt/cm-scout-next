/**
 * Find intrinsic bytes that yield tool vs in-game tactical knowledge for known coaches.
 */
import {
  staffTacticsInGame,
  staffNpAttrInGame,
  staffNpCaDivConvert,
} from '../src/shared/cm0102StaffNpAttributeDisplay'
import { highConvert, inMatchValue } from '../src/shared/cm0102AttributeDisplay'

function staffTacticsBase(ca: number, raw: number): number {
  if (raw <= 3 && ca >= 175) return staffNpCaDivConvert(ca, raw, 35)
  if (raw <= 3) return staffNpCaDivConvert(ca, raw, 20)
  return staffNpCaDivConvert(ca, raw, 25)
}

const cases = [
  { name: 'Pomaski', ca: 182, tool: 8, game: 13 },
  { name: 'Malkin', ca: 186, tool: 12, game: 17 },
]

for (const c of cases) {
  console.log(`\n=== ${c.name} CA ${c.ca} tool ${c.tool} game ${c.game} ===`)
  for (let raw = -5; raw <= 20; raw++) {
    const base = staffTacticsBase(c.ca, raw)
    const tac = staffTacticsInGame(c.ca, raw)
    const hi = highConvert(c.ca, raw)
    const im = inMatchValue(c.ca, raw)
    if (tac === c.tool || tac === c.game || base === c.tool || hi === c.tool || im === c.tool) {
      console.log(
        `raw ${raw}: base=${base} tac=${tac} hi=${hi} im=${im} np=${staffNpAttrInGame('tactics', raw, c.ca)}`,
      )
    }
  }
}

console.log('\n=== Who shows tool=8 or 12? ===')
for (const ca of [182, 186, 120, 80, 60, 40]) {
  for (let raw = -5; raw <= 20; raw++) {
    const tac = staffTacticsInGame(ca, raw)
    if (tac === 8 || tac === 12) {
      console.log({ ca, raw, tac, hi: highConvert(ca, raw) })
    }
  }
}

for (let raw = -10; raw <= 10; raw++) {
  const t = staffNpCaDivConvert(182, raw, 35)
  if (t === 8 || t === 12 || t === 13) console.log('ca35 trunc 182', { raw, t })
}

console.log('\n=== highConvert = 8 (wrong path?) ===')
for (const ca of [20, 30, 40, 50, 60, 70, 80]) {
  for (let raw = 0; raw <= 20; raw++) {
    if (highConvert(ca, raw) === 8) console.log({ ca, raw, hi: 8 })
  }
}
