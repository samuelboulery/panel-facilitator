// Hôte des overlays du mode DYNAMIQUE — un seul overlay à la fois (Q5),
// la machine à états garantit la priorité en amont. Placé en flexbox par
// DynamiqueMode ; l'élément entre par le haut.
import { AnimatePresence, motion } from 'framer-motion'
import type { Overlay } from '../../../shared/types'
import { DefinitionOverlay } from './DefinitionOverlay'
import { QuestionOverlay } from './QuestionOverlay'
import { PollOverlay } from './PollOverlay'

interface OverlayHostProps {
  overlay: Overlay | null
  // 'top' : scène d'affiche, carte étroite à gauche du QR ;
  // 'bottom' : tiers inférieur pleine largeur au-dessus du contenu.
  position?: 'top' | 'bottom'
}

export function OverlayHost({ overlay, position = 'bottom' }: OverlayHostProps) {
  const top = position === 'top'
  return (
    <AnimatePresence>
      {overlay && (
        <motion.div
          key={`${overlay.type}:${overlay.id}`}
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -64, opacity: 0 }}
          transition={{ type: 'tween', duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={top ? 'z-10 w-[820px] max-w-[58%]' : 'z-10 w-full'}
        >
          {overlay.type === 'definition' && <DefinitionOverlay id={overlay.id} />}
          {overlay.type === 'question' && <QuestionOverlay id={overlay.id} />}
          {overlay.type === 'poll' && <PollOverlay id={overlay.id} />}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
