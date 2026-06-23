// Architecture : Interface de Régie / Animateur (IR) — tablette-first.
// Protégée par PIN (PRD Q9), session sessionStorage (compromis V1 documenté).
// Trois vues slideables : Slides | Gestion (défaut) | Notes, barre d'état
// permanente en bas (mode, overlay, connexion EP, heure, durée).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { z } from 'zod'
import { controlAuth, type ControlSession } from '../../realtime/mutations'
import * as mutations from '../../realtime/mutations'
import { fetchEventData, subscribePoll, type EventData } from '../../realtime/eventData'
import {
  subscribeDefinitionList,
  subscribePollList,
  subscribeQuestionList,
  subscribeSpeakerList,
} from '../../realtime/controlData'
import type { Definition, Poll, PollResults, Question, Speaker } from '../../shared/types'
import { buildDeck, currentDeckIndex, goToDeckSlide } from './views/deck'
import { PinGate } from './PinGate'
import { useControlState } from './hooks/useControlState'
import { StatusBar } from './components/StatusBar'
import { LaunchModal, type LaunchPayload } from './components/LaunchModal'
import { DefinitionReviewModal } from './components/DefinitionReviewModal'
import { GestionView } from './views/GestionView'
import { SlidesView } from './views/SlidesView'
import { NotesView } from './views/NotesView'

const SESSION_KEY = 'panel-facilitator:control-session'

// Validation à la frontière sessionStorage — donnée non fiable (règle projet).
const storedSessionSchema = z.object({
  slug: z.string().min(1),
  pin: z.string().regex(/^\d{4,8}$/),
  eventId: z.string().uuid(),
})

// Durée d'affichage auto d'une définition avant fermeture (laisse le temps de lire).
// ponytail: constante fixe, à ajuster si besoin (pas de calcul selon longueur du texte).
const DEFINITION_AUTO_DISMISS_MS = 12_000

const VIEW_COUNT = 3 // Slides | Gestion | Notes
// Peek : les vues adjacentes dépassent et servent de poignées de swipe (maquettes 13/14/15).
const PEEK_PCT = 4

