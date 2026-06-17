// Vue Slides (gauche) — carrousel de présentation (maquette iPad 15) :
// grande carte-preview de la slide EP courante au centre, adjacentes en peek.
// Séquence unifiée : Attente → slides intro → contenus dynamiques → Outro.
// Naviguer (flèches, tap carte adjacente, swipe) pilote directement l'EP via
// useControlState — toujours validé par la machine à états.
import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { EventData } from '../../../realtime/eventData'
import type { ControlSession } from '../../../realtime/mutations'
import { setSpeakerHidden } from '../../../realtime/mutations'
import { buildIntroSlides, clampIntroIndex, type IntroSlide } from '../../../shared/introSlides'
import type { Content } from '../../../shared/types'
import type { ControlState } from '../hooks/useControlState'

type DeckSlide =
  | { kind: 'attente'; key: string; label: string; hint: string }
  | { kind: 'intro'; key: string; label: string; hint: string; introIndex: number; intro: IntroSlide }
  | { kind: 'dynamique'; key: string; label: string; hint: string }
  | { kind: 'content'; key: string; label: string; hint: string; content: Content }
  | { kind: 'outro'; key: string; label: string; hint: string }

function buildDeck(data: EventData): DeckSlide[] {
  const intro = buildIntroSlides(data.event, data.speakers)
  return [
    { kind: 'attente', key: 'attente', label: 'Attente', hint: 'Timer · speakers · sponsors' },
    ...intro.map(
      (slide, i): DeckSlide => ({
        kind: 'intro',
        key: `intro-${slide.kind}-${slide.speaker?.id ?? i}`,
        label: slide.label,
        hint: 'Intro',
        introIndex: i,
        intro: slide,
      }),
    ),
    // Slide dynamique principale — toujours présente (cœur de la table ronde,
    // PRD 5.4). Sans embed sélectionné : scène au repos (titre de l'événement).
    { kind: 'dynamique', key: 'dynamique', label: data.event.title, hint: 'Dynamique' },
    ...data.contents.map(
      (content): DeckSlide => ({
        kind: 'content',
        key: `content-${content.id}`,
        label: content.label,
        hint: `Dynamique · ${content.kind.replace('embed_', '')}`,
        content,
      }),
    ),
    { kind: 'outro', key: 'outro', label: 'Outro', hint: 'Remerciements · sponsors' },
  ]
}

/** Position courante dans le deck, dérivée de l'état EP. */
function currentDeckIndex(deck: DeckSlide[], control: ControlState): number {
  const { screen } = control
  switch (screen.mode) {
    case 'attente':
      return 0
    case 'intro': {
      const introSlides = deck.filter((s) => s.kind === 'intro')
      const idx = clampIntroIndex(screen.introSlideIndex, introSlides.length)
      const slide = introSlides[idx]
      return slide ? deck.indexOf(slide) : 0
    }
    case 'dynamique': {
      const match = deck.findIndex(
        (s) => s.kind === 'content' && s.content.id === screen.mainContentId,
      )
      if (match !== -1) return match
      // Aucun embed sélectionné : se placer sur la slide dynamique principale.
      const main = deck.findIndex((s) => s.kind === 'dynamique')
      return main !== -1 ? main : deck.length - 1
    }
    case 'outro':
      return deck.length - 1
  }
}

