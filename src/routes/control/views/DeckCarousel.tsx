// Carrousel unique de la régie (refonte) — fusionne l'ancien pager Slides/Gestion.
// Un seul carrousel horizontal = le deck d'écrans (Attente → intro → Dynamique →
// Outro). La slide « dynamique » affiche le dashboard de gestion ; les slides
// « fixes » affichent l'aperçu EP. Naviguer (drag sur le fond, tap des slides en
// peek, clavier ←/→) pilote directement l'EP via useControlState — toujours
// validé par la machine à états. Le bandeau bas a disparu.
import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import type { EventData } from '../../../realtime/eventData'
import type { ControlSession } from '../../../realtime/mutations'
import { setSpeakerHidden } from '../../../realtime/mutations'
import type { ControlState } from '../hooks/useControlState'
import { StagePreview } from './StagePreview'
import { buildDeck, currentDeckIndex, goToDeckSlide, slideToState, type DeckSlide } from './deck'

// Peek : les slides adjacentes dépassent et servent de poignées (tap = bordure).
const PEEK_PCT = 4

interface DeckCarouselProps {
  data: EventData
  control: ControlState
  session: ControlSession
  /** Rendu de la slide dynamique (le dashboard de gestion). */
  renderDynamique: () => React.ReactNode
  /** Ouvre la modale de position des cartes EP (refonte P3). */
  onEditCards?: () => void
}

export function DeckCarousel({
  data,
  control,
  session,
  renderDynamique,
  onEditCards,
}: DeckCarouselProps) {
  const deck = useMemo(() => buildDeck(data), [data])
  const index = currentDeckIndex(deck, control.screen)

  const goTo = (i: number) => {
    const slide = deck[i]
    if (slide) goToDeckSlide(slide, control)
  }

  // Navigation clavier / télécommande : ←/→ pilotent le carrousel (donc l'EP).
  // Lecture de la nav courante via une ref pour éviter toute closure périmée.
  const navRef = useRef<{ prev: number | null; next: number | null }>({ prev: null, next: null })
  navRef.current = {
    prev: deck[index - 1] ? index - 1 : null,
    next: deck[index + 1] ? index + 1 : null,
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.matches('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowLeft' && navRef.current.prev !== null) {
        e.preventDefault()
        goTo(navRef.current.prev)
      } else if (e.key === 'ArrowRight' && navRef.current.next !== null) {
        e.preventDefault()
        goTo(navRef.current.next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pager avec peek : chaque slide fait (100 - 2*PEEK) % ; les voisines dépassent
  // des deux côtés (poignées de swipe / clic en bordure).
  const slideWidthPct = 100 - 2 * PEEK_PCT
  const offsetPct = PEEK_PCT - index * slideWidthPct

  return (
    <motion.div
      className="flex min-h-0 flex-1 pt-3"
      animate={{ x: `${offsetPct}%` }}
      transition={{ type: 'tween', duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.12}
      onDragEnd={(_, info) => {
        if (info.offset.x < -80 && navRef.current.next !== null) goTo(navRef.current.next)
        else if (info.offset.x > 80 && navRef.current.prev !== null) goTo(navRef.current.prev)
      }}
    >
      {deck.map((slide, i) => (
        <div
          key={slide.key}
          style={{ width: `${slideWidthPct}%` }}
          className={`flex shrink-0 flex-col overflow-hidden px-3 pb-3 transition-opacity ${
            i === index ? '' : 'opacity-60'
          }`}
          onClick={() => {
            // Tap sur une slide en peek = y naviguer (clic en bordure d'écran).
            if (i !== index) goTo(i)
          }}
        >
          <div className={`flex min-h-0 flex-1 flex-col ${i === index ? '' : 'pointer-events-none'}`}>
            {slide.kind === 'dynamique' ? (
              <div className="relative flex min-h-0 flex-1 flex-col">
                {renderDynamique()}
                {onEditCards && (
                  <button
                    type="button"
                    onClick={onEditCards}
                    aria-label="Modifier la position des cards"
                    className="absolute right-3 bottom-3 z-20 flex size-[52px] items-center justify-center rounded-full bg-control-card text-control-accent shadow-md active:scale-95"
                  >
                    <DashboardIcon />
                  </button>
                )}
              </div>
            ) : (
              <FixeSlide
                slide={slide}
                data={data}
                control={control}
                session={session}
                onEditCards={onEditCards}
              />
            )}
          </div>
        </div>
      ))}
    </motion.div>
  )
}

// Slide fixe : aperçu EP plein cadre (raccord /screen) + bouton de position des
// cartes. Le masquage speaker (désistement) reste accessible sur la slide intro.
function FixeSlide({
  slide,
  data,
  control,
  session,
  onEditCards,
}: {
  slide: DeckSlide
  data: EventData
  control: ControlState
  session: ControlSession
  onEditCards?: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="relative w-full overflow-hidden rounded-2xl border border-black">
        <StagePreview
          data={data}
          state={slideToState(slide)}
          cardPositions={control.screen.cardPositions}
        />

        <p className="absolute top-3 left-3 z-30 rounded bg-black/40 px-2 py-1 font-mono text-[11px] tracking-[0.2em] text-white/80 uppercase backdrop-blur-sm">
          {slide.hint}
        </p>

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

      {onEditCards && (
        <button
          type="button"
          onClick={onEditCards}
          className="flex items-center gap-2 rounded-full bg-control-card px-6 py-2.5 font-mono text-base font-semibold text-control-accent shadow-sm active:scale-95"
        >
          <DashboardIcon />
          Modifier la position des cards
        </button>
      )}
    </div>
  )
}

// Icône « dashboard » (Material Symbols) — hérite la couleur via currentColor.
function DashboardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="24px"
      viewBox="0 -960 960 960"
      width="24px"
      fill="currentColor"
      aria-hidden
    >
      <path d="M520-600v-240h320v240H520ZM120-440v-400h320v400H120Zm400 320v-400h320v400H520Zm-400 0v-240h320v240H120Zm80-400h160v-240H200v240Zm400 320h160v-240H600v240Zm0-480h160v-80H600v80ZM200-200h160v-80H200v80Zm160-320Zm240-160Zm0 240ZM360-280Z" />
    </svg>
  )
}
