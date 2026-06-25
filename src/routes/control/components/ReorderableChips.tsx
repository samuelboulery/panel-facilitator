// Chips réordonnables en grille avec retour à la ligne — Reorder de
// framer-motion ne gère pas le wrap, donc détection de cible maison :
// au drop, l'index cible est le chip dont le centre est le plus proche.
// Mise à jour optimiste, persistance déléguée au parent (RPC).
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

export interface ChipItem {
  id: string
  label: string
}

interface ReorderableChipsProps {
  items: ChipItem[]
  activeId?: string | null
  /** Durée (ms) de la barre de progression sur la chip active (définition en cours). */
  activeProgressMs?: number | null
  onTap: (id: string) => void
  onReorder: (ids: string[]) => void
}

const DRAG_THRESHOLD_PX = 8

export function ReorderableChips({
  items,
  activeId,
  activeProgressMs,
  onTap,
  onReorder,
}: ReorderableChipsProps) {
  const [order, setOrder] = useState(items)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const nodeRefs = useRef(new Map<string, HTMLDivElement>())
  const dragDistance = useRef(0)

  // Resync depuis le serveur hors drag (realtime, autres mutations).
  useEffect(() => {
    if (!draggingId) setOrder(items)
  }, [items, draggingId])

  const drop = (id: string, point: { x: number; y: number }) => {
    // Ignore les refs de chips retirées pendant le drag (update realtime).
    const currentIds = new Set(order.map((i) => i.id))
    const targetEntry = [...nodeRefs.current.entries()]
      .filter(([otherId]) => otherId !== id && currentIds.has(otherId))
      .map(([otherId, node]) => {
        const rect = node.getBoundingClientRect()
        const dx = point.x - (rect.left + rect.width / 2)
        const dy = point.y - (rect.top + rect.height / 2)
        return { otherId, distance: dx * dx + dy * dy }
      })
      .sort((a, b) => a.distance - b.distance)[0]

    if (!targetEntry) return
    const from = order.findIndex((i) => i.id === id)
    const to = order.findIndex((i) => i.id === targetEntry.otherId)
    if (from === -1 || to === -1 || from === to) return

    const next = [...order]
    next.splice(to, 0, ...next.splice(from, 1))
    setOrder(next)
    onReorder(next.map((i) => i.id))
  }

  return (
    <div className="flex flex-wrap gap-2">
      {order.map((item) => (
        <motion.div
          key={item.id}
          layout
          drag
          dragSnapToOrigin
          dragElastic={0.15}
          onDragStart={() => {
            setDraggingId(item.id)
            dragDistance.current = 0
          }}
          onDrag={(_, info) => {
            dragDistance.current = Math.max(
              dragDistance.current,
              Math.hypot(info.offset.x, info.offset.y),
            )
          }}
          onDragEnd={(_, info) => {
            if (dragDistance.current > DRAG_THRESHOLD_PX) drop(item.id, info.point)
            setDraggingId(null)
          }}
          ref={(node) => {
            if (node) nodeRefs.current.set(item.id, node)
            else nodeRefs.current.delete(item.id)
          }}
          className={`${draggingId === item.id ? 'z-10' : ''}`}
        >
          <button
            type="button"
            onClick={() => {
              // Un drag ne doit pas déclencher le tap.
              if (dragDistance.current <= DRAG_THRESHOLD_PX) onTap(item.id)
              dragDistance.current = 0
            }}
            className={`relative flex items-center gap-2 overflow-hidden rounded-xl px-3.5 py-2.5 text-xl font-medium shadow-sm transition-colors active:scale-95 ${
              activeId === item.id
                ? 'bg-control-accent text-white'
                : 'bg-control-card text-control-ink'
            }`}
          >
            {item.label}
            {/* Définition en cours : barre de progression jusqu'à l'auto-fermeture.
                key=activeId → l'animation redémarre à chaque nouvelle définition. */}
            {activeId === item.id && activeProgressMs ? (
              <span className="absolute inset-x-3 bottom-1 h-1.5 overflow-hidden rounded-full bg-white/20">
                <span
                  key={item.id}
                  className="block h-full rounded-full bg-white"
                  style={{ animation: `def-progress ${activeProgressMs}ms linear forwards` }}
                />
              </span>
            ) : null}
          </button>
        </motion.div>
      ))}
    </div>
  )
}
