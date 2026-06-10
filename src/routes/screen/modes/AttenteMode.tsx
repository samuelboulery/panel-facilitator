// Mode ATTENTE (PRD 5.2) — ce que l'audience voit en entrant dans la salle.
// Composition affiche : titre à gauche, timer monumental, fiche speaker en
// rotation à droite. Un seul speaker : fiche statique (PRD 5.2.2).
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { EventData } from '../../../realtime/eventData'
import { useCountdown } from '../hooks/useCountdown'
import { SpeakerAvatar } from '../components/SpeakerAvatar'

const ROTATION_MS = 6000

const pad = (n: number) => String(n).padStart(2, '0')

function Timer({ startAt }: { startAt: string | null }) {
  const countdown = useCountdown(startAt)
  if (!countdown) return null

  if (countdown.done) {
    return (
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="display-title text-accent text-7xl"
      >
        C’est parti !
      </motion.p>
    )
  }

  const display =
    countdown.hours > 0
      ? `${pad(countdown.hours)}:${pad(countdown.minutes)}:${pad(countdown.seconds)}`
      : `${pad(countdown.minutes)}:${pad(countdown.seconds)}`

  return (
    <div>
      <p className="micro-label mb-4">Début dans</p>
      <p className="display-title tabular text-[11rem] leading-none">{display}</p>
    </div>
  )
}

function RotatingSpeakers({ data }: { data: EventData }) {
  const speakers = data.speakers.filter((s) => !s.hidden && !s.isHost)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    // Liste modifiée (speaker masqué en live) : rotation repart proprement de 0.
    setIndex(0)
    if (speakers.length <= 1) return
    const id = setInterval(() => setIndex((i) => (i + 1) % speakers.length), ROTATION_MS)
    return () => clearInterval(id)
  }, [speakers.length])

  if (speakers.length === 0) return null
  const speaker = speakers[index % speakers.length]

  return (
    <div className="relative h-[340px] w-[420px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={speaker.id}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ type: 'tween', duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 flex flex-col justify-end gap-4 overflow-hidden rounded-3xl border border-white/10 bg-ink-soft p-8"
        >
          <SpeakerAvatar speaker={speaker} className="h-28 w-28 rounded-2xl text-4xl" />
          <div>
            <p className="display-title text-4xl">
              {speaker.firstName} {speaker.lastName}
            </p>
            <p className="mt-2 font-mono text-sm text-paper-dim">
              {[speaker.title, speaker.company].filter(Boolean).join(' · ')}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {speakers.length > 1 && (
        <div className="absolute -bottom-8 left-8 flex gap-2">
          {speakers.map((s, i) => (
            <span
              key={s.id}
              className={`h-1 w-6 rounded-full transition-colors duration-300 ${
                i === index % speakers.length ? 'bg-accent' : 'bg-white/15'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function AttenteMode({ data }: { data: EventData }) {
  const { event } = data

  return (
    <div className="relative z-2 flex h-full items-center justify-between gap-16 px-24 pb-24">
      <div className="max-w-[820px]">
        <p className="micro-label mb-6">
          {[event.subtitle, event.edition].filter(Boolean).join(' — ') || 'Table ronde'}
        </p>
        <h1 className="display-title mb-16 text-7xl">{event.title}</h1>
        <Timer startAt={event.startAt} />
      </div>
      <RotatingSpeakers data={data} />
    </div>
  )
}
