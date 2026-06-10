// Modale de lancement avec compte à rebours 3 s annulable (Frames 149-151).
// Filet de sécurité régie : l'envoi part automatiquement à 0, « Envoyer »
// déclenche immédiatement, « Annuler » interrompt. Barre de progression sous
// le bouton comme sur les maquettes.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const COUNTDOWN_S = 3

export interface LaunchPayload {
  /** Micro-label de la modale, ex. « Lancement de la question ». */
  label: string
  /** Contenu de prévisualisation. */
  title: string
  body?: string
  onConfirm: () => void
}

interface LaunchModalProps {
  payload: LaunchPayload | null
  onDismiss: () => void
}

export function LaunchModal({ payload, onDismiss }: LaunchModalProps) {
  const [remaining, setRemaining] = useState(COUNTDOWN_S)
  const confirmedRef = useRef(false)
  // onDismiss vit dans une ref : sa présence dans les deps de l'effet
  // redémarrerait le compte à rebours à chaque re-render du parent
  // (les votes temps réel re-rendent ControlShell en continu).
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!payload) return
    confirmedRef.current = false
    setRemaining(COUNTDOWN_S)
    const startedAt = Date.now()
    const id = setInterval(() => {
      const left = COUNTDOWN_S - Math.floor((Date.now() - startedAt) / 1000)
      setRemaining(Math.max(0, left))
      if (left <= 0 && !confirmedRef.current) {
        confirmedRef.current = true
        clearInterval(id)
        payload.onConfirm()
        onDismissRef.current()
      }
    }, 100)
    return () => clearInterval(id)
  }, [payload])

  const confirmNow = () => {
    if (!payload || confirmedRef.current) return
    confirmedRef.current = true
    payload.onConfirm()
    onDismiss()
  }

  const cancel = () => {
    confirmedRef.current = true // bloque l'auto-envoi
    onDismiss()
  }

  return (
    <AnimatePresence>
      {payload && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-control-ink/40 p-8"
          onClick={cancel}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ type: 'tween', duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-6 font-mono text-sm tracking-wide text-control-dim">
              {payload.label}
            </p>
            <p className="text-2xl font-semibold text-control-ink">{payload.title}</p>
            {payload.body && (
              <p className="mt-3 text-lg leading-relaxed text-control-dim">{payload.body}</p>
            )}

            <div className="mt-10 flex items-center justify-between">
              <button
                type="button"
                onClick={cancel}
                className="px-4 py-3 font-mono text-xl text-control-ink active:scale-95"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmNow}
                className="relative overflow-hidden rounded-2xl bg-control-ink px-10 py-4 font-mono text-xl text-white active:scale-95"
              >
                Envoyer {remaining > 0 ? `${remaining}s` : ''}
                <span
                  className="absolute bottom-0 left-0 h-1 bg-control-accent transition-[width] duration-100 ease-linear"
                  style={{ width: `${((COUNTDOWN_S - remaining) / COUNTDOWN_S) * 100}%` }}
                />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
