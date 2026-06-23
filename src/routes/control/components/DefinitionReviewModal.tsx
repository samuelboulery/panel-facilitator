// Modale de revue d'une définition fraîchement générée par le LLM. La régie
// relit le terme + la définition (brouillon non encore visible dans la liste),
// puis : abandonne (suppression), valide (rend visible), ou valide et lance
// directement sur l'EP — cette modale fait office de confirmation, pas de
// LaunchModal 3 s ensuite.
import { AnimatePresence, motion } from 'framer-motion'
import type { Definition } from '../../../shared/types'

interface DefinitionReviewModalProps {
  definition: Definition | null
  onCancel: () => void
  onValidate: () => void
  onValidateAndLaunch: () => void
}

export function DefinitionReviewModal({
  definition,
  onCancel,
  onValidate,
  onValidateAndLaunch,
}: DefinitionReviewModalProps) {
  return (
    <AnimatePresence>
      {definition && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-control-ink/40 p-8"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ type: 'tween', duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-3xl rounded-3xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-6 font-mono text-sm tracking-wide text-control-dim">
              Nouvelle définition
            </p>
            <p className="text-3xl font-semibold text-control-ink">{definition.term}</p>
            <p className="mt-3 text-2xl leading-relaxed text-control-dim">
              {definition.definition}
            </p>

            <div className="mt-10 flex flex-row gap-3">
              <button
                type="button"
                onClick={onValidateAndLaunch}
                className="rounded-2xl bg-control-ink px-6 py-4 font-mono text-xl text-white active:scale-95"
              >
                Valider et lancer
              </button>
              <button
                type="button"
                onClick={onValidate}
                className="rounded-2xl bg-control-card px-6 py-4 font-mono text-xl text-control-ink active:scale-95"
              >
                Valider et enregistrer
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-3 font-mono text-lg text-control-dim active:scale-95"
              >
                Annuler la définition
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
