// Aperçu fidèle de l'EP dans l'IR — rend les VRAIS composants de /screen
// (modes Attente/Intro/Dynamique/Outro + bandeau sponsors) sur une surface
// 1920×1080 réduite par `transform: scale`. Une seule source de design : toute
// modification de /screen se reflète ici automatiquement, aucune copie.
// Display-only : pointer-events neutralisés pour préserver swipe/tap du carrousel
// et empêcher les iframes (Slides/Figma) de capter l'interaction.
import { useEffect, useRef, useState } from 'react'
import type { EventData } from '../../../realtime/eventData'
import type { ScreenState } from '../../../shared/types'
import { AttenteMode } from '../../screen/modes/AttenteMode'
import { IntroMode } from '../../screen/modes/IntroMode'
import { DynamiqueMode } from '../../screen/modes/DynamiqueMode'
import { OutroMode } from '../../screen/modes/OutroMode'
import { SponsorBanner } from '../../screen/components/SponsorBanner'

const STAGE_W = 1920
const STAGE_H = 1080

export function StagePreview({ data, state }: { data: EventData; state: ScreenState }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  // Échelle dérivée de la largeur réelle du conteneur (carte courante ~74 %,
  // peek ~20 %) : le même rendu 1920×1080 s'adapte à toutes les tailles.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / STAGE_W)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="pointer-events-none relative aspect-video w-full overflow-hidden">
      <div
        className="screen-surface stage-atmosphere absolute top-0 left-0"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {state.mode === 'attente' && <AttenteMode data={data} />}
        {state.mode === 'intro' && <IntroMode data={data} state={state} />}
        {state.mode === 'dynamique' && <DynamiqueMode data={data} state={state} />}
        {state.mode === 'outro' && <OutroMode data={data} />}
        <SponsorBanner sponsors={data.sponsors} scrollSpeed={data.event.sponsorScrollSpeed} />
      </div>
    </div>
  )
}
