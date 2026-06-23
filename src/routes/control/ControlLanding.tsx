// Page d'atterrissage de la régie (`/control`) — point d'entrée `start_url` du PWA.
// `/control/:slug` exige un slug ; cette page ouvre la dernière régie utilisée
// (localStorage, survit à la fermeture de l'app) ou demande le slug à la première
// ouverture. ponytail: pas de liste d'événements ici, un seul champ suffit.
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

const LAST_SLUG_KEY = 'panel-facilitator:last-slug'

export default function ControlLanding() {
  const lastSlug = localStorage.getItem(LAST_SLUG_KEY)
  if (lastSlug) return <Navigate to={`/control/${lastSlug}`} replace />

  return <SlugForm />
}

function SlugForm() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = slug.trim()
    if (trimmed) navigate(`/control/${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-8 bg-slate-100">
      <h1 className="font-mono text-sm uppercase tracking-widest text-slate-500">Régie</h1>
      <form onSubmit={submit} className="flex flex-col items-center gap-4">
        <input
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="slug de l'événement"
          aria-label="Slug de l'événement"
          className="w-72 rounded-2xl bg-white px-5 py-3 text-center text-lg text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
        <button
          type="submit"
          disabled={!slug.trim()}
          className="rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
        >
          Ouvrir la régie
        </button>
      </form>
    </div>
  )
}
