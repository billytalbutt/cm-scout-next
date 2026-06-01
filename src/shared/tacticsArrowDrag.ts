import type { TacticArrow } from './tacticsCommunityPresets'
import {
  computeMovementArrow,
  nearestColumnIndex,
  snapTo,
  tacticalRowForY,
  tacticalRowY,
  type PitchColumnIndex,
  type PitchSlot,
  type TacticalRowId,
} from './tacticsPitchSnap'

export type ArrowDragTarget = {
  rowId: TacticalRowId
  column: PitchColumnIndex
  x: number
  y: number
}

/** Grid X snap points for movement arrows (5 columns + half-space / narrow positions). */
export const ARROW_SNAP_X = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] as const

/** Half-icon radius in pitch-widget % coords (matches h-8 w-8 circles on ~420×650px pitch). */
const ICON_RX_PCT = 3.6
const ICON_RY_PCT = 2.4

const ROW_X_MATCH = 0.1

export function findSlotOnRow(
  slots: PitchSlot[],
  rowId: TacticalRowId,
  x: number,
  excludeSlotId?: string,
): PitchSlot | undefined {
  return slots.find(
    (s) =>
      s.id !== excludeSlotId &&
      tacticalRowForY(s.y) === rowId &&
      Math.abs(s.x - x) < ROW_X_MATCH,
  )
}

/** Snap pointer to tactical row + nearest grid column (or existing player on that row). */
export function snapArrowDragTarget(
  x: number,
  y: number,
  slots: PitchSlot[] = [],
  excludeSlotId?: string,
): ArrowDragTarget {
  const rowId = tacticalRowForY(y)
  const rowY = tacticalRowY(rowId)
  let snappedX = snapTo(x, ARROW_SNAP_X)

  const occupant = slots.find(
    (s) =>
      s.id !== excludeSlotId &&
      tacticalRowForY(s.y) === rowId &&
      Math.abs(x - s.x) < ROW_X_MATCH,
  )
  if (occupant) snappedX = occupant.x

  return {
    rowId,
    column: nearestColumnIndex(snappedX),
    x: snappedX,
    y: rowY,
  }
}

export function movementArrowForDrag(
  fromRow: TacticalRowId,
  fromX: number,
  target: ArrowDragTarget,
): TacticArrow {
  return computeMovementArrow(fromRow, target.rowId, fromX, target.x)
}

function screenPctFromPitch(pitchX: number, pitchY: number): { x: number; y: number } {
  return { x: pitchX * 100, y: (1 - pitchY) * 100 }
}

/** Point on the icon ellipse boundary, facing toward (towardPitchX, towardPitchY). */
function circleEdgeScreenPct(
  centerPitchX: number,
  centerPitchY: number,
  towardPitchX: number,
  towardPitchY: number,
): { x: number; y: number } {
  const c = screenPctFromPitch(centerPitchX, centerPitchY)
  const t = screenPctFromPitch(towardPitchX, towardPitchY)
  const dx = t.x - c.x
  const dy = t.y - c.y
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return c
  const ndx = dx / ICON_RX_PCT
  const ndy = dy / ICON_RY_PCT
  const scale = 1 / Math.hypot(ndx, ndy)
  return { x: c.x + dx * scale, y: c.y + dy * scale }
}

export type ArrowLineSegment = {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * CM-style movement arrow: dotted line from source icon edge to target plane centre
 * or the near edge of an occupied target icon (arrowhead sits at line end only).
 */
export function computeMovementArrowLine(
  key: string,
  fromSlotId: string,
  fromX: number,
  fromY: number,
  targetRow: TacticalRowId | null | undefined,
  targetX: number | null | undefined,
  slots: PitchSlot[],
): ArrowLineSegment | null {
  if (!targetRow || targetX == null) return null
  const toY = tacticalRowY(targetRow)
  if (Math.abs(toY - fromY) < 0.015 && Math.abs(targetX - fromX) < 0.06) return null

  const occupant = findSlotOnRow(slots, targetRow, targetX, fromSlotId)
  const targetCenterX = occupant?.x ?? targetX
  const targetCenterY = toY

  const x2y2 = occupant
    ? circleEdgeScreenPct(targetCenterX, targetCenterY, fromX, fromY)
    : screenPctFromPitch(targetCenterX, targetCenterY)

  const x1y1 = circleEdgeScreenPct(fromX, fromY, targetCenterX, targetCenterY)

  return { key, x1: x1y1.x, y1: x1y1.y, x2: x2y2.x, y2: x2y2.y }
}

/** @deprecated Use {@link computeMovementArrowLine} */
export function arrowLineEndpoints(
  slotX: number,
  slotY: number,
  targetRow: TacticalRowId | null | undefined,
  targetX?: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const seg = computeMovementArrowLine('legacy', '', slotX, slotY, targetRow, targetX ?? slotX, [])
  if (!seg) return null
  return { x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 }
}
