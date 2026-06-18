// Vue Slides (gauche) — carrousel de présentation (maquette iPad 15) :
// grande carte-preview de la slide EP courante au centre, adjacentes en peek.
// Séquence unifiée : Attente → slides intro → contenus dynamiques → Outro.
// Naviguer (flèches, tap carte adjacente, swipe) pilote directement l'EP via
// useControlState — toujours validé par la machine à états.
import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { EventData } from '../../../realtime/eventData'
import type { ControlSession } from '../../../realtime/mutations'
import { setSpeakerHidden } from '../../../realtime/mutations'
import { buildIntroSlides, clampIntroIndex, type IntroSlide } from '../../../shared/introSlides'
import type { Content, ScreenState } from '../../../shared/types'
import type { ControlState } from '../hooks/useControlState'
import { StagePreview } from './StagePreview'

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

/** État EP synthétique pour le rendu d'aperçu d'une slide du deck.
 *  `contentStep` positionne l'aperçu d'un deck Google Slides (0 pour les peeks). */
function slideToState(slide: DeckSlide, contentStep = 0): ScreenState {
  const base: ScreenState = {
    mode: 'attente',
    introSlideIndex: 0,
    mainContentId: null,
    contentStep: 0,
    overlay: null,
    speakersBannerVisible: true,
    qrVisible: false,
    timerStartedAt: null,
  }
  switch (slide.kind) {
    case 'attente':
      return base
    case 'intro':
      return { ...base, mode: 'intro', introSlideIndex: slide.introIndex }
    case 'dynamique':
      return { ...base, mode: 'dynamique' }
    case 'content':
      return { ...base, mode: 'dynamique', mainContentId: slide.content.id, contentStep }
    case 'outro':
      return { ...base, mode: 'outro' }
  }
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
  active,
}: {
  data: EventData
  control: ControlState
  session: ControlSession
  /** Vue affichée dans le pager — n'écoute le clavier que si active. */
  active: boolean
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

  // Navigation clavier / télécommande : ←/→ pilotent le carrousel (donc l'EP).
  // Le listener lit la nav courante via une ref (jamais de closure périmée sur
  // goTo/deck/control) ; il ne se ré-enregistre qu'au changement de vue active.
  const navRef = useRef<{ goPrev: (() => void) | null; goNext: (() => void) | null }>({
    goPrev: null,
    goNext: null,
  })
  navRef.current = {
    goPrev: prev ? () => goTo(index - 1) : null,
    goNext: next ? () => goTo(index + 1) : null,
  }
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.matches('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowLeft' && navRef.current.goPrev) {
        e.preventDefault()
        navRef.current.goPrev()
      } else if (e.key === 'ArrowRight' && navRef.current.goNext) {
        e.preventDefault()
        navRef.current.goNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Carrousel : précédente | courante (grande) | suivante (maquette 15) */}
      <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden">
        {prev && (
          <PeekCard side="left" slide={prev} data={data} onTap={() => goTo(index - 1)} />
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
              {current && (
                <SlidePreview slide={current} data={data} session={session} control={control} />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {next && (
          <PeekCard side="right" slide={next} data={data} onTap={() => goTo(index + 1)} />
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

// Carte adjacente : véritable aperçu EP réduit (raccord avec /screen), tronqué
// par le débordement du carrousel pour l'effet « peek ».
function PeekCard({
  side,
  slide,
  data,
  onTap,
}: {
  side: 'left' | 'right'
  slide: DeckSlide
  data: EventData
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`absolute top-1/2 z-0 w-[20%] -translate-y-1/2 overflow-hidden rounded-2xl opacity-70 shadow-sm transition active:scale-95 ${
        side === 'left' ? '-left-[8%]' : '-right-[8%]'
      }`}
      aria-label={slide.label}
    >
      <StagePreview data={data} state={slideToState(slide)} />
    </button>
  )
}

// Carte courante : aperçu EP plein cadre, identique au rendu /screen. Le libellé
// de section et le bouton de masquage sont superposés (l'aperçu, display-only,
// laisse passer swipe/tap du carrousel).
function SlidePreview({
  slide,
  data,
  session,
  control,
}: {
  slide: DeckSlide
  data: EventData
  session: ControlSession
  control: ControlState
}) {
  // Deck Google Slides actif : la carte reflète la slide interne courante.
  const isGslides = slide.kind === 'content' && slide.content.kind === 'embed_gslides'
  const step = control.screen.contentStep

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-md">
      <StagePreview data={data} state={slideToState(slide, step)} />

      <p className="absolute top-3 left-3 z-30 rounded bg-black/40 px-2 py-1 font-mono text-[11px] tracking-[0.2em] text-white/80 uppercase backdrop-blur-sm">
        {slide.hint}
      </p>

      {/* Navigation interne du deck (PRD 5.4.1) : avancer/reculer dans les slides
          du contenu encapsulé. Pas de borne haute — total inconnu sans l'API Google.
          ponytail: ◀ borné à 0, ▶ libre ; ajouter un compteur de slides si besoin. */}
      {isGslides && (
        <div className="absolute right-3 bottom-3 z-30 flex items-center gap-2">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => control.setContentStep(step - 1)}
            className="rounded bg-black/40 px-3 py-1 font-mono text-sm text-white/80 backdrop-blur-sm active:scale-95 disabled:opacity-30"
            aria-label="Slide précédente du contenu"
          >
            ◀
          </button>
          <span className="rounded bg-black/40 px-2 py-1 font-mono text-[11px] text-white/80 backdrop-blur-sm">
            {step + 1}
          </span>
          <button
            type="button"
            onClick={() => control.setContentStep(step + 1)}
            className="rounded bg-black/40 px-3 py-1 font-mono text-sm text-white/80 backdrop-blur-sm active:scale-95"
            aria-label="Slide suivante du contenu"
          >
            ▶
          </button>
        </div>
      )}

      {/* Masquage speaker en live (désistement) directement sur la carte */}
      {slide.kind === 'intro' && slide.intro.kind === 'speaker' && slide.intro.speaker && (
        <button
          type="button"
          onClick={() =>
            void setSpeakerHidden(session, slide.intro.speaker!.id, true).catch(() => undefined)
          }
          className="absolute right-3 bottom-3 z-30 rounded bg-black/40 px-2 py-1 font-mono text-[11px] text-white/80 backdrop-blur-sm active:scale-95"
        >
          Masquer ce speaker
        </button>
      )}
    </div>
  )
}
