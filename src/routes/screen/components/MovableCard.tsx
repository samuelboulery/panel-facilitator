// Carte de scène repositionnable (drag & drop IR → EP).
// Position stockée = coin de la carte en unités scène (1920×1080), MAIS l'axe
// désigné par `edge` est mesuré depuis ce bord (edge='bottom' → y = distance du
// bas, etc.). L'axe ancré reste collé à son bord lors des variations de taille
// (timer, rotation speakers) ; l'autre axe garde le coin haut/gauche. `edge` est
// la dernière bordure « plaquée » pendant le drag (sticky tant qu'aucune nouvelle
// n'est touchée) ; côté IR un liseré de 2px marque ce bord de référence.
// À chaque rendu / changement de taille, on reconstruit le coin haut-gauche puis
// le `translate` qui l'y pose : robuste aux centrages (-translate-y-1/2, flex
// justify-center) et aux variations de taille.
// `translate` (et non `transform`) compose avec les transforms Tailwind existants.
// Mesure via getBoundingClientRect → indépendant du scale de l'aperçu IR.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'

import type { CardEdge, CardPosition as CardPos } from '../../../shared/types'

interface CardPositionCtx {
  positions: Record<string, CardPos>
  /** Présent uniquement côté IR → active le drag. */
  onDrag?: (key: string, pos: CardPos) => void
  /** Surface scène (1920×1080 côté EP, boîte scalée côté aperçu IR). */
  stageRef?: RefObject<HTMLElement | null>
  /** Échelle courante de la scène (aperçu IR). Change 0→réel après mesure du
   *  conteneur : `transform` n'émet pas de ResizeObserver, donc on re-ancre
   *  explicitement via cette dépendance. Absent côté EP (scale=1 dès le 1er rendu). */
  stageScale?: number
}

const Ctx = createContext<CardPositionCtx>({ positions: {} })

