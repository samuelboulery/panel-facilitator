// Vue Notes (droite) — éditeur de notes de l'animateur (PRD 5.6).
// Markdown : rendu par défaut, clic = édition (textarea). Sauvegarde continue (debounce 1 s).
import { useEffect, useRef, useState } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ControlSession } from '../../../realtime/mutations'
import { saveNotes } from '../../../realtime/mutations'
import { fetchNotes } from '../../../realtime/controlData'

const SAVE_DEBOUNCE_MS = 1000

// Tailwind v4 reset neutralise les balises ; on redonne hiérarchie + style ici
// (évite la dépendance @tailwindcss/typography pour ce seul usage).
const MD_COMPONENTS: Components = {
  h1: (props) => <h1 className="mb-2 mt-3 text-2xl font-bold first:mt-0" {...props} />,
  h2: (props) => <h2 className="mb-2 mt-3 text-xl font-bold first:mt-0" {...props} />,
  h3: (props) => <h3 className="mb-1 mt-2 text-lg font-semibold first:mt-0" {...props} />,
  p: (props) => <p className="mb-2 leading-relaxed" {...props} />,
  ul: (props) => <ul className="mb-2 list-disc pl-5" {...props} />,
  ol: (props) => <ol className="mb-2 list-decimal pl-5" {...props} />,
  li: (props) => <li className="mb-1" {...props} />,
  a: (props) => <a className="text-control-accent underline" {...props} />,
  code: (props) => <code className="rounded bg-control-card px-1 py-0.5 font-mono text-sm" {...props} />,
  blockquote: (props) => <blockquote className="border-l-2 border-control-dim pl-3 italic text-control-dim" {...props} />,
}

export function NotesView({ session }: { session: ControlSession }) {
  const [content, setContent] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
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
      {editing ? (
        <textarea
          autoFocus
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          disabled={!loaded}
          placeholder="Markdown de qualité"
          className="min-h-[400px] flex-1 resize-none rounded-xl bg-control-card p-5 font-mono text-base leading-relaxed outline-control-accent disabled:opacity-50"
        />
      ) : (
        <div
          role="textbox"
          tabIndex={0}
          onClick={() => loaded && setEditing(true)}
          onFocus={() => loaded && setEditing(true)}
          className="min-h-[400px] flex-1 cursor-text overflow-auto rounded-xl bg-control-card p-5 text-lg leading-relaxed"
        >
          {content.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {content}
            </ReactMarkdown>
          ) : (
            <span className="text-control-dim">{loaded ? 'Cliquer pour écrire (markdown)…' : 'Chargement…'}</span>
          )}
        </div>
      )}
    </div>
  )
}
