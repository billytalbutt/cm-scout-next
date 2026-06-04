import type { EditorFieldGamePreview } from '../../../shared/editorFieldGamePreview'

export function EditorFieldPreviewLines({ preview }: { preview: EditorFieldGamePreview }) {
  if (preview.kind === 'direct') {
    return (
      <p className="editor-field-hint leading-snug">
        On screen: <span className="font-mono font-semibold text-emerald-200/95">{preview.inGame}</span>
        <span className="text-zinc-500"> · stored value used directly</span>
      </p>
    )
  }
  return (
    <div className="space-y-0.5">
      <p className="editor-field-hint leading-snug">
        On attributes screen:{' '}
        <span className="font-mono font-semibold text-emerald-200/95">{preview.inGame}</span>
        <span className="text-zinc-500"> · 1–20 style</span>
        {preview.kind === 'ca18' && (
          <span className="text-zinc-500"> (from current CA + raw byte)</span>
        )}
        {preview.kind === 'clamped' && (
          <span className="text-zinc-500"> (scaled from raw for display)</span>
        )}
      </p>
      {preview.inGameUncapped !== preview.inGame && (
        <p className="text-[10px] leading-snug text-amber-200/90">
          Uncapped display: <span className="font-mono">{preview.inGameUncapped}</span>
        </p>
      )}
    </div>
  )
}
