// Architecture : Écran Public (EP) — surface de projection 1920×1080.
// Lecture seule : s'abonne à screen_state et rend le mode courant.
// Mode dégradé : connexion perdue ⇒ dernier état rendu conservé, AUCUN
// indicateur visible pour l'audience (contrainte PRD) ; reconnexion auto.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useParams, useSearchParams } from 'react-router-dom'
import { authenticateScreen, subscribeScreenState } from '../../realtime/screenState'
import { fetchEventData, type EventData } from '../../realtime/eventData'
import { subscribeSpeakerList } from '../../realtime/controlData'
import { joinPresence } from '../../realtime/presence'
import { initialScreenState } from '../../shared/stateMachine'
import type { ScreenState } from '../../shared/types'
import { SponsorBanner } from './components/SponsorBanner'
import { CardPositionProvider } from './components/MovableCard'
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
  // Référence scène pour positionner les cartes (mesure unités 1920×1080).
  const stageRef = useRef<HTMLDivElement>(null)

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

  // Branding : on surcharge les variables CSS du thème (fond/texte/accent) au
  // niveau de la surface — toute la sous-arborescence en hérite via var(). L'image
  // se superpose à la couleur de fond, sous l'atmosphère et le contenu.
  const b = data.branding
  const brandStyle = b
    ? ({
        '--color-ink': b.bgColor,
        '--color-paper': b.textColor,
        // Tout le texte de l'EP suit le branding, y compris les petits libellés
        // (micro-labels, légendes des cartes) : on aligne la variante « dim » sur
        // la couleur de texte pleine. Seul l'accent garde sa couleur propre.
        '--color-paper-dim': b.textColor,
        '--color-accent': b.accentColor,
        backgroundColor: b.bgColor,
        ...(b.bgImageUrl && {
          backgroundImage: `url(${b.bgImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }),
      } as CSSProperties)
    : undefined

  return (
    <div ref={stageRef} className="screen-surface stage-atmosphere flex flex-col" style={brandStyle}>
      <CardPositionProvider value={{ positions: state.cardPositions, stageRef }}>
        {/* Crossfade par superposition (calques absolus) : le mode entrant monte
            immédiatement au changement de clé, l'ancien s'efface par-dessus. PAS de
            mode="wait" — il bloquait le montage du mode suivant tant que la sortie
            du précédent n'était pas terminée ; une sortie de mode DYNAMIQUE (iframe
            + animations imbriquées + re-render realtime) pouvait ne jamais finir,
            laissant l'EP vide jusqu'au rechargement. */}
        <div className="relative min-h-0 flex-1">
          <AnimatePresence>
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
        </div>
      </CardPositionProvider>

      {/* Bandeau sponsors : masqué en mode dynamique (demande régie) et en
          outro (sponsors affichés dans une card dédiée). */}
      {state.mode !== 'dynamique' && state.mode !== 'outro' && (
        <SponsorBanner sponsors={data.sponsors} scrollSpeed={data.event.sponsorScrollSpeed} />
      )}
    </div>
  )
}
