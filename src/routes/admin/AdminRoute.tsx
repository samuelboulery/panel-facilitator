// Architecture : Backoffice de configuration — accès PC, pré-événement
// (PRD §4.1). Supabase Auth (un compte organisateur, PLAN.md D7), login
// uniquement. Mono-événement V1 : charge le premier événement, ou propose
// la création s'il n'existe pas.
import { useCallback, useEffect, useState } from 'react'
import { signIn, signOut, watchAuth } from '../../realtime/adminAuth'
import {
  createAdminEvent,
  fetchAdminEvent,
  type AdminEvent,
} from '../../realtime/adminData'
import { TextField } from './components/fields'
import { SavedSnackbar } from './components/SavedSnackbar'
import { ResetControl } from './sections/ResetControl'
import { ChecklistSection } from './sections/ChecklistSection'
import { EventSection } from './sections/EventSection'
import {
  ContentsSection,
  DefinitionsSection,
  PollsSection,
  QuestionsSection,
} from './sections/entitySections'

const SECTIONS = [
  { key: 'event', label: 'Événement' },
  { key: 'contents', label: 'Contenus' },
  { key: 'definitions', label: 'Définitions' },
  { key: 'questions', label: 'Questions' },
  { key: 'polls', label: 'Sondages' },
  { key: 'votes', label: 'Votes' },
  { key: 'checklist', label: 'Checklist ✓' },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    const ok = await signIn(email, password)
    setBusy(false)
    if (!ok) setError('Identifiants incorrects')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-control-bg">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="mb-1 text-xl font-bold">Backoffice</h1>
        <p className="mb-6 font-mono text-xs text-control-dim">Tables rondes design</p>
        <div className="flex flex-col gap-3">
          <TextField label="Email" type="email" value={email} onChange={setEmail} />
          <TextField label="Mot de passe" type="password" value={password} onChange={setPassword} />
        </div>
        <p className="mt-2 h-5 text-sm text-red-600">{error ?? ''}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="mt-2 w-full rounded-xl bg-control-ink py-3 font-mono text-white active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </div>
    </div>
  )
}

function CreateEventForm({ onCreated }: { onCreated: () => void }) {
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
      setError('Slug : minuscules, chiffres, tirets (3-40 car.)')
      return
    }
    if (!title.trim()) {
      setError('Titre requis')
      return
    }
    try {
      await createAdminEvent(slug, title.trim())
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-md rounded-3xl bg-white p-8 shadow-xl">
      <h2 className="mb-4 text-lg font-bold">Créer l’événement</h2>
      <div className="flex flex-col gap-3">
        <TextField label="Slug (URL)" value={slug} onChange={setSlug} placeholder="ma-table-ronde" />
        <TextField label="Titre" value={title} onChange={setTitle} />
      </div>
      <p className="mt-2 h-5 text-sm text-red-600">{error ?? ''}</p>
      <p className="mb-3 font-mono text-xs text-control-dim">
        PIN initial : 0000 — à changer immédiatement dans la section Événement.
      </p>
      <button
        type="button"
        onClick={() => void create()}
        className="w-full rounded-xl bg-control-ink py-3 font-mono text-white active:scale-[0.98]"
      >
        Créer
      </button>
    </div>
  )
}

export default function AdminRoute() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [event, setEvent] = useState<AdminEvent | null>(null)
  const [eventLoaded, setEventLoaded] = useState(false)
  const [section, setSection] = useState<SectionKey>('event')
  // Incrémenté après un reset global → remonte la section active pour refetch.
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => watchAuth(setAuthed), [])

  const reloadEvent = useCallback(() => {
    void fetchAdminEvent().then((e) => {
      setEvent(e)
      setEventLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (authed) reloadEvent()
  }, [authed, reloadEvent])

  if (authed === null) return null
  if (!authed) return <LoginForm />
  if (!eventLoaded) return <div className="min-h-dvh bg-control-bg" />
  if (!event) return (
    <div className="min-h-dvh bg-control-bg">
      <CreateEventForm onCreated={reloadEvent} />
    </div>
  )

  return (
    <div className="min-h-dvh bg-control-bg font-display text-control-ink">
      <div className="mx-auto max-w-[1920px] px-6 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.25em] text-control-dim uppercase">
              Backoffice
            </p>
            <h1 className="text-2xl font-bold">{event.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ResetControl
              eventId={event.id}
              scope="all"
              label="Tout réinitialiser"
              variant="global"
              onDone={() => setResetKey((k) => k + 1)}
            />
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg px-3 py-2 font-mono text-xs text-control-dim active:scale-95"
            >
              Déconnexion
            </button>
          </div>
        </header>

        <nav className="mb-6 flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className={`rounded-full px-4 py-1.5 font-mono text-sm transition-colors ${
                section === s.key ? 'bg-control-ink text-white' : 'bg-white text-control-dim'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <main key={`${section}-${resetKey}`} className="rounded-3xl">
          {section === 'event' && <EventSection event={event} onSaved={reloadEvent} />}
          {section === 'contents' && <ContentsSection eventId={event.id} />}
          {section === 'definitions' && <DefinitionsSection eventId={event.id} slug={event.slug} />}
          {section === 'questions' && <QuestionsSection eventId={event.id} />}
          {section === 'polls' && <PollsSection eventId={event.id} kind="poll" />}
          {section === 'votes' && <PollsSection eventId={event.id} kind="versus" />}
          {section === 'checklist' && <ChecklistSection event={event} />}
        </main>
      </div>
      <SavedSnackbar />
    </div>
  )
}
