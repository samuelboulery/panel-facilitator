// Bouton de réinitialisation + dialogue de confirmation pour le backoffice.
// Remet l'état « déjà lancé » à zéro (cf. RPC admin_reset_round). Cases à cocher
// conditionnelles : suppression des questions du public / des sondages ad-hoc.
import { useState } from 'react'
import { resetRound, type ResetScope } from '../../../realtime/adminData'

interface ResetControlProps {
  eventId: string
  scope: ResetScope
  label: string
  /** Style du bouton : 'global' (header, plein rouge) ou 'section' (discret). */
  variant?: 'global' | 'section'
  /** Appelé après un reset réussi — pour rafraîchir la liste concernée. */
  onDone: () => void
}

const SCOPE_TITLE: Record<ResetScope, string> = {
  all: 'Tout réinitialiser',
  definitions: 'Réinitialiser les définitions',
  questions: 'Réinitialiser les questions',
  polls: 'Réinitialiser les sondages',
  votes: 'Réinitialiser les votes',
}

const SCOPE_TEXT: Record<ResetScope, string> = {
  all: 'Remet à zéro tout l’état lancé (définitions, questions, sondages, votes, écran). Le contenu configuré est conservé.',
  definitions: 'Toutes les définitions redeviennent disponibles dans la régie.',
  questions: 'Les questions préparées repassent en attente.',
  polls: 'Les sondages repassent en brouillon, les votes sont effacés.',
  votes: 'Les votes repassent en brouillon, les résultats sont effacés.',
}

export function ResetControl({ eventId, scope, label, variant = 'section', onDone }: ResetControlProps) {
  const [open, setOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteAudience, setDeleteAudience] = useState(false)
  const [deleteAdhoc, setDeleteAdhoc] = useState(false)

  const showAudience = scope === 'all' || scope === 'questions'
  const showAdhoc = scope === 'all' || scope === 'polls' || scope === 'votes'

  const close = () => {
    setOpen(false)
    setError(null)
    setDeleteAudience(false)
    setDeleteAdhoc(false)
  }

  const confirm = async () => {
    setResetting(true)
    setError(null)
    try {
      await resetRound(eventId, scope, { deleteAudience, deleteAdhoc })
      close()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setResetting(false)
    }
  }

  const buttonClass =
    variant === 'global'
      ? 'rounded-lg bg-red-500 px-3 py-2 font-mono text-xs text-white active:scale-95'
      : 'rounded-lg px-3 py-1.5 font-mono text-xs text-red-500 active:scale-95'

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-control-ink">{SCOPE_TITLE[scope]}</h2>
            <p className="mt-2 text-sm text-control-dim">{SCOPE_TEXT[scope]}</p>

            {(showAudience || showAdhoc) && (
              <div className="mt-4 space-y-2.5">
                {showAudience && (
                  <label className="flex items-center gap-2.5 text-sm text-control-ink">
                    <input
                      type="checkbox"
                      checked={deleteAudience}
                      onChange={(e) => setDeleteAudience(e.target.checked)}
                    />
                    Supprimer aussi les questions du public
                  </label>
                )}
                {showAdhoc && (
                  <label className="flex items-center gap-2.5 text-sm text-control-ink">
                    <input
                      type="checkbox"
                      checked={deleteAdhoc}
                      onChange={(e) => setDeleteAdhoc(e.target.checked)}
                    />
                    Supprimer les sondages/votes créés en direct
                  </label>
                )}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={resetting}
                className="rounded-lg px-4 py-2 font-mono text-sm text-control-dim active:scale-95 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={resetting}
                className="rounded-xl bg-red-500 px-5 py-2 font-mono text-sm text-white active:scale-95 disabled:opacity-50"
              >
                {resetting ? 'Réinitialisation…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
