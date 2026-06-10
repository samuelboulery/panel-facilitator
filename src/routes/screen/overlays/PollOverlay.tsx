// Overlay sondage / vote (PRD 5.4.7 / 5.4.8) — règle D2 :
//   poll   → barres de résultats EN TEMPS RÉEL pendant le vote
//   versus → résultats masqués pendant le vote (split A/B), révélés à la clôture
// show_results=false : les chiffres restent cachés même clôturé.
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { subscribePoll } from '../../../realtime/eventData'
import type { Poll, PollResults } from '../../../shared/types'

const VERSUS_COLORS = ['var(--color-versus-a)', 'var(--color-versus-b)']

function totalVotes(results: PollResults): number {
  return Object.values(results).reduce((sum, n) => sum + n, 0)
}

function ResultBars({ poll, results }: { poll: Poll; results: PollResults }) {
  const total = totalVotes(results)

  return (
    <div className="flex flex-col gap-4">
      {poll.options.map((option) => {
        const count = results[option.id] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        return (
          <div key={option.id} className="relative h-16 overflow-hidden rounded-xl bg-white/5">
            <motion.div
              className="absolute inset-y-0 left-0 bg-accent/80"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'tween', duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="relative z-2 flex h-full items-center justify-between px-6">
              <span className="text-2xl font-semibold">{option.label}</span>
              <span className="tabular font-mono text-xl text-paper-dim">
                {pct}% · {count}
              </span>
            </div>
          </div>
        )
      })}
      <p className="micro-label mt-1">
        {total} {total > 1 ? 'votes' : 'vote'}
      </p>
    </div>
  )
}

function VersusLive({ poll }: { poll: Poll }) {
  // Pendant le vote : les deux camps, AUCUN chiffre (suspense voulu).
  return (
    <div className="flex items-stretch gap-6">
      {poll.options.slice(0, 2).map((option, i) => (
        <div
          key={option.id}
          className="flex flex-1 items-center justify-center rounded-2xl px-8 py-14"
          style={{ background: `color-mix(in srgb, ${VERSUS_COLORS[i]} 28%, transparent)` }}
        >
          <span className="display-title text-6xl">{option.label}</span>
        </div>
      ))}
      <div className="absolute left-1/2 top-1/2 z-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink px-5 py-3">
        <span className="font-mono text-xl font-semibold text-paper-dim">VS</span>
      </div>
    </div>
  )
}

export function PollOverlay({ id }: { id: string }) {
  const [poll, setPoll] = useState<Poll | null>(null)
  const [results, setResults] = useState<PollResults>({})

  useEffect(() => {
    const subscription = subscribePoll(id, setPoll, setResults)
    return () => subscription.unsubscribe()
  }, [id])

  if (!poll) return null

  const isLive = poll.status === 'live'
  const isClosed = poll.status === 'closed'
  // D2 : poll = temps réel dès le live ; versus = seulement clôturé.
  const showBars =
    (poll.kind === 'poll' && (isLive || (isClosed && poll.showResults))) ||
    (poll.kind === 'versus' && isClosed && poll.showResults)
  const hiddenAtClose = isClosed && !poll.showResults
  const noVotes = isClosed && totalVotes(results) === 0

  return (
    <div className="relative rounded-3xl border border-white/10 bg-ink-soft/95 p-10 shadow-2xl backdrop-blur-md">
      <p className="micro-label mb-5 text-accent">
        {poll.kind === 'versus' ? 'Vote' : 'Sondage'}
        {isLive && ' — en cours'}
        {isClosed && ' — clôturé'}
      </p>
      <p className="display-title mb-8 max-w-[1240px] text-5xl leading-tight">
        {poll.question}
      </p>

      {hiddenAtClose ? (
        <p className="text-2xl text-paper-dim">Merci pour vos votes !</p>
      ) : noVotes && showBars ? (
        <p className="text-2xl text-paper-dim">Aucun vote</p>
      ) : showBars ? (
        <ResultBars poll={poll} results={results} />
      ) : poll.kind === 'versus' && isLive ? (
        <VersusLive poll={poll} />
      ) : null}

      {isLive && (
        <p className="micro-label mt-8">Votez depuis le QR code →</p>
      )}
    </div>
  )
}
