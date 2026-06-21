// Barre d'état basse de l'IR — s'adapte à l'état EP (maquette Figma, 7 états).
// Thème CLAIR hors mode dynamique (attente/intro/outro), SOMBRE en dynamique
// (seul mode où vivent overlays, contenu et navigation interne — cf. machine
// à états). Région gauche : libellé de mode centré, ou panneau de l'overlay
// actif (sondage/vote, question, contenu) avec son action. Cluster droit
// permanent : Définition (si active, lecture seule), Heure, Durée (timer
// manuel), navigation Slides (intro/contenu dynamique).
import { useEffect, useState } from 'react'
import type { Content, Definition, Poll, PollResults, Question, ScreenState } from '../../../shared/types'

const MODE_LABELS: Record<ScreenState['mode'], string> = {
  attente: 'Attente',
  intro: 'Intro',
  dynamique: 'Slides Dynamiques',
  outro: 'Outro',
}

// Remplissage des barres de résultats : blanc tant que le scrutin est ouvert,
// ardoise une fois clôturé/révélé (état « Vote fini » de la maquette).
const BAR_FILL_CLOSED = '#5b6478'

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
  /** Sondage/vote actuellement en overlay (résultats live), null sinon. */
  activePoll: Poll | null
  activePollResults: PollResults
  /** Question actuellement en overlay, null sinon. */
  activeQuestion: Question | null
  /** Définition actuellement en overlay, null sinon (colonne lecture seule). */
  activeDefinition: Definition | null
  /** Contenu projeté (mode dynamique), null sinon. */
  activeContent: Content | null
  /** Clôture le scrutin : « Arrêter le sondage » (poll) / « Révéler le résultat » (versus). */
  onStopPoll: () => void
  /** Retire l'overlay scrutin de l'EP : « Retirer le sondage/vote » (statut clôturé). */
  onRemovePoll: () => void
  onCloseQuestion: () => void
  onStopContent: () => void
  /** Démarre/arrête le timer de durée (bouton sur la case Durée). */
  onToggleTimer: () => void
  /** Navigation slides — null = flèche désactivée (mode sans navigation). */
  onSlidePrev: (() => void) | null
  onSlideNext: (() => void) | null
}

