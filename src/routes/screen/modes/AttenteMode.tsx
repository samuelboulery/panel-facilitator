// Mode ATTENTE (PRD 5.2) — ce que l'audience voit en entrant dans la salle.
// Composition « affiche » en deux cartes de scène (cf. maquette Figma) : carte
// gauche titre + timer monumental, carte droite fiche speaker en rotation.
// Un seul speaker : fiche statique (PRD 5.2.2).
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { EventData } from '../../../realtime/eventData'
import { useCountdown } from '../hooks/useCountdown'
import { SpeakerAvatar } from '../components/SpeakerAvatar'
import { MovableCard } from '../components/MovableCard'

const ROTATION_MS = 6000

const pad = (n: number) => String(n).padStart(2, '0')

function formatDate(date: string | null): string | null {
  if (!date) return null
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

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
      <p className="micro-label mb-3">Début dans</p>
      <p className="display-title tabular text-accent text-8xl leading-none">{display}</p>
    </div>
  )
}

function SpeakersCard({ data }: { data: EventData }) {
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
  const active = index % speakers.length
  const speaker = speakers[active]

  return (
    <aside className="stage-card flex w-[560px] shrink-0 flex-col gap-6">
      <p className="micro-label">Nos intervenant·es…</p>

      <div className="relative min-h-[420px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={speaker.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ type: 'tween', duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-6"
          >
            <SpeakerAvatar speaker={speaker} className="stage-card-media h-[200px] w-[200px] text-5xl" />
            <div>
              <p className="display-title text-5xl">
                {speaker.firstName} {speaker.lastName}
              </p>
              <p className="mt-3 text-2xl text-paper-dim">
                {[speaker.title, speaker.company].filter(Boolean).join(' · ')}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {speakers.length > 1 && (
        <>
          <div className="stage-card-divider" />
          <div className="flex gap-4">
            {speakers.map((s, i) => (
              <span
                key={s.id}
                className={`h-5 w-5 transition-colors duration-300 ${
                  i === active ? 'bg-accent' : 'bg-paper/30'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </aside>
  )
}

export function AttenteMode({ data }: { data: EventData }) {
  const { event } = data
  const label = [event.subtitle, event.edition].filter(Boolean).join(' — ') || 'Table ronde'
  const date = formatDate(event.eventDate)

  return (
    <div className="relative z-2 h-full">
      <MovableCard
        as="section"
        slideKey="attente-title"
        className="stage-card absolute left-20 top-1/2 flex max-w-[860px] -translate-y-1/2 flex-col gap-6"
      >
        <div className="flex items-center gap-6 text-3xl">
          <span>{label}</span>
          {date && (
            <>
              <span className="text-accent">•</span>
              <span>{date}</span>
            </>
          )}
        </div>
        <h1 className="display-title text-8xl">{event.title}</h1>
        <Timer startAt={event.startAt} />
      </MovableCard>

      <MovableCard slideKey="attente-speakers" className="absolute right-20 top-1/2 -translate-y-1/2">
        <SpeakersCard data={data} />
      </MovableCard>
    </div>
  )
}
