// Snackbar « Modifications enregistrées » du backoffice. Pub/sub module-level :
// les sites de sauvegarde appellent notifySaved() sans prop drilling ; le
// composant, monté une seule fois dans AdminRoute, affiche le toast 2 s.
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const listeners = new Set<() => void>()

/** À appeler après une sauvegarde réussie. */
export function notifySaved() {
  listeners.forEach((fn) => fn())
}

export function SavedSnackbar() {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const onSaved = () => setShown((n) => n + 1)
    listeners.add(onSaved)
    return () => void listeners.delete(onSaved)
  }, [])

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(0), 2000)
    return () => clearTimeout(t)
  }, [shown])

  return (
    <AnimatePresence>
      {shown > 0 && (
        <motion.div
          // key sur le compteur : relance l'animation si on resauvegarde pendant l'affichage.
          key={shown}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-control-ink px-4 py-2.5 font-mono text-sm text-white shadow-xl"
        >
          Modifications enregistrées
        </motion.div>
      )}
    </AnimatePresence>
  )
}
