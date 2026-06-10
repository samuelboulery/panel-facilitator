// Vue Gestion (centre, défaut) — maquettes iPad 13/16/17/18.
// Définitions en chips (haut), Questions en liste (gauche), Sondages et Votes
// (droite). Toute action d'affichage passe par la modale 3 s (LaunchModal).
// La machine à états refuse les conflits de priorité (toast via control).
import { useState } from 'react'
import type { ControlSession } from '../../../realtime/mutations'
import * as mutations from '../../../realtime/mutations'
import type { EventData } from '../../../realtime/eventData'
import type { Poll, Question } from '../../../shared/types'
import type { ControlState } from '../hooks/useControlState'
import type { LaunchPayload } from '../components/LaunchModal'
import { AdHocPollModal } from '../components/AdHocPollModal'

interface GestionViewProps {
  data: EventData
  control: ControlState
  session: ControlSession
  questions: Question[]
  polls: Poll[]
  onLaunch: (payload: LaunchPayload) => void
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl bg-control-panel p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="font-mono text-sm tracking-wide text-control-dim">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function GestionView({
  data,
  control,
  session,
  questions,
  polls,
  onLaunch,
}: GestionViewProps) {
  const [adHocOpen, setAdHocOpen] = useState<'poll' | 'versus' | null>(null)

  const visibleQuestions = questions.filter((q) => q.status !== 'archived')
  const sondages = polls.filter((p) => p.kind === 'poll' && p.status !== 'archived')
  const votes = polls.filter((p) => p.kind === 'versus' && p.status !== 'archived')
  const overlay = control.screen.overlay

  const launchDefinition = (id: string) => {
    const def = data.definitions.find((d) => d.id === id)
    if (!def) return
    onLaunch({
      label: 'Lancement de la définition',
      title: def.term,
      body: def.definition,
      onConfirm: () => control.showOverlay({ type: 'definition', id }),
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
          .catch(() => undefined) // l'échec remonte en toast via useControlState au prochain état
      },
    })
  }

  const archiveQuestion = (question: Question) => {
    mutations.setQuestionStatus(session, question.id, 'archived').catch(() => undefined)
  }

  const togglePin = (question: Question) => {
    mutations.setQuestionPinned(session, question.id, !question.pinned).catch(() => undefined)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Définitions — chips */}
      <SectionCard title="Définitions">
        <div className="flex flex-wrap gap-2">
          {data.definitions.map((def) => {
            const active = overlay?.type === 'definition' && overlay.id === def.id
            return (
              <button
                key={def.id}
                type="button"
                onClick={() => launchDefinition(def.id)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition active:scale-95 ${
                  active
                    ? 'bg-control-accent text-white'
                    : 'bg-control-card text-control-ink'
                }`}
              >
                {def.term}
              </button>
            )
          })}
          {data.definitions.length === 0 && (
            <p className="px-1 py-2 text-sm text-control-dim">
              Aucune définition — à préparer dans le backoffice.
            </p>
          )}
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-3">
        {/* Questions — préparées + audience */}
        <SectionCard title="Questions">
          <ul className="flex flex-col gap-2">
            {visibleQuestions.map((question) => {
              const active = overlay?.type === 'question' && overlay.id === question.id
              const done = question.status === 'done'
              return (
                <li
                  key={question.id}
                  className={`rounded-xl border bg-control-card p-3 shadow-sm transition ${
                    active
                      ? 'border-control-accent'
                      : question.pinned
                        ? 'border-control-accent/40'
                        : 'border-transparent'
                  } ${done ? 'opacity-45' : ''}`}
                >
                  <button
                    type="button"
                    className="w-full text-left text-sm leading-snug"
                    onClick={() => !done && launchQuestion(question)}
                  >
                    {question.text}
                  </button>
                  <div className="mt-2 flex items-center gap-2">
                    {question.source === 'audience' && (
                      <span className="rounded bg-control-accent px-1.5 py-0.5 font-mono text-[10px] text-white">
                        Public
                      </span>
                    )}
                    {done && (
                      <span className="font-mono text-[10px] text-control-dim uppercase">
                        Posée
                      </span>
                    )}
                    <span className="flex-1" />
                    <button
                      type="button"
                      onClick={() => togglePin(question)}
                      className={`rounded px-2 py-1 font-mono text-[11px] active:scale-95 ${
                        question.pinned
                          ? 'bg-control-accent/15 text-control-accent'
                          : 'text-control-dim'
                      }`}
                    >
                      {question.pinned ? 'Épinglée' : 'Épingler'}
                    </button>
                    <button
                      type="button"
                      onClick={() => archiveQuestion(question)}
                      className="rounded px-2 py-1 font-mono text-[11px] text-control-dim active:scale-95"
                    >
                      Archiver
                    </button>
                  </div>
                </li>
              )
            })}
            {visibleQuestions.length === 0 && (
              <p className="px-1 py-2 text-sm text-control-dim">
                Aucune question — le QR code alimente cette liste en direct.
              </p>
            )}
          </ul>
        </SectionCard>

        <div className="flex flex-col gap-3">
          {/* Sondages */}
          <SectionCard
            title="Sondages"
            action={
              <button
                type="button"
                onClick={() => setAdHocOpen('poll')}
                className="px-2 font-mono text-lg leading-none text-control-dim active:scale-90"
                aria-label="Créer un sondage"
              >
                +
              </button>
            }
          >
            <div className="flex flex-wrap gap-2">
              {sondages.map((poll) => (
                <PollChip key={poll.id} poll={poll} overlayActive={overlay?.id === poll.id} onLaunch={launchPoll} />
              ))}
            </div>
          </SectionCard>

          {/* Votes */}
          <SectionCard
            title="Votes"
            action={
              <button
                type="button"
                onClick={() => setAdHocOpen('versus')}
                className="px-2 font-mono text-lg leading-none text-control-dim active:scale-90"
                aria-label="Créer un vote"
              >
                +
              </button>
            }
          >
            <div className="flex flex-wrap gap-2">
              {votes.map((poll) => (
                <PollChip key={poll.id} poll={poll} overlayActive={overlay?.id === poll.id} onLaunch={launchPoll} />
              ))}
            </div>
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

function PollChip({
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
      className={`rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition active:scale-95 ${
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
