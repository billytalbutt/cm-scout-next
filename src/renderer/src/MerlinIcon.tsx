/** Wizard hat mark for CM Merlin Scout branding. */
export function MerlinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="16" cy="25" rx="11" ry="3.2" fill="currentColor" opacity="0.35" />
      <path
        d="M7.5 23.5 16 5.5 24.5 23.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <path d="M10 20.5h12" stroke="#fcd34d" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M16 10.5 17.1 13.2h2.8l-2.3 1.7.9 2.8-2.5-1.8-2.5 1.8.9-2.8-2.3-1.7h2.8Z"
        fill="#fde68a"
      />
    </svg>
  )
}
