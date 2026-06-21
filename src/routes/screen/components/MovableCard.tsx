// Carte de scène repositionnable (drag & drop IR → EP).
// Position stockée = ancrée par coin : `anchorX` (left/right) + `anchorY`
// (top/bottom) désignent les deux bords d'ancre ; `x`/`y` sont les distances à ces
// bords (anchorX='right' → x = distance au bord droit). Chaque axe reste collé à
// son bord lors des variations de taille (timer, rotation speakers). Les ancres
// suivent la dernière extrémité plaquée pendant le drag, par axe (sticky tant
// qu'aucune nouvelle n'est touchée) ; côté IR un liseré de 2px marque les 2 bords.
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
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'

import type { CardAnchorX, CardAnchorY, CardPosition as CardPos } from '../../../shared/types'

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

const MARGIN = 64 // marge de sécurité sur le bord (unités scène)
const TOUCH = 1 // tolérance (unités scène) : carte « plaquée » contre un bord

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

// Liseré de référence (côté IR) : 8px outset sur chaque bord ancré.
// Axe `center` : pas de bar outset → trait médian rendu en overlay (cf. render).
const SHADOW_X: Record<'left' | 'right', string> = {
  left: '-8px 0 0 0 var(--color-accent, #38bdf8)',
  right: '8px 0 0 0 var(--color-accent, #38bdf8)',
}
const SHADOW_Y: Record<'top' | 'bottom', string> = {
  top: '0 -8px 0 0 var(--color-accent, #38bdf8)',
  bottom: '0 8px 0 0 var(--color-accent, #38bdf8)',
}

