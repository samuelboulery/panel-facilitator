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
  subscribePollList,
  subscribeQuestionList,
  subscribeSpeakerList,
} from '../../realtime/controlData'
import type { Poll, PollResults, Question, Speaker } from '../../shared/types'
import { PinGate } from './PinGate'
import { useControlState } from './hooks/useControlState'
import { StatusBar } from './components/StatusBar'
import { LaunchModal, type LaunchPayload } from './components/LaunchModal'
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

const VIEWS = ['Slides', 'Gestion', 'Notes'] as const

function ControlShell({ session }: { session: ControlSession }) {
  const control = useControlState(session)
  const [data, setData] = useState<EventData | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [viewIndex, setViewIndex] = useState(1) // Gestion par défaut
  const [launch, setLaunch] = useState<LaunchPayload | null>(null)

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
    // Speakers en temps réel : le masquage live recalcule la séquence intro.
    const sSub = subscribeSpeakerList(session.eventId, (speakers: Speaker[]) => {
      setData((prev) => (prev ? { ...prev, speakers } : prev))
    })
    return () => {
      qSub.unsubscribe()
      pSub.unsubscribe()
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

  const stopPoll = useCallback(() => {
    if (!overlayPollId) return
    mutations.setPollStatus(session, overlayPollId, 'closed').catch(() => undefined)
  }, [overlayPollId, session])

  const closeQuestion = useCallback(() => {
    if (!activeQuestion) return
    control.closeOverlay()
    mutations.setQuestionStatus(session, activeQuestion.id, 'done').catch(() => undefined)
  }, [activeQuestion, control, session])

  if (!data) {
    return <div className="flex h-dvh items-center justify-center bg-control-bg" />
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-control-bg font-display text-control-ink">
      {/* Onglets de navigation entre vues */}
      <nav className="flex shrink-0 justify-center gap-2 px-4 pt-3 pb-1">
        {VIEWS.map((view, i) => (
          <button
            key={view}
            type="button"
            onClick={() => setViewIndex(i)}
            className={`rounded-full px-5 py-1.5 font-mono text-sm transition-colors ${
              i === viewIndex ? 'bg-control-ink text-white' : 'text-control-dim'
            }`}
          >
            {view}
          </button>
        ))}
      </nav>

      {/* Pager horizontal swipeable */}
      <motion.div
        className="flex min-h-0 flex-1"
        animate={{ x: `-${viewIndex * 100}%` }}
        transition={{ type: 'tween', duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80 && viewIndex < VIEWS.length - 1) setViewIndex(viewIndex + 1)
          else if (info.offset.x > 80 && viewIndex > 0) setViewIndex(viewIndex - 1)
        }}
      >
        <div className="w-full shrink-0 overflow-y-auto px-4 py-3">
          <SlidesView data={data} control={control} session={session} />
        </div>
        <div className="w-full shrink-0 overflow-y-auto px-4 py-3">
          <GestionView
            data={data}
            control={control}
            session={session}
            questions={questions}
            polls={polls}
            onLaunch={setLaunch}
          />
        </div>
        <div className="w-full shrink-0 overflow-y-auto px-4 py-3">
          <NotesView session={session} />
        </div>
      </motion.div>

      <StatusBar
        screen={control.screen}
        eventStartAt={data.event.startAt}
        screenOnline={control.screenOnline}
        latencyMs={control.latencyMs}
        activePoll={activePoll}
        activePollResults={activePollResults}
        activeQuestion={activeQuestion}
        onStopPoll={stopPoll}
        onCloseQuestion={closeQuestion}
      />

      <LaunchModal payload={launch} onDismiss={() => setLaunch(null)} />

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
