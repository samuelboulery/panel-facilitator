// Vue Slides (gauche) — carrousel de présentation (maquette iPad 15) :
// grande carte-preview de la slide EP courante au centre, adjacentes en peek.
// Séquence : Attente → slides intro → Dynamique → Outro. Les contenus projetés
// (embeds/médias) sont pilotés depuis la vue Gestion (card Contenus), plus dans
// le carrousel. Naviguer (flèches, tap carte adjacente, swipe) pilote directement
// l'EP via useControlState — toujours validé par la machine à états.
import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { EventData } from '../../../realtime/eventData'
import type { ControlSession } from '../../../realtime/mutations'
import { setSpeakerHidden } from '../../../realtime/mutations'
import type { CardPosition } from '../../../shared/types'
import type { ControlState } from '../hooks/useControlState'
import { StagePreview } from './StagePreview'
import { buildDeck, currentDeckIndex, goToDeckSlide, slideToState, type DeckSlide } from './deck'

export function SlidesView({
  data,
  control,
  session,
  active,
  editLayout,
  onToggleEditLayout,
}: {
  data: EventData
  control: ControlState
  session: ControlSession
  /** Vue affichée dans le pager — n'écoute le clavier que si active. */
  active: boolean
  /** Édition des positions de cartes (piloté par ControlShell — gèle aussi le pager). */
  editLayout: boolean
  onToggleEditLayout: () => void
}) {
  const deck = useMemo(() => buildDeck(data), [data])
  const index = currentDeckIndex(deck, control.screen)

  const goTo = (i: number) => {
    const slide = deck[i]
    if (slide) goToDeckSlide(slide, control)
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
      {/* Bascule édition des positions de cartes (drag) vs navigation (swipe) */}
      <div className="flex justify-end px-2">
        <button
          type="button"
          onClick={onToggleEditLayout}
          aria-pressed={editLayout}
          className={`rounded-lg px-3 py-1.5 font-mono text-xs transition active:scale-95 ${
            editLayout ? 'bg-accent text-white' : 'bg-control-card text-control-dim'
          }`}
        >
          {editLayout ? '✓ Édition des positions' : 'Déplacer les cartes'}
        </button>
      </div>

      {/* Carrousel : précédente | courante (grande) | suivante (maquette 15) */}
      <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden">
        {prev && (
          <PeekCard
            side="left"
            slide={prev}
            data={data}
            cardPositions={control.screen.cardPositions}
            onTap={() => goTo(index - 1)}
          />
        )}

        <motion.div
          className="z-10 w-[74%]"
          // Édition active : swipe horizontal coupé pour ne pas changer de slide en déplaçant une carte.
          drag={editLayout ? false : 'x'}
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
                <SlidePreview
                  slide={current}
                  data={data}
                  session={session}
                  control={control}
                  editable={editLayout}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {next && (
          <PeekCard
            side="right"
            slide={next}
            data={data}
            cardPositions={control.screen.cardPositions}
            onTap={() => goTo(index + 1)}
          />
        )}
      </div>

      {/* Position courante — la navigation se fait au swipe, aux cartes en peek,
          au clavier, ou via les flèches Slides de la barre d'état. */}
      <div className="flex justify-center px-2 pb-1">
        <span className="font-mono text-xs text-control-dim">
          {index + 1} / {deck.length} — {current?.hint}
        </span>
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
  cardPositions,
  onTap,
}: {
  side: 'left' | 'right'
  slide: DeckSlide
  data: EventData
  cardPositions: Record<string, CardPosition>
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`absolute top-1/2 z-0 w-[20%] -translate-y-1/2 overflow-hidden rounded-2xl border border-black opacity-70 transition active:scale-95 ${
        side === 'left' ? '-left-[8%]' : '-right-[8%]'
      }`}
      aria-label={slide.label}
    >
      <StagePreview data={data} state={slideToState(slide)} cardPositions={cardPositions} />
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
  editable,
}: {
  slide: DeckSlide
  data: EventData
  session: ControlSession
  control: ControlState
  editable: boolean
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-black">
      <StagePreview
        data={data}
        state={slideToState(slide)}
        cardPositions={control.screen.cardPositions}
        onCardDrag={editable ? control.setCardPosition : undefined}
      />

      <p className="absolute top-3 left-3 z-30 rounded bg-black/40 px-2 py-1 font-mono text-[11px] tracking-[0.2em] text-white/80 uppercase backdrop-blur-sm">
        {slide.hint}
      </p>

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
