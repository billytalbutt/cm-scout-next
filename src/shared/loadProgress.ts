/** Progress events streamed from main → renderer during `open-database`. */
export type DatabaseLoadProgress = {
  phase: string
  message: string
  /** 0–1 */
  progress: number
}
