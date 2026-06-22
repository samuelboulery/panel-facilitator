// Barre d'état basse de l'IR (maquettes iPad 13/17/18) — toujours visible :
// overlay actif (gauche), mode courant (centre), heure + durée (droite).
// Sondage live : la barre s'étend avec les résultats temps réel et le bouton
// « Arrêter le sondage » (iPad 18). Question active : « Retirer la question ».
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Content, Definition, Poll, PollResults, Question, ScreenState } from '../../../shared/types'

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
    // Tick 1s : le chrono Durée affiche les secondes et doit avancer visiblement.
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

interface StatusBarProps {
  screen: ScreenState
  /** Sondage actuellement en overlay (résultats live), null sinon. */
  activePoll: Poll | null
  activePollResults: PollResults
  /** Question actuellement en overlay, null sinon. */
  activeQuestion: Question | null
  /** Définition actuellement en overlay, null sinon. */
  activeDefinition: Definition | null
  /** Contenu projeté (mode dynamique), null sinon. */
  activeContent: Content | null
  onStopPoll: () => void
  onCloseQuestion: () => void
  onCloseDefinition: () => void
  onStopContent: () => void
  /** Démarre/arrête le timer de durée (bouton sur la case Durée). */
  onToggleTimer: () => void
}

export function StatusBar({
  screen,
  activePoll,
  activePollResults,
  activeQuestion,
  activeDefinition,
  activeContent,
  onStopPoll,
  onCloseQuestion,
  onCloseDefinition,
  onStopContent,
  onToggleTimer,
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

      {/* Définition active : rappel + retrait (symétrie avec la question) */}
      <AnimatePresence>
        {screen.overlay?.type === 'definition' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-b border-white/10"
          >
            <div className="flex items-center justify-between gap-4 px-5 py-2.5">
              <p className="truncate text-sm text-white/80">
                {activeDefinition?.term ?? 'Définition affichée'}
              </p>
              <button
                type="button"
                onClick={onCloseDefinition}
                className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-control-ink active:scale-95"
              >
                Retirer la définition
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contenu projeté : rappel + arrêt (retour à la scène titre) */}
      <AnimatePresence>
        {activeContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-b border-white/10"
          >
            <div className="flex items-center justify-between gap-4 px-5 py-2.5">
              <p className="truncate text-sm text-white/80">
                Contenu en cours : {activeContent.label}
              </p>
              <button
                type="button"
                onClick={onStopContent}
                className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-control-ink active:scale-95"
              >
                Arrêter le contenu
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

        <div className="flex flex-col items-center justify-center border-l border-white/10 px-5">
          <span className="text-xs tracking-[0.2em] text-white/50 uppercase">Heure</span>
          <span className="tabular text-lg font-semibold">
            {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}
          </span>
        </div>
        {/* Durée : timer manuel — tap pour démarrer/arrêter */}
        <button
          type="button"
          onClick={onToggleTimer}
          className="flex flex-col items-center justify-center border-l border-white/10 px-5 active:bg-white/5"
        >
          <span className="flex items-center gap-1.5 text-xs tracking-[0.2em] text-white/50 uppercase">
            Durée
            <span aria-hidden className="text-[10px]">
              {screen.timerStartedAt ? '■' : '▶'}
            </span>
          </span>
          <span
            className={`tabular text-lg font-semibold ${
              screen.timerStartedAt ? '' : 'text-white/40'
            }`}
          >
            {formatDuration(screen.timerStartedAt, now)}
          </span>
        </button>
      </div>
    </div>
  )
}
