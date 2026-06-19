// Aperçu fidèle de l'EP dans l'IR — rend les VRAIS composants de /screen
// (modes Attente/Intro/Dynamique/Outro + bandeau sponsors) sur une surface
// 1920×1080 réduite par `transform: scale`. Une seule source de design : toute
// modification de /screen se reflète ici automatiquement, aucune copie.
// Display-only : pointer-events neutralisés pour préserver swipe/tap du carrousel
// et empêcher les iframes (Slides/Figma) de capter l'interaction.
import { useEffect, useRef, useState } from 'react'
import type { EventData } from '../../../realtime/eventData'
import type { ScreenState, CardPosition } from '../../../shared/types'
import { AttenteMode } from '../../screen/modes/AttenteMode'
import { IntroMode } from '../../screen/modes/IntroMode'
import { DynamiqueMode } from '../../screen/modes/DynamiqueMode'
import { OutroMode } from '../../screen/modes/OutroMode'
import { SponsorBanner } from '../../screen/components/SponsorBanner'
import { CardPositionProvider } from '../../screen/components/MovableCard'

const STAGE_W = 1920
const STAGE_H = 1080

interface StagePreviewProps {
  data: EventData
  state: ScreenState
  /** Positions persistées des cartes (état régie réel, partagé entre les slides). */
  cardPositions?: Record<string, CardPosition>
  /** Présent → cartes draggables (aperçu courant uniquement). */
  onCardDrag?: (key: string, pos: CardPosition) => void
}

export function StagePreview({ data, state, cardPositions = {}, onCardDrag }: StagePreviewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
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
    <div ref={ref} className="control-preview pointer-events-none relative aspect-video w-full overflow-hidden">
      <div
        ref={stageRef}
        className="screen-surface stage-atmosphere absolute top-0 left-0"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <CardPositionProvider value={{ positions: cardPositions, onDrag: onCardDrag, stageRef, stageScale: scale }}>
          {state.mode === 'attente' && <AttenteMode data={data} />}
          {state.mode === 'intro' && <IntroMode data={data} state={state} />}
          {state.mode === 'dynamique' && <DynamiqueMode data={data} state={state} />}
          {state.mode === 'outro' && <OutroMode data={data} />}
          <SponsorBanner sponsors={data.sponsors} scrollSpeed={data.event.sponsorScrollSpeed} />
        </CardPositionProvider>
      </div>
    </div>
  )
}
