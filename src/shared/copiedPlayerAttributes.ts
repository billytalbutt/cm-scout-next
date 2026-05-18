/** In-memory clipboard for attribute editor copy / paste (same session). */

export type CopiedPlayerAttributes = {
  staffIndex: number
  name: string
  values: Record<string, number>
  copiedAt: number
}

let copied: CopiedPlayerAttributes | null = null
const listeners = new Set<() => void>()

export function getCopiedPlayerAttributes(): CopiedPlayerAttributes | null {
  return copied
}

export function setCopiedPlayerAttributes(next: CopiedPlayerAttributes | null): void {
  copied = next
  for (const fn of listeners) fn()
}

export function subscribeCopiedPlayerAttributes(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
