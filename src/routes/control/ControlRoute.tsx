// Architecture : Interface de Régie / Animateur (IR) — tablette-first.
// Protégée par PIN (PRD Q9), session sessionStorage (compromis V1 documenté).
// Surface unique : un carrousel = le deck d'écrans (slide dynamique = dashboard
// de gestion, slides fixes = aperçu EP). Notes accessibles par le haut. Plus de
// bandeau bas : ses fonctions (horloge, timer, QR, arrêts) vivent dans les cards.
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { z } from 'zod'
import { controlAuth, type ControlSession } from '../../realtime/mutations'
import * as mutations from '../../realtime/mutations'
import { fetchEventData, type EventData } from '../../realtime/eventData'
import {
  subscribeDefinitionList,
  subscribePollList,
  subscribeQuestionList,
  subscribeSpeakerList,
} from '../../realtime/controlData'
import type { Definition, Poll, Question, Speaker } from '../../shared/types'
import { PinGate } from './PinGate'
import { useControlState } from './hooks/useControlState'
import { LaunchModal, type LaunchPayload } from './components/LaunchModal'
import { DefinitionReviewModal } from './components/DefinitionReviewModal'
import { CardPositionModal } from './components/CardPositionModal'
import { GestionView } from './views/GestionView'
import { DeckCarousel } from './views/DeckCarousel'
import { NotesPanel } from './views/NotesPanel'

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

function ControlShell({ session }: { session: ControlSession }) {
  const control = useControlState(session)
  const [data, setData] = useState<EventData | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [definitions, setDefinitions] = useState<Definition[]>([])
  const [launch, setLaunch] = useState<LaunchPayload | null>(null)
  // Brouillon LLM en attente de revue (Annuler / Valider / Valider et lancer).
  const [reviewDef, setReviewDef] = useState<Definition | null>(null)
  // Modale de repositionnement des cartes projetées EP.
  const [editingCards, setEditingCards] = useState(false)

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

  // Fermeture auto de la définition après lecture. Le timer redémarre à chaque
  // nouvelle définition (clé = overlay.id) ; cleanup l'annule si la régie ferme
  // avant ou lance un autre overlay. Les états « en cours » (sondage, question,
  // contenu) et leurs arrêts vivent désormais dans les cards (GestionView).
  const definitionOverlayId =
    control.screen.overlay?.type === 'definition' ? control.screen.overlay.id : null
  const { closeOverlay } = control
  useEffect(() => {
    if (!definitionOverlayId) return
    const id = setTimeout(() => closeOverlay(), DEFINITION_AUTO_DISMISS_MS)
    return () => clearTimeout(id)
  }, [definitionOverlayId, closeOverlay])

  if (!data) {
    return <div className="flex h-dvh items-center justify-center bg-control-bg" />
  }

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-control-bg font-display text-control-ink">
      {/* Carrousel unique = le deck d'écrans. Slide dynamique → dashboard de
          gestion ; slides fixes → aperçu EP. Naviguer pilote l'EP. */}
      <DeckCarousel
        data={data}
        control={control}
        session={session}
        onEditCards={() => setEditingCards(true)}
        renderDynamique={() => (
          <GestionView
            control={control}
            session={session}
            questions={questions}
            polls={polls}
            definitions={definitions}
            contents={data.contents}
            definitionProgressMs={DEFINITION_AUTO_DISMISS_MS}
            onLaunch={setLaunch}
            onGenerated={setReviewDef}
          />
        )}
      />

      {/* Notes accessibles par le haut (poignée centrée, drag/clic). */}
      <NotesPanel session={session} />

      <CardPositionModal
        open={editingCards}
        data={data}
        control={control}
        onClose={() => setEditingCards(false)}
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
    // Mémorise la dernière régie ouverte pour le start_url du PWA (`/control`).
    if (slug) localStorage.setItem('panel-facilitator:last-slug', slug)
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
