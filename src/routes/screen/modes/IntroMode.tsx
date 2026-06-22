// Mode INTRO complet (PRD 5.3) — slides web générées des données backoffice :
// asso (optionnelle) → titre → animateur → speakers individuels → grille récap.
// Pilotage par screen_state.intro_slide_index ; séquence partagée avec l'IR
// (src/shared/introSlides). Index borné : un speaker masqué en live raccourcit
// la séquence sans jamais sortir des bornes.
import { AnimatePresence, motion } from 'framer-motion'
import type { EventData } from '../../../realtime/eventData'
import { buildIntroSlides, clampIntroIndex, type IntroSlide } from '../../../shared/introSlides'
import { roleLabel } from '../../../shared/roleLabel'
import { assoContentSchema } from '../../../shared/schemas'
import type { ScreenState, Speaker } from '../../../shared/types'
import { SpeakerAvatar } from '../components/SpeakerAvatar'
import { MovableCard } from '../components/MovableCard'

const EASE = [0.22, 1, 0.36, 1] as const

function MicroHeader({ data }: { data: EventData }) {
  const { event } = data
  return (
    <p className="micro-label mb-8">
      {[event.subtitle, event.edition].filter(Boolean).join(' — ') || 'Table ronde'}
    </p>
  )
}

function AssoSlide({ data }: { data: EventData }) {
  const parsed = assoContentSchema.safeParse(data.event.assoContent)
  const content = parsed.success ? parsed.data : null
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <MovableCard slideKey="intro-asso" className="stage-card flex max-w-[75rem] flex-col items-center text-center">
        <p className="micro-label mb-8">Présenté par</p>
        <h1 className="display-title text-8xl">{content?.name ?? ''}</h1>
        {content?.description && (
          <p className="mt-8 max-w-[56.25rem] text-2xl leading-relaxed text-paper-dim">
            {content.description}
          </p>
        )}
      </MovableCard>
    </div>
  )
}

function TitleSlide({ data }: { data: EventData }) {
  const { event } = data
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <MovableCard slideKey="intro-title" className="stage-card flex max-w-[81.25rem] flex-col items-center text-center">
        <MicroHeader data={data} />
        <h1 className="display-title text-8xl">{event.title}</h1>
        {event.eventDate && (
          <p className="micro-label mt-10">
            {new Date(event.eventDate).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </MovableCard>
    </div>
  )
}

function PersonSlide({ speaker, role }: { speaker: Speaker; role: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-24">
      <MovableCard slideKey={`intro-person-${speaker.id}`} className="stage-card flex items-center gap-16">
        <SpeakerAvatar speaker={speaker} className="stage-card-media h-[26.25rem] w-[21.25rem] text-8xl" />
        <div className="max-w-[42.5rem]">
        <p className="micro-label mb-6 text-accent">{role}</p>
        <h1 className="display-title text-7xl">
          {speaker.firstName}
          <br />
          {speaker.lastName}
        </h1>
        <p className="mt-6 font-mono text-lg text-paper-dim">
          {[speaker.title, speaker.company].filter(Boolean).join(' · ')}
        </p>
        {speaker.bio && (
          <p className="mt-8 max-w-[40rem] text-2xl leading-relaxed text-paper-dim">
            {speaker.bio}
          </p>
        )}
        </div>
      </MovableCard>
    </div>
  )
}

function GridSlide({ data }: { data: EventData }) {
  const panel = data.speakers.filter((s) => !s.isHost && !s.hidden)
  const cols = panel.length <= 3 ? panel.length : panel.length === 4 ? 4 : 3
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-14">
      <MovableCard slideKey="intro-grid" className="flex flex-col items-center gap-14">
      <p className="micro-label">Nos intervenant·es</p>
      <div
        className="grid gap-10"
        style={{ gridTemplateColumns: `repeat(${Math.max(cols, 1)}, minmax(0, 1fr))` }}
      >
        {panel.map((speaker, i) => (
          <motion.div
            key={speaker.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.4, ease: EASE }}
            className="stage-card flex w-[18.125rem] flex-col items-center gap-4 text-center"
          >
            <SpeakerAvatar speaker={speaker} className="stage-card-media h-32 w-32 text-5xl" />
            <div>
              <p className="display-title text-2xl">
                {speaker.firstName} {speaker.lastName}
              </p>
              <p className="mt-1.5 font-mono text-xs text-paper-dim">
                {[speaker.title, speaker.company].filter(Boolean).join(' · ')}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
      </MovableCard>
    </div>
  )
}

function SlideContent({ slide, data }: { slide: IntroSlide; data: EventData }) {
  switch (slide.kind) {
    case 'asso':
      return <AssoSlide data={data} />
    case 'title':
      return <TitleSlide data={data} />
    case 'host':
      return slide.speaker ? <PersonSlide speaker={slide.speaker} role={roleLabel(true, slide.speaker.gender)} /> : null
    case 'speaker':
      return slide.speaker ? <PersonSlide speaker={slide.speaker} role={roleLabel(false, slide.speaker.gender)} /> : null
    case 'grid':
      return <GridSlide data={data} />
  }
}

export function IntroMode({ data, state }: { data: EventData; state: ScreenState }) {
  const slides = buildIntroSlides(data.event, data.speakers)
  if (slides.length === 0) return null
  const index = clampIntroIndex(state.introSlideIndex, slides.length)
  const slide = slides[index]

  return (
    <div className="relative z-2 flex h-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${slide.kind}-${slide.speaker?.id ?? index}`}
          initial={{ opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -48 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="min-w-0 flex-1"
        >
          <SlideContent slide={slide} data={data} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
