// Panneau Notes accessible par le haut (refonte régie) : poignée centrée en haut
// de l'écran ; tap ou drag vers le bas ouvre, drag vers le haut ferme. Remplace
// l'ancien onglet Notes du pager. L'éditeur lui-même (NotesView) est inchangé.
import { useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import type { ControlSession } from '../../../realtime/mutations'
import { NotesView } from './NotesView'

// Seuil de drag (px) pour basculer ouvert/fermé sans relâcher pile sur la limite.
const DRAG_THRESHOLD = 40

export function NotesPanel({ session }: { session: ControlSession }) {
  const [open, setOpen] = useState(false)

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DRAG_THRESHOLD) setOpen(true)
    else if (info.offset.y < -DRAG_THRESHOLD) setOpen(false)
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col items-center">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto max-h-[60dvh] w-full overflow-hidden px-3 pt-3"
          >
            <NotesView session={session} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Poignée : tap pour basculer, drag vertical pour ouvrir/fermer. */}
      <motion.button
        type="button"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.4}
        onDragEnd={onDragEnd}
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex items-center gap-2 rounded-b-2xl bg-control-panel px-6 py-2 font-mono text-xs tracking-wide text-control-dim shadow-md active:scale-95"
      >
        Notes
        <span aria-hidden>{open ? '▲' : '▼'}</span>
      </motion.button>
    </div>
  )
}
