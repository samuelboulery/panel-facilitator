// Hôte des overlays du mode DYNAMIQUE — un seul overlay à la fois (Q5),
// la machine à états garantit la priorité en amont. Apparition en
// « lower-third » au-dessus du contenu, sous les bandeaux.
import { AnimatePresence, motion } from 'framer-motion'
import type { Overlay } from '../../../shared/types'
import { DefinitionOverlay } from './DefinitionOverlay'
import { QuestionOverlay } from './QuestionOverlay'
import { PollOverlay } from './PollOverlay'

export function OverlayHost({ overlay }: { overlay: Overlay | null }) {
  return (
    <AnimatePresence>
      {overlay && (
        <motion.div
          key={`${overlay.type}:${overlay.id}`}
          initial={{ y: 64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 64, opacity: 0 }}
          transition={{ type: 'tween', duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-16 bottom-28 z-10"
        >
          {overlay.type === 'definition' && <DefinitionOverlay id={overlay.id} />}
          {overlay.type === 'question' && <QuestionOverlay id={overlay.id} />}
          {overlay.type === 'poll' && <PollOverlay id={overlay.id} />}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
