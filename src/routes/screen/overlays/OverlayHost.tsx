// Hôte des overlays du mode DYNAMIQUE — un seul overlay à la fois (Q5),
// la machine à états garantit la priorité en amont. La largeur est imposée par
// le conteneur parent (l'overlay remplit en `w-full`) ; seule la direction
// d'entrée varie : `enterFrom` = bord d'où l'overlay glisse, aligné sur le bord
// d'ancre du groupe (ancré bas → entre par le bas, sinon par le haut).
import { AnimatePresence, motion } from 'framer-motion'
import type { Overlay } from '../../../shared/types'
import { DefinitionOverlay } from './DefinitionOverlay'
import { QuestionOverlay } from './QuestionOverlay'
import { PollOverlay } from './PollOverlay'

interface OverlayHostProps {
  overlay: Overlay | null
  /** Bord d'où l'overlay glisse à l'apparition (suit le bord d'ancre du groupe). */
  enterFrom?: 'top' | 'bottom'
}

export function OverlayHost({ overlay, enterFrom = 'top' }: OverlayHostProps) {
  const dy = enterFrom === 'bottom' ? 64 : -64
  return (
    <AnimatePresence>
      {overlay && (
        <motion.div
          key={`${overlay.type}:${overlay.id}`}
          initial={{ y: dy, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: dy, opacity: 0 }}
          transition={{ type: 'tween', duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="z-10 w-full"
        >
          {overlay.type === 'definition' && <DefinitionOverlay id={overlay.id} />}
          {overlay.type === 'question' && <QuestionOverlay id={overlay.id} />}
          {overlay.type === 'poll' && <PollOverlay id={overlay.id} />}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
