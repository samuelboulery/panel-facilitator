// Vue Notes (droite) — éditeur de notes de l'animateur (PRD 5.6).
// Markdown brut, sauvegarde continue côté serveur (debounce 1 s).
import { useEffect, useRef, useState } from 'react'
import type { ControlSession } from '../../../realtime/mutations'
import { saveNotes } from '../../../realtime/mutations'
import { fetchNotes } from '../../../realtime/controlData'

const SAVE_DEBOUNCE_MS = 1000

export function NotesView({ session }: { session: ControlSession }) {
  const [content, setContent] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Refs pour le flush au démontage (sans redémarrer l'effet à chaque frappe).
  const pendingRef = useRef<string | null>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => {
    let cancelled = false
    void fetchNotes(session.eventId).then((md) => {
      if (!cancelled) {
        setContent(md)
        setLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [session.eventId])

  const onChange = (value: string) => {
    setContent(value)
    setStatus('saving')
    pendingRef.current = value
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      pendingRef.current = null
      saveNotes(session, value)
        .then(() => setStatus('saved'))
        .catch(() => setStatus('error'))
    }, SAVE_DEBOUNCE_MS)
  }

  // Démontage avec sauvegarde en attente : flush immédiat — aucune frappe perdue.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (pendingRef.current !== null) {
      void saveNotes(sessionRef.current, pendingRef.current).catch(() => undefined)
    }
  }, [])

  return (
    <div className="flex h-full flex-col rounded-2xl bg-control-panel p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="font-mono text-sm tracking-wide text-control-dim">Notes</h2>
        <span className="font-mono text-xs text-control-dim">
          {status === 'saving' && 'Enregistrement…'}
          {status === 'saved' && 'Enregistré'}
          {status === 'error' && 'Erreur — réessayer'}
        </span>
      </div>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        disabled={!loaded}
        placeholder="Markdown de qualité"
        className="min-h-[400px] flex-1 resize-none rounded-xl bg-control-card p-5 text-lg leading-relaxed outline-control-accent disabled:opacity-50"
      />
    </div>
  )
}
