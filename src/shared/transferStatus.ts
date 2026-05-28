export function transferListedByClub(ts: number): boolean {
  return (ts & 1) === 1
}

export function transferListedByRequest(ts: number): boolean {
  return (ts & 8) === 8
}

export function listedForLoan(ts: number): boolean {
  return (ts & 2) === 2
}

export function applyTransferStatusBits(
  ts: number,
  flags: { listedByClub: boolean; listedByRequest: boolean; listedForLoan: boolean },
): number {
  let v = ts & ~0x0b
  if (flags.listedByClub) v |= 1
  if (flags.listedForLoan) v |= 2
  if (flags.listedByRequest) v |= 8
  return v
}
