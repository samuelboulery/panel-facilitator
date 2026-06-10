// Architecture : Écran Public (EP) — surface de projection 1920×1080.
// Lecture seule : s'abonne à screen_state et rend le mode courant.
// Mode dégradé : connexion perdue ⇒ on garde le dernier état rendu, AUCUN
// indicateur visible pour l'audience (contrainte PRD) ; reconnexion auto.
// Squelette Sprint 0 — les rendus complets des modes arrivent au Sprint 1.
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  authenticateScreen,
  subscribeScreenState,
} from '../../realtime/screenState'
import { joinPresence } from '../../realtime/presence'
import { initialScreenState } from '../../shared/stateMachine'
import type { ScreenState } from '../../shared/types'

export default function ScreenRoute() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('k')

  const [eventId, setEventId] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [state, setState] = useState<ScreenState>(initialScreenState)

  // Association EP ↔ événement par token d'URL (PLAN.md §4).
  useEffect(() => {
    if (!slug || !token) {
      setDenied(true)
      return
    }
    let cancelled = false
    void authenticateScreen(slug, token).then((id) => {
      if (cancelled) return
      if (id) setEventId(id)
      else setDenied(true)
    })
    return () => {
      cancelled = true
    }
  }, [slug, token])

  // Abonnement à l'état + annonce de présence (l'IR surveille).
  useEffect(() => {
    if (!eventId) return
    const presence = joinPresence(eventId, 'screen')
    const subscription = subscribeScreenState({
      eventId,
      onState: setState,
      // Volontairement aucun rendu lié à la connexion : mode dégradé invisible.
    })
    return () => {
      subscription.unsubscribe()
      presence.leave()
    }
  }, [eventId])

  if (denied) {
    // Écran neutre — jamais de message d'erreur projeté devant l'audience.
    return <div className="screen-surface bg-slate-900" />
  }

  return (
    <div className="screen-surface bg-slate-900 text-white">
      {/* Sprint 1 : AttenteMode / IntroMode / DynamiqueMode / OutroMode */}
      <div className="flex h-full items-center justify-center">
        <p className="font-mono text-2xl uppercase tracking-widest text-slate-600">
          {state.mode}
        </p>
      </div>
    </div>
  )
}
