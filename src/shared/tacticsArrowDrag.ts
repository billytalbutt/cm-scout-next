import type { TacticArrow } from './tacticsCommunityPresets'
import {
  computeMovementArrow,
  nearestColumnIndex,
  PITCH_COLUMNS,
  pitchColumnX,
  tacticalRowForY,
  tacticalRowY,
  type PitchColumnIndex,
  type TacticalRowId,
} from './tacticsPitchSnap'

export type ArrowDragTarget = {
  rowId: TacticalRowId
  column: PitchColumnIndex
  x: number
  y: number
}

/** Snap pointer position to nearest tactical row + column (CM movement arrows stay in-column). */
export function snapArrowDragTarget(x: number, y: number): ArrowDragTarget {
  const rowId = tacticalRowForY(y)
  const column = nearestColumnIndex(x)
  return {
    rowId,
    column,
    x: pitchColumnX(column),
    y: tacticalRowY(rowId),
  }
}

export function movementArrowForDrag(
  fromRow: TacticalRowId,
  fromX: number,
  target: ArrowDragTarget,
): TacticArrow {
  return computeMovementArrow(fromRow, target.rowId, fromX, target.x)
}

/** SVG line from slot to arrow target row (same column). */
export function arrowLineEndpoints(
  slotX: number,
  slotY: number,
  targetRow: TacticalRowId | null | undefined,
  targetX?: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  if (!targetRow) return null
  const ty = tacticalRowY(targetRow)
  if (Math.abs(ty - slotY) < 0.02) return null
  const x2 = targetX ?? slotX
  return {
    x1: slotX * 100,
    y1: (1 - slotY) * 100,
    x2: x2 * 100,
    y2: (1 - ty) * 100,
  }
}
