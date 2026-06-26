// Modale de repositionnement des cartes projetées sur l'EP (refonte régie).
// Remplace l'ancienne édition inline : affiche l'aperçu de la scène dynamique
// avec les cartes draggables (MovableCard → screen_state.cardPositions). Isolée
// dans une modale, l'édition ne gèle plus le swipe du carrousel.
import { AnimatePresence, motion } from 'framer-motion'
import type { EventData } from '../../../realtime/eventData'
import type { ControlState } from '../hooks/useControlState'
import { StagePreview } from '../views/StagePreview'
import { slideToState, type DeckSlide } from '../views/deck'

// Scène dynamique au repos (titre + overlays) — support des cartes positionnables.
const DYNAMIQUE_SLIDE: DeckSlide = {
  kind: 'dynamique',
  key: 'dynamique',
  label: '',
  hint: 'Dynamique',
}

interface CardPositionModalProps {
  open: boolean
  data: EventData
  control: ControlState
  onClose: () => void
}

export function CardPositionModal({ open, data, control, onClose }: CardPositionModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-control-ink/50 p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            transition={{ type: 'tween', duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-5xl rounded-3xl bg-control-panel p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="font-mono text-sm tracking-wide text-control-dim">
                Position des cards — glisser pour déplacer
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-control-ink px-5 py-2 font-mono text-sm text-white active:scale-95"
              >
                Terminé
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-black">
              <StagePreview
                data={data}
                state={slideToState(DYNAMIQUE_SLIDE)}
                cardPositions={control.screen.cardPositions}
                onCardDrag={control.setCardPosition}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
