import { highConvert, lowConvert, inMatchValue } from '../src/shared/cm0102AttributeDisplay'

const ca = 182
const raw = 1
const targets = { manHandling: 16, tactics: 13, coachingGks: 18 }
const fns: Record<string, () => number> = {
  high: () => highConvert(ca, raw),
  low: () => lowConvert(ca, raw),
  im: () => inMatchValue(ca, raw),
  mid: () => Math.trunc((highConvert(ca, raw) + lowConvert(ca, raw)) / 2),
  h3: () => highConvert(ca, raw) - 3,
  h6: () => highConvert(ca, raw) - 6,
  cadep: () => {
    const ab = Math.floor(ca / 2) + 80
    return Math.trunc((2 * raw + ab) * 0.1)
  },
}
function caDivConvert(ca: number, intrinsic: number, div: number): number {
  const d = intrinsic / 10 + ca / div + 10
  let r = (d * d) / 30 + d / 3 + 0.5
  if (r < 1) r = 1
  else if (r > 20) r = 20
  return Math.trunc(r)
}

for (const [k, want] of Object.entries(targets)) {
  console.log(k, 'want', want)
  for (const [n, fn] of Object.entries(fns)) {
    if (fn() === want) console.log(' ', n, fn())
  }
}

console.log('\nraw sweep ca=182:')
for (const raw of [1, 2, 7, 13, 16, 20]) {
  console.log(
    'raw',
    raw,
    'high',
    highConvert(ca, raw),
    'ca25',
    caDivConvert(ca, raw, 25),
    'ca35',
    caDivConvert(ca, raw, 35),
    'high-1',
    highConvert(ca, raw) - 1,
  )
}