function ControlShell({ session }: { session: ControlSession }) {
  const control = useControlState(session)
  const [data, setData] = useState<EventData | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [definitions, setDefinitions] = useState<Definition[]>([])
  const [viewIndex, setViewIndex] = useState(1) // Gestion par défaut
  const [launch, setLaunch] = useState<LaunchPayload | null>(null)
  // Brouillon LLM en attente de revue (Annuler / Valider / Valider et lancer).
  const [reviewDef, setReviewDef] = useState<Definition | null>(null)
  // Édition des positions de cartes (vue Slides) : gèle tout swipe horizontal
  // (cartes ET pager d'écrans) pour ne déplacer que les cartes.
  const [editLayout, setEditLayout] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchEventData(session.slug).then((d) => {
      if (!cancelled && d) setData(d)
    })
    return () => {
      cancelled = true
    }
  }, [session.slug])

  useEffect(() => {
    const qSub = subscribeQuestionList(session.eventId, setQuestions)
    const pSub = subscribePollList(session.eventId, setPolls)
    const dSub = subscribeDefinitionList(session.eventId, setDefinitions)
    // Speakers en temps réel : le masquage live recalcule la séquence intro.
    const sSub = subscribeSpeakerList(session.eventId, (speakers: Speaker[]) => {
      setData((prev) => (prev ? { ...prev, speakers } : prev))
    })
    return () => {
      qSub.unsubscribe()
      pSub.unsubscribe()
      dSub.unsubscribe()
      sSub.unsubscribe()
    }
  }, [session.eventId])

  // Sondage actif en overlay : suivi des résultats pour la barre d'état.
  const overlayPollId =
    control.screen.overlay?.type === 'poll' ? control.screen.overlay.id : null
  const [activePoll, setActivePoll] = useState<Poll | null>(null)
  const [activePollResults, setActivePollResults] = useState<PollResults>({})

  useEffect(() => {
    if (!overlayPollId) {
      setActivePoll(null)
      setActivePollResults({})
      return
    }
    const sub = subscribePoll(overlayPollId, setActivePoll, setActivePollResults)
    return () => sub.unsubscribe()
  }, [overlayPollId])

  const activeQuestion = useMemo(
    () =>
      control.screen.overlay?.type === 'question'
        ? (questions.find((q) => q.id === control.screen.overlay?.id) ?? null)
        : null,
    [control.screen.overlay, questions],
  )

  // Deck de navigation (Attente → intro → Dynamique → Outro) : alimente les
  // flèches Slides de la barre d'état, à l'identique du carrousel de la vue Slides.
  const deck = useMemo(() => (data ? buildDeck(data) : []), [data])

  const stopPoll = useCallback(() => {
    if (!overlayPollId) return
    mutations.setPollStatus(session, overlayPollId, 'closed').catch(() => undefined)
  }, [overlayPollId, session])

  const closeQuestion = useCallback(() => {
    if (!activeQuestion) return
    control.closeOverlay()
    mutations.setQuestionStatus(session, activeQuestion.id, 'done').catch(() => undefined)
  }, [activeQuestion, control, session])

  const overlay = control.screen.overlay
  const activeDefinition =
    overlay?.type === 'definition'
      ? (definitions.find((d) => d.id === overlay.id) ?? null)
      : null

  // Contenu projeté (mode dynamique uniquement — sinon le contenu n'apparaît pas
  // sur l'EP) : rappel + bouton d'arrêt dans la barre d'état.
  const activeContent =
    control.screen.mode === 'dynamique' && control.screen.mainContentId
      ? (data?.contents.find((c) => c.id === control.screen.mainContentId) ?? null)
      : null

  // Fermeture auto de la définition après lecture. Le timer redémarre à chaque
  // nouvelle définition (clé = overlay.id) ; cleanup l'annule si la régie ferme
  // avant ou lance un autre overlay.
  const definitionOverlayId = overlay?.type === 'definition' ? overlay.id : null
  const { closeOverlay } = control
  useEffect(() => {
    if (!definitionOverlayId) return
    const id = setTimeout(() => closeOverlay(), DEFINITION_AUTO_DISMISS_MS)
    return () => clearTimeout(id)
  }, [definitionOverlayId, closeOverlay])

  if (!data) {
    return <div className="flex h-dvh items-center justify-center bg-control-bg" />
  }

  // Pager avec peek : chaque vue fait (100 - 2*PEEK) % de largeur ; les vues
  // adjacentes dépassent des deux côtés et servent de poignées (tap ou swipe).
  const viewWidthPct = 100 - 2 * PEEK_PCT
  const offsetPct = PEEK_PCT - viewIndex * viewWidthPct

  // Flèches Slides : navigation dans le deck, désactivées seulement aux extrémités
  // (pas de slide précédente sur Attente, pas de suivante sur Outro).
  const deckIndex = currentDeckIndex(deck, control.screen)
  const prevSlide = deck[deckIndex - 1]
  const nextSlide = deck[deckIndex + 1]
  const slidePrev = prevSlide ? () => goToDeckSlide(prevSlide, control) : null
  const slideNext = nextSlide ? () => goToDeckSlide(nextSlide, control) : null

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-control-bg font-display text-control-ink">
      {/* Pager horizontal — navigation au swipe uniquement (pas d'onglets) */}
      <motion.div
        className="flex min-h-0 flex-1 pt-3"
        animate={{ x: `${offsetPct}%` }}
        transition={{ type: 'tween', duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        drag={editLayout ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80 && viewIndex < VIEW_COUNT - 1) setViewIndex(viewIndex + 1)
          else if (info.offset.x > 80 && viewIndex > 0) setViewIndex(viewIndex - 1)
        }}
      >
        {[
          <SlidesView
            key="slides"
            data={data}
            control={control}
            session={session}
            active={viewIndex === 0}
            editLayout={editLayout}
            onToggleEditLayout={() => setEditLayout((v) => !v)}
          />,
          <GestionView
            key="gestion"
            control={control}
            session={session}
            questions={questions}
            polls={polls}
            definitions={definitions}
            contents={data.contents}
            onLaunch={setLaunch}
            onGenerated={setReviewDef}
          />,
          <NotesView key="notes" session={session} />,
        ].map((view, i) => (
          <div
            key={i}
            style={{ width: `${viewWidthPct}%` }}
            className={`flex shrink-0 flex-col overflow-hidden px-3 pb-3 transition-opacity ${
              i === viewIndex ? '' : 'opacity-60'
            }`}
            onClick={() => {
              // Tap sur un panneau en peek = y naviguer.
              if (i !== viewIndex) setViewIndex(i)
            }}
          >
            {/* flex-1 + min-h-0 : chaîne de hauteur intacte → les vues qui
                veulent remplir (Slides, Notes) le font ; Gestion scrolle. */}
            <div
              className={`flex min-h-0 flex-1 flex-col ${
                i === viewIndex ? '' : 'pointer-events-none'
              }`}
            >
              {view}
            </div>
          </div>
        ))}
      </motion.div>

      <StatusBar
        screen={control.screen}
        activePoll={activePoll}
        activePollResults={activePollResults}
        activeQuestion={activeQuestion}
        activeDefinition={activeDefinition}
        activeContent={activeContent}
        onStopPoll={stopPoll}
        onRemovePoll={control.closeOverlay}
        onCloseQuestion={closeQuestion}
        onStopContent={() => control.setMainContent(null)}
        qrVisible={control.screen.qrVisible}
        onToggleQr={control.toggleQr}
        onSlidePrev={slidePrev}
        onSlideNext={slideNext}
        onToggleTimer={() => {
          mutations
            .setTimerStartedAt(
              session,
              control.screen.timerStartedAt ? null : new Date().toISOString(),
            )
            .catch(() => undefined)
        }}
      />

      <LaunchModal payload={launch} onDismiss={() => setLaunch(null)} />

      <DefinitionReviewModal
        definition={reviewDef}
        onCancel={() => {
          if (reviewDef) mutations.deleteDefinition(session, reviewDef.id).catch(() => undefined)
          setReviewDef(null)
        }}
        onValidate={() => {
          if (reviewDef) mutations.validateDefinition(session, reviewDef.id).catch(() => undefined)
          setReviewDef(null)
        }}
        onValidateAndLaunch={() => {
          if (reviewDef) {
            const id = reviewDef.id
            // Validation PUIS projection — la modale de revue tient lieu de
            // confirmation, pas de LaunchModal 3 s ensuite. Usage unique : la
            // définition disparaît de la liste dès le lancement.
            mutations
              .validateDefinition(session, id)
              .then(() => {
                control.showOverlay({ type: 'definition', id })
                return mutations.setDefinitionUsed(session, id, true)
              })
              .catch(() => undefined)
          }
          setReviewDef(null)
        }}
      />

      {/* Toast d'erreur (refus machine à états ou échec RPC) */}
      <AnimatePresence>
        {control.lastError && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            onClick={control.clearError}
            className="absolute top-4 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-control-ink px-5 py-3 text-sm text-white shadow-xl"
          >
            {control.lastError}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ControlRoute() {
  const { slug } = useParams<{ slug: string }>()
  const [session, setSession] = useState<ControlSession | null>(null)
  const [restoring, setRestoring] = useState(true)

  // Restauration de session après refresh (le PIN reste vérifié côté serveur
  // à chaque mutation — un PIN périmé échouera proprement).
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw && slug) {
      try {
        const saved = storedSessionSchema.parse(JSON.parse(raw))
        if (saved.slug === slug) {
          setSession(saved)
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY)
      }
    }
    setRestoring(false)
  }, [slug])

  const handlePin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!slug) return false
      const result = await controlAuth(slug, pin)
      if (!result) return false
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(result))
      setSession(result)
      return true
    },
    [slug],
  )

  if (restoring) return null
  if (!session) return <PinGate onSubmit={handlePin} />
  return <ControlShell session={session} />
}
