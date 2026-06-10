// Création de sondage / vote à la volée depuis l'IR (PRD 5.4.7 « créés en
// live »). Le sondage créé apparaît en draft dans sa section — lancement
// ensuite via la modale 3 s, comme un sondage préparé.
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ControlSession } from '../../../realtime/mutations'
import { createLivePoll } from '../../../realtime/mutations'
import type { PollKind } from '../../../shared/types'

interface AdHocPollModalProps {
  kind: PollKind | null
  session: ControlSession
  onClose: () => void
}

export function AdHocPollModal({ kind, session, onClose }: AdHocPollModalProps) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (kind) {
      setQuestion('')
      setOptions(['', ''])
      setError(null)
    }
  }, [kind])

  const submit = async () => {
    const trimmed = options.map((o) => o.trim()).filter(Boolean)
    if (!question.trim() || trimmed.length < 2) {
      setError('Question + au moins 2 options.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createLivePoll(
        session,
        kind ?? 'poll',
        question.trim(),
        trimmed.map((label, i) => ({ id: `opt-${i + 1}`, label })),
      )
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {kind && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-control-ink/40 p-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-6 font-mono text-sm tracking-wide text-control-dim">
              {kind === 'versus' ? 'Nouveau vote' : 'Nouveau sondage'}
            </p>

            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={kind === 'versus' ? 'Ex : Hugo vs Vincent' : 'Question du sondage'}
              className="mb-4 w-full rounded-xl border border-control-bg bg-control-panel px-4 py-3 text-lg outline-control-accent"
            />

            <div className="flex flex-col gap-2">
              {options.map((option, i) => (
                <input
                  key={i}
                  value={option}
                  onChange={(e) =>
                    setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  placeholder={`Option ${i + 1}`}
                  className="w-full rounded-xl border border-control-bg bg-control-panel px-4 py-2.5 outline-control-accent"
                />
              ))}
            </div>

            {kind !== 'versus' && options.length < 6 && (
              <button
                type="button"
                onClick={() => setOptions((prev) => [...prev, ''])}
                className="mt-3 font-mono text-sm text-control-dim active:scale-95"
              >
                + Ajouter une option
              </button>
            )}

            <p className="mt-3 h-5 text-sm text-red-600">{error ?? ''}</p>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 font-mono text-xl text-control-ink active:scale-95"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submit()}
                className="rounded-2xl bg-control-ink px-10 py-4 font-mono text-xl text-white active:scale-95 disabled:opacity-50"
              >
                Créer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
