type Props = {
  title: string
  detail: string
}

/** Ultra-rare “engine god” marker — hover for benchmark explanation */
export function EliteEngineStar({ title, detail }: Props) {
  return (
    <span
      className="cursor-help select-none text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.35)]"
      title={`${title}\n\n${detail}`}
      aria-label={title}
      role="img"
    >
      ★
    </span>
  )
}
