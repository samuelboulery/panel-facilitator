// Vue Gestion (centre, défaut) — maquettes iPad 13/16/17/18.
// Définitions en chips dragables (génération LLM via « + », usage unique),
// Questions en liste dragable (création via « + », disparaissent une fois
// posées), Sondages et Votes en piles dragables. Toute action d'affichage
// passe par la modale 3 s ; la machine à états refuse les conflits (toast).
import { useState } from 'react'
import type { ControlSession } from '../../../realtime/mutations'
import * as mutations from '../../../realtime/mutations'
import type { Definition, Poll, Question } from '../../../shared/types'
import type { ControlState } from '../hooks/useControlState'
import type { LaunchPayload } from '../components/LaunchModal'
import { AdHocPollModal } from '../components/AdHocPollModal'
import { ReorderableChips } from '../components/ReorderableChips'
import { ReorderableList } from '../components/ReorderableList'

interface GestionViewProps {
  control: ControlState
  session: ControlSession
  questions: Question[]
  polls: Poll[]
  definitions: Definition[]
  onLaunch: (payload: LaunchPayload) => void
}

function SectionCard({
  title,
  onAdd,
  addLabel,
  children,
}: {
  title: string
  onAdd?: () => void
  addLabel?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl bg-control-panel p-3">
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
      {children}
    </section>
  )
}

export function GestionView({
  control,
  session,
  questions,
  polls,
  definitions,
  onLaunch,
}: GestionViewProps) {
  const [adHocOpen, setAdHocOpen] = useState<'poll' | 'versus' | null>(null)
  const [newQuestion, setNewQuestion] = useState<string | null>(null)
  const [newTerm, setNewTerm] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  // Posées (done) et archivées disparaissent ; définitions déjà affichées aussi.
  const visibleQuestions = questions.filter(
    (q) => q.status !== 'archived' && q.status !== 'done',
  )
  const availableDefinitions = definitions.filter((d) => !d.used)
  const sondages = polls.filter((p) => p.kind === 'poll' && p.status !== 'archived')
  const votes = polls.filter((p) => p.kind === 'versus' && p.status !== 'archived')
  const overlay = control.screen.overlay

  const launchDefinition = (id: string) => {
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
      await mutations.generateDefinition(session, term)
      setNewTerm(null)
    } catch {
      // L'erreur reste discrète : le champ garde le terme pour réessayer.
    } finally {
      setGenerating(false)
    }
  }

  const reorder = (table: mutations.ReorderableTable) => (ids: string[]) => {
    mutations.reorderList(session, table, ids).catch(() => undefined)
  }

  // Le reorder des polls porte sur la table entière : recoller TOUS les autres
  // (y compris archivés) pour garder des sort_order cohérents.
  const reorderPolls = (kind: 'poll' | 'versus') => (ids: string[]) => {
    const others = polls.filter((p) => p.kind !== kind).map((p) => p.id)
    const ordered = kind === 'poll' ? [...ids, ...others] : [...others, ...ids]
    mutations.reorderList(session, 'polls', ordered).catch(() => undefined)
  }

  return (
    <div className="flex flex-col gap-3">
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
          activeId={overlay?.type === 'definition' ? overlay.id : null}
          onTap={launchDefinition}
          onReorder={reorder('definitions')}
        />
        {availableDefinitions.length === 0 && newTerm === null && (
          <p className="px-1 py-2 text-sm text-control-dim">
            Plus de définition disponible — « + » pour en générer une.
          </p>
        )}
      </SectionCard>

      <div className="grid grid-cols-2 gap-3">
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
            renderItem={(question) => (
              <QuestionCard
                question={question}
                active={overlay?.type === 'question' && overlay.id === question.id}
                onLaunch={() => launchQuestion(question)}
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
              />
            )}
          />
          {visibleQuestions.length === 0 && newQuestion === null && (
            <p className="px-1 py-2 text-sm text-control-dim">
              Aucune question — le QR code alimente cette liste en direct.
            </p>
          )}
        </SectionCard>

        <div className="flex flex-col gap-3">
          {/* Sondages */}
          <SectionCard
            title="Sondages"
            addLabel="Créer un sondage"
            onAdd={() => setAdHocOpen('poll')}
          >
            <ReorderableList
              items={sondages}
              onReorder={reorderPolls('poll')}
              renderItem={(poll) => (
                <PollCard poll={poll} overlayActive={overlay?.id === poll.id} onLaunch={launchPoll} />
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
              renderItem={(poll) => (
                <PollCard poll={poll} overlayActive={overlay?.id === poll.id} onLaunch={launchPoll} />
              )}
            />
          </SectionCard>

          {/* Contrôles EP */}
          <SectionCard title="Écran public">
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                label="Bandeau speakers"
                on={control.screen.speakersBannerVisible}
                onToggle={control.toggleSpeakersBanner}
              />
              <ToggleChip
                label="QR code"
                on={control.screen.qrVisible}
                onToggle={control.toggleQr}
              />
              <button
                type="button"
                disabled={!overlay}
                onClick={control.closeOverlay}
                className="rounded-xl bg-control-ink px-4 py-2.5 text-sm font-medium text-white shadow-sm transition active:scale-95 disabled:opacity-30"
              >
                Fermer l’overlay
              </button>
            </div>
          </SectionCard>
        </div>
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
  onPin,
  onArchive,
}: {
  question: Question
  active: boolean
  onLaunch: () => void
  onPin: () => void
  onArchive: () => void
}) {
  return (
    <div
      className={`rounded-xl border bg-control-card p-3 shadow-sm transition ${
        active
          ? 'border-control-accent'
          : question.pinned
            ? 'border-control-accent/40'
            : 'border-transparent'
      }`}
    >
      <button type="button" className="w-full text-left text-sm leading-snug" onClick={onLaunch}>
        {question.text}
      </button>
      <div className="mt-2 flex items-center gap-2">
        {question.source === 'audience' && (
          <span className="rounded bg-control-accent px-1.5 py-0.5 font-mono text-[10px] text-white">
            Public
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onPin}
          className={`rounded px-2 py-1 font-mono text-[11px] active:scale-95 ${
            question.pinned ? 'bg-control-accent/15 text-control-accent' : 'text-control-dim'
          }`}
        >
          {question.pinned ? 'Épinglée' : 'Épingler'}
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="rounded px-2 py-1 font-mono text-[11px] text-control-dim active:scale-95"
        >
          Archiver
        </button>
      </div>
    </div>
  )
}

function PollCard({
  poll,
  overlayActive,
  onLaunch,
}: {
  poll: Poll
  overlayActive: boolean
  onLaunch: (poll: Poll) => void
}) {
  const live = poll.status === 'live'
  const closed = poll.status === 'closed'
  return (
    <button
      type="button"
      onClick={() => !live && onLaunch(poll)}
      className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium shadow-sm transition active:scale-[0.98] ${
        live || overlayActive
          ? 'bg-control-accent text-white'
          : closed
            ? 'bg-control-card text-control-dim'
            : 'bg-control-card text-control-ink'
      }`}
    >
      {poll.question}
      {live && ' · en cours'}
      {closed && ' · clôturé'}
    </button>
  )
}

function ToggleChip({
  label,
  on,
  onToggle,
}: {
  label: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition active:scale-95 ${
        on ? 'bg-control-card text-control-ink' : 'bg-control-card/50 text-control-dim line-through'
      }`}
    >
      {label}
    </button>
  )
}
