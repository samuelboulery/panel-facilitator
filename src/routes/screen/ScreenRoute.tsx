// Architecture : Écran Public (EP) — surface de projection 1920×1080.
// Lecture seule : s'abonne à screen_state et rend le mode courant.
// Mode dégradé : connexion perdue ⇒ dernier état rendu conservé, AUCUN
// indicateur visible pour l'audience (contrainte PRD) ; reconnexion auto.
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useParams, useSearchParams } from 'react-router-dom'
import { authenticateScreen, subscribeScreenState } from '../../realtime/screenState'
import { fetchEventData, type EventData } from '../../realtime/eventData'
import { subscribeSpeakerList } from '../../realtime/controlData'
import { joinPresence } from '../../realtime/presence'
import { initialScreenState } from '../../shared/stateMachine'
import type { ScreenState } from '../../shared/types'
import { SponsorBanner } from './components/SponsorBanner'
import { AttenteMode } from './modes/AttenteMode'
import { IntroMode } from './modes/IntroMode'
import { DynamiqueMode } from './modes/DynamiqueMode'
import { OutroMode } from './modes/OutroMode'

export default function ScreenRoute() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('k')

  const [eventId, setEventId] = useState<string | null>(null)
  const [data, setData] = useState<EventData | null>(null)
  const [denied, setDenied] = useState(false)
  const [state, setState] = useState<ScreenState>(initialScreenState)

  // Association EP ↔ événement par token d'URL (PLAN.md §4) + chargement
  // unique des données statiques (speakers, sponsors, contenus, définitions).
  useEffect(() => {
    if (!slug || !token) {
      setDenied(true)
      return
    }
    let cancelled = false
    void authenticateScreen(slug, token).then(async (id) => {
      if (cancelled) return
      if (!id) {
        setDenied(true)
        return
      }
      setEventId(id)
      const eventData = await fetchEventData(slug)
      if (!cancelled) {
        if (eventData) setData(eventData)
        else setDenied(true)
      }
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
    // Speakers en temps réel : masquage live depuis l'IR (intro + bandeaux).
    const speakersSub = subscribeSpeakerList(eventId, (speakers) => {
      setData((prev) => (prev ? { ...prev, speakers } : prev))
    })
    return () => {
      subscription.unsubscribe()
      speakersSub.unsubscribe()
      presence.leave()
    }
  }, [eventId])

  if (denied) {
    // Écran neutre — jamais de message d'erreur projeté devant l'audience.
    return <div className="screen-surface" />
  }

  if (!data) {
    // Chargement : scène vide avec atmosphère (< 5 s, PRD 7.2).
    return <div className="screen-surface stage-atmosphere" />
  }

  return (
    <div className="screen-surface stage-atmosphere">
      <AnimatePresence mode="wait">
        <motion.div
          key={state.mode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {state.mode === 'attente' && <AttenteMode data={data} />}
          {state.mode === 'intro' && <IntroMode data={data} state={state} />}
          {state.mode === 'dynamique' && <DynamiqueMode data={data} state={state} />}
          {state.mode === 'outro' && <OutroMode data={data} />}
        </motion.div>
      </AnimatePresence>

      {/* Bandeau sponsors : présent sur les 4 modes, au-dessus des transitions */}
      <SponsorBanner sponsors={data.sponsors} scrollSpeed={data.event.sponsorScrollSpeed} />
    </div>
  )
}