export function SlidesView({
  data,
  control,
  session,
}: {
  data: EventData
  control: ControlState
  session: ControlSession
}) {
  const deck = useMemo(() => buildDeck(data), [data])
  const index = currentDeckIndex(deck, control)

  const goTo = (i: number) => {
    const slide = deck[i]
    if (!slide) return
    switch (slide.kind) {
      case 'attente':
        control.setMode('attente')
        break
      case 'intro':
        // Mode + index dans un seul RPC — pas de course serveur.
        control.goToIntroSlide(slide.introIndex)
        break
      case 'dynamique':
        // Mode dynamique sans embed : scène au repos (titre événement).
        if (control.screen.mode !== 'dynamique') control.setMode('dynamique')
        control.setMainContent(null)
        break
      case 'content':
        if (control.screen.mode !== 'dynamique') control.setMode('dynamique')
        control.setMainContent(slide.content.id)
        break
      case 'outro':
        control.setMode('outro')
        break
    }
  }

  const current = deck[index]
  const prev = deck[index - 1]
  const next = deck[index + 1]

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Carrousel : précédente | courante (grande) | suivante (maquette 15) */}
      <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden">
        {prev && (
          <PeekCard side="left" slide={prev} onTap={() => goTo(index - 1)} />
        )}

        <motion.div
          className="z-10 w-[74%]"
          drag="x"
          dragSnapToOrigin
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60 && next) goTo(index + 1)
            else if (info.offset.x > 60 && prev) goTo(index - 1)
          }}
        >
          <AnimatePresence mode="popLayout">
            <motion.div
              key={current?.key}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {current && <SlidePreview slide={current} large session={session} />}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {next && (
          <PeekCard side="right" slide={next} onTap={() => goTo(index + 1)} />
        )}
      </div>

      {/* Position + navigation */}
      <div className="flex items-center justify-between px-2 pb-1">
        <button
          type="button"
          disabled={!prev}
          onClick={() => goTo(index - 1)}
          className="rounded-xl bg-control-card px-6 py-2.5 text-lg font-semibold shadow-sm active:scale-95 disabled:opacity-30"
        >
          ←
        </button>
        <span className="font-mono text-xs text-control-dim">
          {index + 1} / {deck.length} — {current?.hint}
        </span>
        <button
          type="button"
          disabled={!next}
          onClick={() => goTo(index + 1)}
          className="rounded-xl bg-control-ink px-6 py-2.5 text-lg font-semibold text-white shadow-sm active:scale-95 disabled:opacity-30"
        >
          →
        </button>
      </div>

      {/* Speakers masqués (désistement) : restauration en un tap */}
      {data.speakers.some((s) => s.hidden) && (
        <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
          <span className="font-mono text-xs text-control-dim">Masqué·es :</span>
          {data.speakers
            .filter((s) => s.hidden)
            .map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void setSpeakerHidden(session, s.id, false).catch(() => undefined)}
                className="rounded-lg bg-control-card px-2.5 py-1 font-mono text-xs text-control-dim line-through active:scale-95"
              >
                {s.firstName} {s.lastName}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

function PeekCard({
  side,
  slide,
  onTap,
}: {
  side: 'left' | 'right'
  slide: DeckSlide
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`absolute top-1/2 z-0 aspect-video w-[20%] -translate-y-1/2 overflow-hidden rounded-2xl bg-control-card opacity-70 shadow-sm transition active:scale-95 ${
        side === 'left' ? '-left-[8%]' : '-right-[8%]'
      }`}
      aria-label={slide.label}
    >
      <span className="block truncate px-3 pt-3 text-left font-mono text-[10px] text-control-dim uppercase">
        {slide.label}
      </span>
    </button>
  )
}

function SlidePreview({
  slide,
  large,
  session,
}: {
  slide: DeckSlide
  large?: boolean
  session: ControlSession
}) {
  return (
    <div
      className={`flex aspect-video w-full flex-col justify-between rounded-2xl bg-control-card p-5 shadow-md ${
        large ? '' : 'pointer-events-none'
      }`}
    >
      <p className="font-mono text-[11px] tracking-[0.2em] text-control-dim uppercase">
        {slide.hint}
      </p>

      <div className="flex flex-1 items-center justify-center px-4 text-center">
        {slide.kind === 'intro' && slide.intro.speaker?.photoUrl ? (
          <div className="flex items-center gap-4">
            <img
              src={slide.intro.speaker.photoUrl}
              alt=""
              className="h-16 w-16 rounded-xl object-cover"
            />
            <p className="text-xl font-semibold">{slide.label}</p>
          </div>
        ) : (
          <p className="text-xl font-semibold">{slide.label}</p>
        )}
      </div>

      {/* Masquage speaker en live (désistement) directement sur la carte */}
      {slide.kind === 'intro' && slide.intro.kind === 'speaker' && slide.intro.speaker && (
        <button
          type="button"
          onClick={() =>
            void setSpeakerHidden(session, slide.intro.speaker!.id, true).catch(() => undefined)
          }
          className="self-end rounded px-2 py-1 font-mono text-[11px] text-control-dim active:scale-95"
        >
          Masquer ce speaker
        </button>
      )}
    </div>
  )
}
