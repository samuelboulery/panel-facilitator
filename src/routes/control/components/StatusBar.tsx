// Barre d'état basse de l'IR (maquettes iPad 13/17/18) — toujours visible :
// overlay actif (gauche), mode courant (centre), heure + durée (droite).
// Sondage live : la barre s'étend avec les résultats temps réel et le bouton
// « Arrêter le sondage » (iPad 18). Question active : « Retirer la question ».
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Poll, PollResults, Question, ScreenState } from '../../../shared/types'

const MODE_LABELS: Record<ScreenState['mode'], string> = {
  attente: 'Attente',
  intro: 'Intro',
  dynamique: 'Dynamique',
  outro: 'Outro',
}

const OVERLAY_LABELS = { poll: 'Sondage', question: 'Question', definition: 'Définition' }

function useClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function formatDuration(startAt: string | null, now: Date): string {
  if (!startAt) return '00h00'
  const elapsed = now.getTime() - new Date(startAt).getTime()
  if (Number.isNaN(elapsed) || elapsed < 0) return '00h00'
  const h = Math.floor(elapsed / 3_600_000)
  const m = Math.floor((elapsed % 3_600_000) / 60_000)
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}

interface StatusBarProps {
  screen: ScreenState
  eventStartAt: string | null
  screenOnline: boolean
  latencyMs: number | null
  /** Sondage actuellement en overlay (résultats live), null sinon. */
  activePoll: Poll | null
  activePollResults: PollResults
  /** Question actuellement en overlay, null sinon. */
  activeQuestion: Question | null
  onStopPoll: () => void
  onCloseQuestion: () => void
}

export function StatusBar({
  screen,
  eventStartAt,
  screenOnline,
  latencyMs,
  activePoll,
  activePollResults,
  activeQuestion,
  onStopPoll,
  onCloseQuestion,
}: StatusBarProps) {
  const now = useClock()
  const overlayLabel = screen.overlay ? OVERLAY_LABELS[screen.overlay.type] : null
  const pollIsLive = activePoll?.status === 'live'
  const totalVotes = Object.values(activePollResults).reduce((s, n) => s + n, 0)

  return (
    <div className="z-30 shrink-0 bg-control-ink font-mono text-white">
      {/* Extension sondage live (iPad 18) */}
      <AnimatePresence>
        {pollIsLive && activePoll && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-white/10"
          >
            <div className="flex items-center justify-between px-5 pt-3 pb-1">
              <span className="text-xs tracking-[0.2em] text-white/60 uppercase">Sondage</span>
              <div className="flex items-center gap-4">
                <span className="tabular text-sm text-white/60">{totalVotes} p.</span>
                <button
                  type="button"
                  onClick={onStopPoll}
                  className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-control-ink active:scale-95"
                >
                  Arrêter le sondage
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 px-5 pb-3">
              {activePoll.options.map((option) => {
                const count = activePollResults[option.id] ?? 0
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                return (
                  <div key={option.id} className="relative h-7 overflow-hidden rounded bg-white/10">
                    <div
                      className="absolute inset-y-0 left-0 bg-white/85 transition-[width] duration-300"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative z-2 flex h-full items-center justify-between px-3 text-sm mix-blend-difference">
                      <span>{option.label}</span>
                      <span className="tabular">
                        {pct}% - {String(count).padStart(2, '0')} p
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question active : rappel + retrait (iPad 17) */}
      <AnimatePresence>
        {activeQuestion && screen.overlay?.type === 'question' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-b border-white/10"
          >
            <div className="flex items-center justify-between gap-4 px-5 py-2.5">
              <p className="truncate text-sm text-white/80">{activeQuestion.text}</p>
              <button
                type="button"
                onClick={onCloseQuestion}
                className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-control-ink active:scale-95"
              >
                Retirer la question
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rangée permanente */}
      <div className="flex items-stretch">
        <div className="flex flex-1 flex-col justify-center px-5 py-2">
          <span className="text-xs tracking-[0.2em] text-white/50 uppercase">
            {overlayLabel ?? '—'}
          </span>
          <span className="text-center text-lg font-semibold tracking-wide">
            {MODE_LABELS[screen.mode]}
          </span>
        </div>

        {/* Connexion EP + latence */}
        <div className="flex flex-col items-center justify-center border-l border-white/10 px-4">
          <span className="text-xs tracking-[0.2em] text-white/50 uppercase">EP</span>
          <span className="flex items-center gap-1.5 text-sm">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                screenOnline ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            {latencyMs !== null ? `${latencyMs}ms` : '—'}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center border-l border-white/10 px-5">
          <span className="text-xs tracking-[0.2em] text-white/50 uppercase">Heure</span>
          <span className="tabular text-lg font-semibold">
            {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center border-l border-white/10 px-5">
          <span className="text-xs tracking-[0.2em] text-white/50 uppercase">Durée</span>
          <span className="tabular text-lg font-semibold">{formatDuration(eventStartAt, now)}</span>
        </div>
      </div>
    </div>
  )
}