export function StatusBar({
  screen,
  activePoll,
  activePollResults,
  activeQuestion,
  activeDefinition,
  activeContent,
  onStopPoll,
  onRemovePoll,
  onCloseQuestion,
  onStopContent,
  onToggleTimer,
  onSlidePrev,
  onSlideNext,
}: StatusBarProps) {
  const now = useClock()
  // Seul le mode dynamique porte overlays/contenu : il fixe aussi le thème sombre.
  const dark = screen.mode === 'dynamique'
  const sep = dark ? 'border-white/10' : 'border-black/10'
  const micro = `font-mono text-xs uppercase tracking-[0.2em] ${dark ? 'text-white/50' : 'text-control-dim'}`
  const arrowCls = `flex h-8 w-8 items-center justify-center rounded-full text-xs active:scale-90 disabled:opacity-30 ${
    dark ? 'bg-white/10' : 'bg-black/5'
  }`
  const actionBtn =
    'shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-control-ink active:scale-95'

  const totalVotes = Object.values(activePollResults).reduce((s, n) => s + n, 0)
  const pollClosed = activePoll?.status === 'closed'
  const isVersus = activePoll?.kind === 'versus'

  return (
    <div
      className={`z-30 flex shrink-0 items-stretch font-display ${
        dark ? 'bg-control-ink text-white' : 'bg-control-panel text-control-ink'
      }`}
    >
      {/* Région gauche — overlay actif ou libellé de mode centré */}
      <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-3">
        {activePoll ? (
          <>
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className={micro}>{isVersus ? 'Vote' : 'Sondage'}</span>
              <div className="flex items-center gap-4">
                <span className="tabular font-mono text-sm text-white/60">{totalVotes} p.</span>
                <button
                  type="button"
                  onClick={pollClosed ? onRemovePoll : onStopPoll}
                  className={actionBtn}
                >
                  {pollClosed
                    ? isVersus
                      ? 'Retirer le vote'
                      : 'Retirer le sondage'
                    : isVersus
                      ? 'Révéler le résultat'
                      : 'Arrêter le sondage'}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {activePoll.options.map((option) => {
                const count = activePollResults[option.id] ?? 0
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                return (
                  <div key={option.id} className="relative h-9 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="absolute inset-y-0 left-0 transition-[width] duration-300"
                      style={{ width: `${pct}%`, backgroundColor: pollClosed ? BAR_FILL_CLOSED : '#ffffff' }}
                    />
                    <div className="relative z-2 flex h-full items-center justify-between px-4 text-sm mix-blend-difference">
                      <span className="truncate">{option.label}</span>
                      <span className="tabular shrink-0 font-mono">
                        {pct}% - {String(count).padStart(2, '0')} p
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : activeQuestion ? (
          <>
            <span className={micro}>Question</span>
            <div className="mt-1 flex items-center justify-between gap-4">
              <p className="truncate text-base">{activeQuestion.text}</p>
              <button type="button" onClick={onCloseQuestion} className={actionBtn}>
                Retirer la question
              </button>
            </div>
          </>
        ) : activeContent ? (
          <>
            <span className={micro}>Contenu</span>
            <div className="mt-1 flex items-center justify-between gap-4">
              <p className="truncate text-base">Contenu en cours : {activeContent.label}</p>
              <button type="button" onClick={onStopContent} className={actionBtn}>
                Arrêter le contenu
              </button>
            </div>
          </>
        ) : (
          <span className="w-full text-center text-lg font-semibold tracking-wide">
            {MODE_LABELS[screen.mode]}
          </span>
        )}
      </div>

      {/* Définition active : colonne compacte (lecture seule, auto-fermeture 12 s). */}
      {activeDefinition && (
        <div className={`relative flex flex-col items-center justify-center border-l ${sep} px-6`}>
          <span className={micro}>Définition</span>
          <span className="mt-1 text-lg font-semibold">{activeDefinition.term}</span>
          {/* Filet d'accent : signale la définition affichée sur l'EP. */}
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-control-accent" />
        </div>
      )}

      {/* Heure */}
      <div className={`flex flex-col items-center justify-center border-l ${sep} px-5`}>
        <span className={micro}>Heure</span>
        <span className="tabular text-lg font-semibold">
          {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}
        </span>
      </div>

      {/* Durée : timer manuel — tap pour démarrer/arrêter */}
      <button
        type="button"
        onClick={onToggleTimer}
        className={`flex flex-col items-center justify-center border-l ${sep} px-5 ${
          dark ? 'active:bg-white/5' : 'active:bg-black/5'
        }`}
      >
        <span className={`flex items-center gap-1.5 ${micro}`}>
          Durée
          <span aria-hidden className="text-[10px]">
            {screen.timerStartedAt ? '■' : '▶'}
          </span>
        </span>
        <span
          className={`tabular text-lg font-semibold ${
            screen.timerStartedAt ? '' : dark ? 'text-white/40' : 'text-control-dim'
          }`}
        >
          {formatDuration(screen.timerStartedAt, now)}
        </span>
      </button>

      {/* Slides : navigation interne (intro : slides ; dynamique : pas du deck) */}
      <div className={`flex flex-col items-center justify-center gap-1 border-l ${sep} px-5`}>
        <span className={micro}>Slides</span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Slide précédente"
            disabled={!onSlidePrev}
            onClick={() => onSlidePrev?.()}
            className={arrowCls}
          >
            ◀
          </button>
          <button
            type="button"
            aria-label="Slide suivante"
            disabled={!onSlideNext}
            onClick={() => onSlideNext?.()}
            className={arrowCls}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  )
}
