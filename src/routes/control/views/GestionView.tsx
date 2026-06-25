// Vue Gestion (centre, défaut) — maquettes iPad 13/16/17/18.
// Définitions en chips dragables (génération LLM via « + », usage unique),
// Questions en liste dragable (création via « + », disparaissent une fois
// posées), Sondages et Votes en piles dragables. Toute action d'affichage
// passe par la modale 3 s ; la machine à états refuse les conflits (toast).
import { useEffect, useState } from 'react'
import type { ControlSession } from '../../../realtime/mutations'
import * as mutations from '../../../realtime/mutations'
import type { Content, Definition, Poll, Question } from '../../../shared/types'
import type { ControlState } from '../hooks/useControlState'
import type { LaunchPayload } from '../components/LaunchModal'
import { AdHocPollModal } from '../components/AdHocPollModal'
import { ReorderableChips } from '../components/ReorderableChips'
import { ReorderableList } from '../components/ReorderableList'
import { computePollOrder } from './reorderStrategies'

interface GestionViewProps {
  control: ControlState
  session: ControlSession
  questions: Question[]
  polls: Poll[]
  definitions: Definition[]
  contents: Content[]
  /** Durée (ms) d'affichage auto d'une définition — alimente la barre de progression. */
  definitionProgressMs: number
  onLaunch: (payload: LaunchPayload) => void
  /** Brouillon LLM fraîchement généré, à relire dans la modale de revue. */
  onGenerated: (definition: Definition) => void
}

