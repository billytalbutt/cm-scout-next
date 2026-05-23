import soccerWizardMascot from './assets/soccer-wizard-mascot.png'
import cmMerlinTitleSticker from './assets/cm-merlin-title-sticker.png'
import cmMerlinTsigalkoSticker from './assets/cm-merlin-tsigalko-sticker.png'
import cmMerlinCmSticker from './assets/cm-merlin-cm-sticker.png'
import cmMerlinCmShinySticker from './assets/cm-merlin-cm-shiny-sticker.png'

const STICKERS = [
  { src: soccerWizardMascot, alt: '', className: 'cm-header-sticker-wizard' },
  { src: cmMerlinTitleSticker, alt: 'CM Merlin', className: 'cm-header-sticker-title' },
  { src: cmMerlinTsigalkoSticker, alt: '', className: 'cm-header-sticker-extra' },
  { src: cmMerlinCmSticker, alt: '', className: 'cm-header-sticker-extra' },
  { src: cmMerlinCmShinySticker, alt: '', className: 'cm-header-sticker-extra' },
] as const

/** Side-by-side 90s sticker header — wizard, title, and companion stickers. */
export function BrandHeaderStickers() {
  return (
    <div className="cm-header-sticker-row" aria-label="CM Merlin">
      {STICKERS.map((s, i) => (
        <img
          key={i}
          src={s.src}
          alt={s.alt}
          className={`cm-header-sticker ${s.className}`}
          draggable={false}
        />
      ))}
    </div>
  )
}