// Trait médian (overlay) marquant un axe centré, côté IR.
const CENTER_LINE_X: CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: '50%',
  width: 2,
  marginLeft: -1,
  background: 'var(--color-accent, #38bdf8)',
  pointerEvents: 'none',
}
const CENTER_LINE_Y: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '50%',
  height: 2,
  marginTop: -1,
  background: 'var(--color-accent, #38bdf8)',
  pointerEvents: 'none',
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
  // Simple offset {x,y} (pas une position ancrée) : pas d'anchorX/anchorY.
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const translateRef = useRef(translate)
  translateRef.current = translate
  const dragging = useRef(false)

  // Mesure : position « naturelle » (translate=0) du coin haut-gauche, taille,
  // scale et dimensions de la scène, le tout en unités scène. scale = largeur
  // rendue / largeur layout : côté aperçu IR la scène est transformée (scale<1),
  // côté EP non (scale=1). stageW/stageH = taille réelle (layout) de la scène :
  // l'EP est fluide (100vw/100vh) donc ≠ 1920×1080 → ne JAMAIS coder en dur.
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
      stageW: stage.offsetWidth,
      stageH: stage.offsetHeight,
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
    // Coin haut-gauche cible : pour un axe ancré à un bord « loin » (bottom/right),
    // on dérive le coin depuis la taille courante → ce bord reste fixe quand la
    // carte change de taille. Chaque axe est indépendant.
    const cornerX =
      pos.anchorX === 'right'
        ? m.stageW - pos.x - m.w
        : pos.anchorX === 'center'
          ? (m.stageW - m.w) / 2 + pos.x
          : pos.x
    const cornerY =
      pos.anchorY === 'bottom'
        ? m.stageH - pos.y - m.h
        : pos.anchorY === 'center'
          ? (m.stageH - m.h) / 2 + pos.y
          : pos.y
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
    stageW: number
    stageH: number
    tx: number
    ty: number
    minX: number
    maxX: number
    minY: number
    maxY: number
  } | null>(null)
  // Bords d'ancre courants (sticky, un par axe) : suivent la dernière extrémité
  // plaquée pendant le drag ; conservent celle déjà stockée si aucune touchée.
  const dragAnchorX = useRef<CardAnchorX>('left')
  const dragAnchorY = useRef<CardAnchorY>('top')

  const draggable = Boolean(onDrag)

  const handleDown = (e: PointerEvent) => {
    if (!onDrag) return
    const m = measure()
    if (!m) return
    dragging.current = true
    dragAnchorX.current = storedRef.current?.anchorX ?? 'left'
    dragAnchorY.current = storedRef.current?.anchorY ?? 'top'
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
      stageW: m.stageW,
      stageH: m.stageH,
      tx: t.x,
      ty: t.y,
      minX: MARGIN - m.natX,
      maxX: m.stageW - MARGIN - m.w - m.natX,
      minY: MARGIN - m.natY,
      maxY: m.stageH - MARGIN - m.h - m.natY,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
  }

  const handleMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const tx = clamp(d.tx + (e.clientX - d.px) / d.scale, Math.min(d.minX, d.maxX), Math.max(d.minX, d.maxX))
    const ty = clamp(d.ty + (e.clientY - d.py) / d.scale, Math.min(d.minY, d.maxY), Math.max(d.minY, d.maxY))
    // Coin haut-gauche courant → écarts aux 4 bords. Chaque axe est indépendant :
    // une carte « plaquée » (gap ≤ TOUCH) redéfinit son ancre sur cet axe.
    const cornerX = d.natX + tx
    const cornerY = d.natY + ty
    const touchLeft = cornerX - MARGIN <= TOUCH
    const touchRight = d.stageW - MARGIN - (cornerX + d.w) <= TOUCH
    const touchTop = cornerY - MARGIN <= TOUCH
    const touchBottom = d.stageH - MARGIN - (cornerY + d.h) <= TOUCH
    if (touchLeft) dragAnchorX.current = 'left'
    else if (touchRight) dragAnchorX.current = 'right'
    if (touchTop) dragAnchorY.current = 'top'
    else if (touchBottom) dragAnchorY.current = 'bottom'
    setTranslate({ x: tx, y: ty })
  }

  const handleUp = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    dragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    const t = translateRef.current
    const anchorX = dragAnchorX.current
    const anchorY = dragAnchorY.current
    // Coin haut-gauche absolu (unités scène) = naturel + translate. On stocke
    // chaque axe en distance à son bord d'ancre (right → depuis la droite, etc.).
    const cornerX = d.natX + t.x
    const cornerY = d.natY + t.y
    // Axe centré non plaqué : snap retour au centre immédiat. Le round-trip via
    // `stored` ne le fait pas (x reste 0 → dep useLayoutEffect inchangée), donc on
    // repose le translate ici. Les axes ancrés-bord gardent le translate du drag.
    if (anchorX === 'center' || anchorY === 'center') {
      setTranslate({
        x: anchorX === 'center' ? (d.stageW - d.w) / 2 - d.natX : t.x,
        y: anchorY === 'center' ? (d.stageH - d.h) / 2 - d.natY : t.y,
      })
    }
    if (onDrag) {
      onDrag(slideKey, {
        anchorX,
        anchorY,
        x: anchorX === 'right' ? d.stageW - (cornerX + d.w) : anchorX === 'center' ? 0 : cornerX,
        y: anchorY === 'bottom' ? d.stageH - (cornerY + d.h) : anchorY === 'center' ? 0 : cornerY,
      })
    }
  }

  // Double-clic : recentre la carte sur les 2 axes (ancre center). Reste centrée
  // tant qu'aucun bord n'est touché lors d'un drag ultérieur (sticky par axe).
  const handleDoubleClick = (e: MouseEvent) => {
    if (!onDrag) return
    e.stopPropagation()
    onDrag(slideKey, { anchorX: 'center', anchorY: 'center', x: 0, y: 0 })
  }

  // Liseré : bar outset par bord ancré (pas pour un axe centré → trait médian).
  const centerX = draggable && stored?.anchorX === 'center'
  const centerY = draggable && stored?.anchorY === 'center'
  const shadows: string[] = []
  if (draggable && stored) {
    if (stored.anchorX !== 'center') shadows.push(SHADOW_X[stored.anchorX])
    if (stored.anchorY !== 'center') shadows.push(SHADOW_Y[stored.anchorY])
  }
  // ponytail: l'overlay du trait médian a besoin d'un containing block positionné.
  // stage-card l'est (CSS), les wrappers `absolute` aussi ; on ne force `relative`
  // que si la className ne pose pas déjà un positionnement, pour ne rien écraser.
  const needsRelative =
    (centerX || centerY) && !/(^|\s)(absolute|fixed)(\s|$)/.test(className ?? '')

  const style: CSSProperties = {
    translate: `${translate.x}px ${translate.y}px`,
    // L'aperçu IR est pointer-events:none ; on réactive le pointeur sur les
    // cartes draggables uniquement, et neutralise le scroll tactile.
    ...(draggable && { pointerEvents: 'auto', touchAction: 'none', userSelect: 'none', cursor: 'grab' }),
    ...(needsRelative && { position: 'relative' }),
    // Liseré indiquant les bords d'ancre — IR uniquement (jamais sur l'EP).
    ...(shadows.length > 0 && { boxShadow: shadows.join(', ') }),
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
        onDoubleClick: handleDoubleClick,
      })}
    >
      {children}
      {centerX && <span aria-hidden style={CENTER_LINE_X} />}
      {centerY && <span aria-hidden style={CENTER_LINE_Y} />}
    </Tag>
  )
}