// Horloge live (tick 1 s) — l'heure et la durée du timer doivent avancer.
function useClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function formatDuration(startedAt: string | null, now: Date): string {
  if (!startedAt) return '00:00'
  const elapsed = now.getTime() - new Date(startedAt).getTime()
  if (Number.isNaN(elapsed) || elapsed < 0) return '00:00'
  const h = Math.floor(elapsed / 3_600_000)
  const m = Math.floor((elapsed % 3_600_000) / 60_000)
  const s = Math.floor((elapsed % 60_000) / 1000)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function SectionCard({
  title,
  onAdd,
  addLabel,
  className,
  children,
}: {
  title: string
  onAdd?: () => void
  addLabel?: string
  /** Classes supplémentaires (largeur de cellule, etc.). */
  className?: string
  children?: React.ReactNode
}) {
  return (
    <section className={`flex min-h-0 min-w-0 flex-col rounded-2xl bg-control-panel p-3 ${className ?? ''}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="font-mono text-sm tracking-wide text-control-dim">{title}</h2>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={addLabel}
            className="px-2 font-mono text-lg leading-none text-control-dim active:scale-90"
          >
            +
          </button>
        )}
      </div>
      {/* Corps défilant : le dashboard occupe une slide de hauteur fixe. */}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  )
}

export function GestionView({
  control,
  session,
  questions,
  polls,
  definitions,
  contents,
  definitionProgressMs,
  onLaunch,
  onGenerated,
}: GestionViewProps) {
  const [adHocOpen, setAdHocOpen] = useState<'poll' | 'versus' | null>(null)
  const [newQuestion, setNewQuestion] = useState<string | null>(null)
  const [newTerm, setNewTerm] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const now = useClock()

  // Posées (done) et archivées disparaissent ; définitions déjà affichées aussi.
  // Épinglées remontent en tête, triées par ordre chronologique d'épinglage.
  const visibleQuestions = questions
    .filter((q) => q.status !== 'archived' && q.status !== 'done')
    .sort((a, b) => {
      if (a.pinned === b.pinned) {
        return a.pinned
          ? (a.pinnedAt ?? '').localeCompare(b.pinnedAt ?? '')
          : a.sortOrder - b.sortOrder
      }
      return a.pinned ? -1 : 1
    })
  const overlay = control.screen.overlay
  // Définition active : reste visible « en cours » (avec progression) à sa place
  // jusqu'à l'auto-fermeture, même si elle vient de passer en used.
  const activeDefinitionId = overlay?.type === 'definition' ? overlay.id : null
  const availableDefinitions = definitions.filter(
    (d) => (!d.used && d.validated) || d.id === activeDefinitionId,
  )
  const sondages = polls.filter((p) => p.kind === 'poll' && p.status !== 'archived')
  const votes = polls.filter((p) => p.kind === 'versus' && p.status !== 'archived')

  const launchDefinition = (id: string) => {
    // Définition déjà en cours : un nouveau clic la retire de l'EP.
    if (id === activeDefinitionId) {
      control.closeOverlay()
      return
    }
    const def = availableDefinitions.find((d) => d.id === id)
    if (!def) return
    onLaunch({
      label: 'Lancement de la définition',
      title: def.term,
      body: def.definition,
      onConfirm: () => {
        control.showOverlay({ type: 'definition', id })
        // Usage unique : la chip disparaît de la liste dès le lancement.
        mutations.setDefinitionUsed(session, id, true).catch(() => undefined)
      },
    })
  }

  const launchQuestion = (question: Question) => {
    onLaunch({
      label: 'Lancement de la question',
      title: question.text,
      onConfirm: () => {
        control.showOverlay({ type: 'question', id: question.id })
        mutations.setQuestionStatus(session, question.id, 'displayed').catch(() => undefined)
      },
    })
  }

  const launchPoll = (poll: Poll) => {
    onLaunch({
      label: poll.kind === 'versus' ? 'Lancement du vote' : 'Lancement du sondage',
      title: poll.question,
      onConfirm: () => {
        // Le sondage passe live PUIS s'affiche — jamais d'overlay sur un
        // sondage resté draft si le RPC échoue.
        mutations
          .setPollStatus(session, poll.id, 'live')
          .then(() => control.showOverlay({ type: 'poll', id: poll.id }))
          .catch(() => undefined)
      },
    })
  }

  const launchContent = (content: Content) => {
    // Re-tap du contenu actif : arrêt immédiat (retour à la scène titre), sans modale.
    if (control.screen.mainContentId === content.id) {
      control.setMainContent(null)
      return
    }
    onLaunch({
      label: 'Lancement du contenu',
      title: content.label,
      // Entre en dynamique (si besoin) PUIS projette — un seul RPC (cf. launchContent).
      onConfirm: () => control.launchContent(content.id),
    })
  }

  // Arrêts in-place (remplacent les contrôles de l'ancien bandeau d'état).
  // Sondage/vote : live → clôture (résultats) ; clôturé → retrait de l'overlay.
  const stopPoll = (poll: Poll) => {
    if (poll.status === 'closed') control.closeOverlay()
    else mutations.setPollStatus(session, poll.id, 'closed').catch(() => undefined)
  }
  const closeActiveQuestion = (question: Question) => {
    control.closeOverlay()
    mutations.setQuestionStatus(session, question.id, 'done').catch(() => undefined)
  }
  const toggleTimer = () => {
    mutations
      .setTimerStartedAt(session, control.screen.timerStartedAt ? null : new Date().toISOString())
      .catch(() => undefined)
  }

  const submitNewQuestion = () => {
    const text = newQuestion?.trim()
    if (!text) return
    mutations.createQuestion(session, text).catch(() => undefined)
    setNewQuestion(null)
  }

  const submitNewTerm = async () => {
    const term = newTerm?.trim()
    if (!term || generating) return
    setGenerating(true)
    try {
      const def = await mutations.generateDefinition(session, term)
      setNewTerm(null)
      onGenerated(def)
    } catch {
      // L'erreur reste discrète : le champ garde le terme pour réessayer.
    } finally {
      setGenerating(false)
    }
  }

  const reorder = (table: mutations.ReorderableTable) => (ids: string[]) => {
    mutations.reorderList(session, table, ids).catch(() => undefined)
  }

  // Le reorder des polls porte sur la table entière (cf. computePollOrder).
  const reorderPolls = (kind: 'poll' | 'versus') => (ids: string[]) => {
    mutations.reorderList(session, 'polls', computePollOrder(polls, kind, ids)).catch(() => undefined)
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Maquette : rangée haute Définitions + Questions, rangée basse
          Contenus + Sondages + Votes + Infos. */}
      <div className="grid min-h-0 flex-[1.3_1_0%] grid-cols-[1.6fr_1fr] gap-2">
          {/* Définitions — chips dragables, génération LLM */}
          <SectionCard
            title="Définitions"
            addLabel="Générer une définition"
            onAdd={() => setNewTerm((v) => (v === null ? '' : v))}
          >
            {newTerm !== null && (
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={newTerm}
                  autoFocus
                  onChange={(e) => setNewTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void submitNewTerm()}
                  maxLength={60}
                  placeholder="Terme à définir (génération auto)"
                  className="flex-1 rounded-xl bg-control-card px-3.5 py-2.5 text-sm outline-control-accent"
                />
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => void submitNewTerm()}
                  className="rounded-xl bg-control-ink px-4 py-2.5 font-mono text-sm text-white active:scale-95 disabled:opacity-50"
                >
                  {generating ? 'Génération…' : 'Générer'}
                </button>
                <button
                  type="button"
                  onClick={() => setNewTerm(null)}
                  className="px-2 font-mono text-sm text-control-dim active:scale-95"
                >
                  Annuler
                </button>
              </div>
            )}
            <ReorderableChips
              items={availableDefinitions.map((d) => ({ id: d.id, label: d.term }))}
              activeId={activeDefinitionId}
              activeProgressMs={definitionProgressMs}
              onTap={launchDefinition}
              onReorder={reorder('definitions')}
            />
            {availableDefinitions.length === 0 && newTerm === null && (
              <p className="px-1 py-2 text-sm text-control-dim">
                Plus de définition disponible — « + » pour en générer une.
              </p>
            )}
          </SectionCard>

          {/* Questions — préparées + audience, dragables */}
          <SectionCard
            title="Questions"
            addLabel="Ajouter une question"
            onAdd={() => setNewQuestion((v) => (v === null ? '' : v))}
          >
            {newQuestion !== null && (
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={newQuestion}
                  autoFocus
                  onChange={(e) => setNewQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitNewQuestion()}
                  maxLength={300}
                  placeholder="Nouvelle question préparée"
                  className="flex-1 rounded-xl bg-control-card px-3.5 py-2.5 text-sm outline-control-accent"
                />
                <button
                  type="button"
                  onClick={submitNewQuestion}
                  className="rounded-xl bg-control-ink px-4 py-2.5 font-mono text-sm text-white active:scale-95"
                >
                  Ajouter
                </button>
              </div>
            )}
            <ReorderableList
              items={visibleQuestions}
              onReorder={reorder('questions')}
              renderItem={(question, handle) => (
                <QuestionCard
                  question={question}
                  active={overlay?.type === 'question' && overlay.id === question.id}
                  onLaunch={() => launchQuestion(question)}
                  onClose={() => closeActiveQuestion(question)}
                  onPin={() =>
                    mutations
                      .setQuestionPinned(session, question.id, !question.pinned)
                      .catch(() => undefined)
                  }
                  onArchive={() =>
                    mutations
                      .setQuestionStatus(session, question.id, 'archived')
                      .catch(() => undefined)
                  }
                  handle={handle}
                />
              )}
            />
            {visibleQuestions.length === 0 && newQuestion === null && (
              <p className="px-1 py-2 text-sm text-control-dim">
                Aucune question — le QR code alimente cette liste en direct.
              </p>
            )}
          </SectionCard>
      </div>

      {/* Rangée basse : Contenus + Sondages + Votes + Infos */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr_1fr_0.55fr] gap-2">
          {/* Contenus — médias projetables (Slides/Figma/image/vidéo). Lancement
              via modale 3 s ; tap du contenu actif = arrêt (retour scène titre). */}
          <SectionCard title="Contenus">
            {contents.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {contents.map((content) => {
                  const active = control.screen.mainContentId === content.id
                  return (
                    <button
                      key={content.id}
                      type="button"
                      onClick={() => launchContent(content)}
                      className={`rounded-xl px-4 py-2.5 text-xl font-medium shadow-sm transition active:scale-95 ${
                        active ? 'bg-control-accent text-white' : 'bg-control-card text-control-ink'
                      }`}
                    >
                      {content.label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="px-1 py-2 text-sm text-control-dim">Aucun contenu configuré.</p>
            )}
          </SectionCard>

          {/* Sondages */}
          <SectionCard
            title="Sondages"
            addLabel="Créer un sondage"
            onAdd={() => setAdHocOpen('poll')}
          >
            <ReorderableList
              items={sondages}
              onReorder={reorderPolls('poll')}
              renderItem={(poll, handle) => (
                <PollCard poll={poll} overlayActive={overlay?.id === poll.id} onLaunch={launchPoll} onStop={stopPoll} handle={handle} />
              )}
            />
          </SectionCard>

          {/* Votes */}
          <SectionCard
            title="Votes"
            addLabel="Créer un vote"
            onAdd={() => setAdHocOpen('versus')}
          >
            <ReorderableList
              items={votes}
              onReorder={reorderPolls('versus')}
              renderItem={(poll, handle) => (
                <PollCard poll={poll} overlayActive={overlay?.id === poll.id} onLaunch={launchPoll} onStop={stopPoll} handle={handle} />
              )}
            />
          </SectionCard>

          {/* Infos — horloge, timer (« Restant »), QR : relogés depuis l'ancien
              bandeau bas (supprimé). */}
          <SectionCard title="Infos">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <span className="font-mono text-xs text-control-dim">Heure</span>
                <span className="text-xl font-semibold tabular-nums">
                  {now
                    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    .replace(':', 'h')}
                </span>
              </div>
              {/* « Restant » = timer manuel — tap pour démarrer/arrêter. */}
              <button type="button" onClick={toggleTimer} className="flex flex-col items-start active:scale-95">
                <span className="flex items-center gap-1.5 font-mono text-xs text-control-dim">
                  Restant
                  <span aria-hidden className="text-[10px]">
                    {control.screen.timerStartedAt ? '■' : '▶'}
                  </span>
                </span>
                <span
                  className={`text-xl font-semibold tabular-nums ${
                    control.screen.timerStartedAt ? '' : 'text-control-dim'
                  }`}
                >
                  {formatDuration(control.screen.timerStartedAt, now)}
                </span>
              </button>
              {/* QR code : affiche/masque sur l'EP (mode dynamique). */}
              <button type="button" onClick={control.toggleQr} className="flex flex-col items-start active:scale-95">
                <span className="font-mono text-xs text-control-dim">QR code</span>
                <span className={`text-xl font-semibold ${control.screen.qrVisible ? '' : 'text-control-dim'}`}>
                  {control.screen.qrVisible ? 'Affiché' : 'Masqué'}
                </span>
              </button>
            </div>
          </SectionCard>
      </div>

      <AdHocPollModal
        kind={adHocOpen}
        session={session}
        onClose={() => setAdHocOpen(null)}
      />
    </div>
  )
}

function QuestionCard({
  question,
  active,
  onLaunch,
  onClose,
  onPin,
  onArchive,
  handle,
}: {
  question: Question
  active: boolean
  onLaunch: () => void
  /** Retire la question affichée sur l'EP (état « en cours »). */
  onClose: () => void
  onPin: () => void
  onArchive: () => void
  handle?: React.ReactNode
}) {
  // En cours : fond accent, texte blanc. Clic sur toute la card = retrait.
  return (
    <div
      onClick={active ? onClose : undefined}
      className={`rounded-xl border-2 p-3 shadow-sm transition ${
        active
          ? 'cursor-pointer border-transparent bg-control-accent text-white'
          : question.pinned
            ? 'border-[#4e57ff] bg-control-card'
            : 'border-transparent bg-control-card'
      }`}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          className={`flex-1 text-left text-xl leading-snug ${
            active ? '' : question.pinned ? 'font-bold text-[#1f27c7]' : ''
          }`}
          onClick={active ? undefined : onLaunch}
        >
          {question.text}
        </button>
        {handle}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {question.source === 'audience' && (
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
              active ? 'bg-white/20 text-white' : 'bg-control-accent text-white'
            }`}
          >
            Public
          </span>
        )}
        <span className="flex-1" />
        {active ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="rounded-full bg-white px-4 py-1.5 font-mono text-sm font-semibold text-control-ink active:scale-95"
          >
            Retirer
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onPin}
              className={`rounded px-2 py-1 font-mono text-base active:scale-95 ${
                question.pinned ? 'bg-[#1f27c7] text-white' : 'text-control-dim'
              }`}
            >
              {question.pinned ? 'Épinglée' : 'Épingler'}
            </button>
            <button
              type="button"
              onClick={onArchive}
              className="rounded px-2 py-1 font-mono text-base text-control-dim active:scale-95"
            >
              Archiver
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PollCard({
  poll,
  overlayActive,
  onLaunch,
  onStop,
  handle,
}: {
  poll: Poll
  overlayActive: boolean
  onLaunch: (poll: Poll) => void
  /** Clôture (live) ou retrait de l'overlay (clôturé) — état « en cours ». */
  onStop: (poll: Poll) => void
  handle?: React.ReactNode
}) {
  const live = poll.status === 'live'
  const closed = poll.status === 'closed'
  const isVersus = poll.kind === 'versus'
  // En cours : affiché sur l'EP (live ou overlay clôturé encore visible).
  const enCours = live || overlayActive
  const stopLabel = live ? (isVersus ? 'Révéler le résultat' : 'Arrêter le sondage') : 'Retirer'

  // En cours : clic sur toute la card = arrêt/retrait.
  return (
    <div
      onClick={enCours ? () => onStop(poll) : undefined}
      className={`flex flex-col gap-2 rounded-xl px-4 py-2.5 text-xl font-medium shadow-sm ${
        enCours
          ? 'cursor-pointer bg-control-accent text-white'
          : closed
            ? 'bg-control-card text-control-dim'
            : 'bg-control-card text-control-ink'
      }`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => !enCours && onLaunch(poll)}
          className="flex-1 text-left transition active:scale-[0.98]"
        >
          {poll.question}
          {closed && !overlayActive && ' · clôturé'}
        </button>
        {handle}
      </div>
      {enCours && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onStop(poll)
          }}
          className="rounded-full bg-white px-4 py-1.5 text-center font-mono text-sm font-semibold text-control-accent active:scale-95"
        >
          {stopLabel}
        </button>
      )}
    </div>
  )
}