export function CardPositionProvider({
  value,
  children,
}: {
  value: CardPositionCtx
  children: ReactNode
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

const STAGE_W = 1920
const STAGE_H = 1080
const MARGIN = 64 // marge de sécurité sur le bord (unités scène)
const TOUCH = 1 // tolérance (unités scène) : carte « plaquée » contre un bord

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

// Liseré de référence (côté IR) : 2px inset sur le bord ancré.
const EDGE_SHADOW: Record<CardEdge, string> = {
  top: 'inset 0 2px 0 0 var(--color-accent, #38bdf8)',
  bottom: 'inset 0 -2px 0 0 var(--color-accent, #38bdf8)',
  left: 'inset 2px 0 0 0 var(--color-accent, #38bdf8)',
  right: 'inset -2px 0 0 0 var(--color-accent, #38bdf8)',
}

interface MovableCardProps {
  slideKey: string
  as?: ElementType
  className?: string
  children: ReactNode
}

export function MovableCard({ slideKey, as: Tag = 'div', className, children }: MovableCardProps) {
  const { positions, onDrag, stageRef, stageScale } = useContext(Ctx)
  const stored = positions[slideKey] as CardPos | undefined
  const storedRef = useRef(stored)
  storedRef.current = stored

  const elRef = useRef<HTMLElement>(null)
  // `translate` courant (unités scène) appliqué à la carte — pilote le style.
  const [translate, setTranslate] = useState<CardPos>({ x: 0, y: 0 })
  const translateRef = useRef(translate)
  translateRef.current = translate
  const dragging = useRef(false)

  // Mesure : position « naturelle » (translate=0) du coin haut-gauche, taille et
  // scale, le tout en unités scène. scale = largeur rendue / largeur layout :
  // côté aperçu IR la scène est transformée (scale<1), côté EP non (scale=1).
  const measure = useCallback(() => {
    const stage = stageRef?.current
    const el = elRef.current
    if (!stage || !el) return null
    const s = stage.getBoundingClientRect()
    const c = el.getBoundingClientRect()
    const scale = stage.offsetWidth ? s.width / stage.offsetWidth : 1
    // Scène pas encore mesurée (aperçu IR : scale(0) au 1er rendu) → on diffère.
    // Sans ce garde, division par 0 ⇒ translate = NaN, irrécupérable (measure
    // soustrait le translate courant à chaque passe).
    if (!Number.isFinite(scale) || scale <= 0) return null
    const t = translateRef.current
    return {
      natX: (c.left - s.left) / scale - t.x,
      natY: (c.top - s.top) / scale - t.y,
      w: c.width / scale,
      h: c.height / scale,
      scale,
    }
  }, [stageRef])

  // (Re)pose la carte à sa position stockée. Idempotent : `nat` est invariant du
  // translate courant, donc converge en une passe (pas de boucle de rendu).
  const anchor = useCallback(() => {
    const pos = storedRef.current
    if (!pos || dragging.current) return
    const m = measure()
    if (!m) return
    // Coin haut-gauche cible : pour l'axe ancré à un bord « loin » (bottom/right),
    // on dérive le coin depuis la taille courante → ce bord reste fixe quand la
    // carte change de taille. L'autre axe garde la coordonnée stockée telle quelle.
    const edge = pos.edge ?? 'top'
    const cornerX = edge === 'right' ? STAGE_W - pos.x - m.w : pos.x
    const cornerY = edge === 'bottom' ? STAGE_H - pos.y - m.h : pos.y
    const next = { x: cornerX - m.natX, y: cornerY - m.natY }
    setTranslate((prev) =>
      Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5 ? prev : next,
    )
  }, [measure])

  // Repositionne au montage, quand la position stockée change, et quand
  // l'échelle de la scène devient valide (aperçu IR : 0→réel sans ResizeObserver).
  useLayoutEffect(anchor, [anchor, stored?.x, stored?.y, stageScale])

  // Variations de taille (timer, rotation speakers) ou de scale (resize aperçu) :
  // recalcule pour garder le coin haut-gauche fixe.
  useEffect(() => {
    const el = elRef.current
    const stage = stageRef?.current
    if (!el) return
    const obs = new ResizeObserver(() => anchor())
    obs.observe(el)
    if (stage) obs.observe(stage)
    return () => obs.disconnect()
  }, [anchor, stageRef])

  const drag = useRef<{
    px: number
    py: number
    scale: number
    natX: number
    natY: number
    w: number
    h: number
    tx: number
    ty: number
    minX: number
    maxX: number
    minY: number
    maxY: number
  } | null>(null)
  // Bordure de référence courante (sticky) : suit la dernière bordure plaquée
  // pendant le drag ; conserve celle déjà stockée si aucune n'est touchée.
  const dragEdge = useRef<CardEdge>('top')

  const draggable = Boolean(onDrag)

  const handleDown = (e: PointerEvent) => {
    if (!onDrag) return
    const m = measure()
    if (!m) return
    dragging.current = true
    dragEdge.current = storedRef.current?.edge ?? 'top'
    const t = translateRef.current
    // Bornes de translate gardant le coin dans [MARGIN, scène - MARGIN - taille].
    drag.current = {
      px: e.clientX,
      py: e.clientY,
      scale: m.scale,
      natX: m.natX,
      natY: m.natY,
      w: m.w,
      h: m.h,
      tx: t.x,
      ty: t.y,
      minX: MARGIN - m.natX,
      maxX: STAGE_W - MARGIN - m.w - m.natX,
      minY: MARGIN - m.natY,
      maxY: STAGE_H - MARGIN - m.h - m.natY,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
  }

  const handleMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const tx = clamp(d.tx + (e.clientX - d.px) / d.scale, Math.min(d.minX, d.maxX), Math.max(d.minX, d.maxX))
    const ty = clamp(d.ty + (e.clientY - d.py) / d.scale, Math.min(d.minY, d.maxY), Math.max(d.minY, d.maxY))
    // Coin haut-gauche courant → écarts aux 4 bords. Une carte « plaquée »
    // (gap ≤ TOUCH) redéfinit la bordure de référence ; arbitrage par l'axe du
    // déplacement dominant si deux bords sont touchés simultanément (coin).
    const cornerX = d.natX + tx
    const cornerY = d.natY + ty
    const touchLeft = cornerX - MARGIN <= TOUCH
    const touchRight = STAGE_W - MARGIN - (cornerX + d.w) <= TOUCH
    const touchTop = cornerY - MARGIN <= TOUCH
    const touchBottom = STAGE_H - MARGIN - (cornerY + d.h) <= TOUCH
    const horiz = touchLeft || touchRight
    const vert = touchTop || touchBottom
    if (horiz || vert) {
      const adx = Math.abs(e.clientX - d.px)
      const ady = Math.abs(e.clientY - d.py)
      if (horiz && (!vert || adx >= ady)) dragEdge.current = touchLeft ? 'left' : 'right'
      else dragEdge.current = touchTop ? 'top' : 'bottom'
    }
    setTranslate({ x: tx, y: ty })
  }

  const handleUp = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    dragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    const t = translateRef.current
    const edge = dragEdge.current
    // Coin haut-gauche absolu (unités scène) = naturel + translate. On stocke
    // l'axe ancré en distance au bord de référence (bottom/right), l'autre tel quel.
    const cornerX = d.natX + t.x
    const cornerY = d.natY + t.y
    if (onDrag) {
      onDrag(slideKey, {
        edge,
        x: edge === 'right' ? STAGE_W - (cornerX + d.w) : cornerX,
        y: edge === 'bottom' ? STAGE_H - (cornerY + d.h) : cornerY,
      })
    }
  }

  const style: CSSProperties = {
    translate: `${translate.x}px ${translate.y}px`,
    // L'aperçu IR est pointer-events:none ; on réactive le pointeur sur les
    // cartes draggables uniquement, et neutralise le scroll tactile.
    ...(draggable && { pointerEvents: 'auto', touchAction: 'none', cursor: 'grab' }),
    // Liseré indiquant le bord de référence — IR uniquement (jamais sur l'EP).
    ...(draggable && stored?.edge && { boxShadow: EDGE_SHADOW[stored.edge] }),
  }

  return (
    <Tag
      ref={elRef as Ref<HTMLElement>}
      className={className}
      style={style}
      {...(draggable && {
        onPointerDown: handleDown,
        onPointerMove: handleMove,
        onPointerUp: handleUp,
      })}
    >
      {children}
    </Tag>
  )
}
