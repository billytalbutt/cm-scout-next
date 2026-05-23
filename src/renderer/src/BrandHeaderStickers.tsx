import soccerWizardMascot from './assets/soccer-wizard-mascot.png'
import cmMerlinTitleSticker from './assets/cm-merlin-title-sticker.png'

/** Side-by-side 90s sticker header — wizard + title art (no text). */
export function BrandHeaderStickers() {
  return (
    <div className="cm-header-sticker-row" aria-label="CM Merlin">
      <img
        src={soccerWizardMascot}
        alt=""
        className="cm-header-sticker cm-header-sticker-wizard"
        draggable={false}
      />
      <img
        src={cmMerlinTitleSticker}
        alt="CM Merlin"
        className="cm-header-sticker cm-header-sticker-title"
        draggable={false}
      />
    </div>
  )
}
