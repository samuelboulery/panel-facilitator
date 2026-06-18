// Sections CRUD concrètes du backoffice — une par entité, toutes bâties sur
// ListSection. Les champs reflètent le schéma (PLAN.md §3).
import { useState } from 'react'
import { ListSection } from './ListSection'
import { ResetControl } from './ResetControl'
import {
  deletePerson,
  generateDefinition,
  importPersonToEvent,
  listPeople,
  listRows,
  type Person,
  type ResetScope,
} from '../../../realtime/adminData'
import { roleLabel } from '../../../shared/roleLabel'
import { ImageField, SelectField, TextArea, TextField, Toggle } from '../components/fields'

const GENDER_OPTIONS = [
  { value: '', label: 'Non précisé' },
  { value: 'f', label: 'Animatrice / Intervenante' },
  { value: 'm', label: 'Animateur / Intervenant' },
]

const personFullName = (p: { first_name: string; last_name: string }) =>
  `${p.first_name} ${p.last_name}`.trim().toLowerCase()

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const bool = (v: unknown) => v === true

/** Barre de reset au-dessus d'une liste : remonte la clé pour refetch après reset. */
function ResetBar({
  eventId,
  scope,
  label,
  onDone,
}: {
  eventId: string
  scope: ResetScope
  label: string
  onDone: () => void
}) {
  return (
    <div className="mb-3 flex justify-end">
      <ResetControl eventId={eventId} scope={scope} label={label} onDone={onDone} />
    </div>
  )
}

interface SpeakerRow {
  id: string
  sort_order: number
  first_name: string
  last_name: string
  title: string | null
  company: string | null
  bio: string | null
  photo_url: string | null
  is_host: boolean
  gender: 'f' | 'm' | null
  hidden: boolean
}

/** Barre d'import depuis la bibliothèque : liste les personnes déjà intervenues
 *  dans d'autres événements et les recopie en un clic. Vide tant qu'un seul event. */
function ImportBar({ eventId, onImported }: { eventId: string; onImported: () => void }) {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const open = async () => {
    setError(null)
    try {
      const [all, current] = await Promise.all([
        listPeople(),
        listRows<SpeakerRow>('speakers', eventId),
      ])
      const existing = new Set(current.map(personFullName))
      setPeople(all.filter((p) => !existing.has(personFullName(p))))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const pick = async (p: Person) => {
    try {
      await importPersonToEvent(p, eventId)
      setPeople(null)
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const remove = async (p: Person) => {
    if (!window.confirm(`Retirer ${p.first_name} ${p.last_name} de la bibliothèque ?`)) return
    try {
      await deletePerson(p.id)
      setPeople((list) => (list ? list.filter((x) => x.id !== p.id) : list))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <div className="mb-3">
      {people === null ? (
        <button
          type="button"
          onClick={() => void open()}
          className="rounded-lg bg-white px-3 py-2 font-mono text-xs text-control-ink shadow-sm active:scale-95"
        >
          Importer depuis la bibliothèque
        </button>
      ) : (
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-xs text-control-dim">Bibliothèque</p>
            <button type="button" onClick={() => setPeople(null)} className="font-mono text-xs text-control-dim active:scale-95">
              Fermer
            </button>
          </div>
          {people.length === 0 ? (
            <p className="py-2 text-sm text-control-dim">Aucune personne disponible à importer.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {people.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg hover:bg-control-panel">
                  <button
                    type="button"
                    onClick={() => void pick(p)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1.5 text-left active:scale-[0.99]"
                  >
                    {p.photo_url ? (
                      <img src={p.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-control-bg" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{p.first_name} {p.last_name}</span>
                      <span className="block truncate font-mono text-xs text-control-dim">
                        {[p.title, p.company].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(p)}
                    className="px-2 py-1 font-mono text-xs text-red-500 active:scale-95"
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

export function SpeakersSection({ eventId }: { eventId: string }) {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <>
    <ImportBar eventId={eventId} onImported={() => setRefreshKey((k) => k + 1)} />
    <ListSection<SpeakerRow>
      key={refreshKey}
      table="speakers"
      eventId={eventId}
      addLabel="Ajouter un speaker"
      emptyRow={() => ({
        first_name: '', last_name: '', title: '', company: '', bio: '',
        photo_url: null, is_host: false, gender: null, hidden: false,
      })}
      renderSummary={(s) => (
        <div className="flex items-center gap-3">
          {s.photo_url ? (
            <img src={s.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-control-bg" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {s.first_name} {s.last_name}
              {s.is_host && <span className="ml-2 rounded bg-control-accent px-1.5 py-0.5 font-mono text-[10px] text-white">{roleLabel(true, s.gender)}</span>}
              {s.hidden && <span className="ml-2 font-mono text-[10px] text-control-dim uppercase">masqué</span>}
            </p>
            <p className="truncate font-mono text-xs text-control-dim">
              {[s.title, s.company].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}
      renderForm={(d, set) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Prénom" value={str(d.first_name)} onChange={(v) => set('first_name', v)} />
            <TextField label="Nom" value={str(d.last_name)} onChange={(v) => set('last_name', v)} />
            <TextField label="Titre" value={str(d.title)} onChange={(v) => set('title', v)} />
            <TextField label="Société" value={str(d.company)} onChange={(v) => set('company', v)} />
          </div>
          <TextArea label="Bio courte" value={str(d.bio)} onChange={(v) => set('bio', v)} />
          <SelectField
            label="Genre (accord du rôle)"
            value={str(d.gender)}
            onChange={(v) => set('gender', v === '' ? null : v)}
            options={GENDER_OPTIONS}
          />
          <ImageField
            label="Photo"
            url={typeof d.photo_url === 'string' ? d.photo_url : null}
            folder="speakers"
            maxDim={800}
            onUploaded={(url) => set('photo_url', url)}
          />
          <Toggle label="Animateur·rice" checked={bool(d.is_host)} onChange={(v) => set('is_host', v)} />
        </>
      )}
    />
    </>
  )
}

interface SponsorRow {
  id: string
  sort_order: number
  name: string
  logo_url: string
}

export function SponsorsSection({ eventId }: { eventId: string }) {
  return (
    <ListSection<SponsorRow>
      table="sponsors"
      eventId={eventId}
      addLabel="Ajouter un sponsor"
      emptyRow={() => ({ name: '', logo_url: '' })}
      renderSummary={(s) => (
        <div className="flex items-center gap-3">
          <img src={s.logo_url} alt="" className="h-8 max-w-24 object-contain" />
          <span className="text-sm font-semibold">{s.name}</span>
        </div>
      )}
      renderForm={(d, set) => (
        <>
          <TextField label="Nom" value={str(d.name)} onChange={(v) => set('name', v)} />
          <ImageField
            label="Logo"
            url={typeof d.logo_url === 'string' && d.logo_url ? d.logo_url : null}
            folder="sponsors"
            maxDim={400}
            onUploaded={(url) => set('logo_url', url)}
          />
        </>
      )}
    />
  )
}

interface ContentRow {
  id: string
  sort_order: number
  kind: string
  url: string
  label: string
}

const CONTENT_KINDS = [
  { value: 'embed_gslides', label: 'Google Slides' },
  { value: 'embed_figma', label: 'Figma' },
  { value: 'embed_site', label: 'Site web (URL)' },
  { value: 'image', label: 'Image (URL)' },
  { value: 'video', label: 'Vidéo (URL)' },
]

export function ContentsSection({ eventId }: { eventId: string }) {
  return (
    <ListSection<ContentRow>
      table="contents"
      eventId={eventId}
      addLabel="Ajouter un contenu"
      emptyRow={() => ({ kind: 'embed_gslides', url: '', label: '' })}
      renderSummary={(c) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            <span className="mr-2 font-mono text-[10px] text-control-dim uppercase">
              {CONTENT_KINDS.find((k) => k.value === c.kind)?.label}
            </span>
            {c.label}
          </p>
          <p className="truncate font-mono text-xs text-control-dim">{c.url}</p>
        </div>
      )}
      renderForm={(d, set) => (
        <>
          <label className="block">
            <span className="mb-1 block font-mono text-xs tracking-wide text-control-dim">Type</span>
            <select
              value={str(d.kind)}
              onChange={(e) => set('kind', e.target.value)}
              className="w-full rounded-lg border border-control-bg bg-white px-3 py-2 text-sm"
            >
              {CONTENT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </label>
          <TextField label="Libellé (affiché dans l'IR)" value={str(d.label)} onChange={(v) => set('label', v)} />
          <TextField label="URL" value={str(d.url)} onChange={(v) => set('url', v)} placeholder="https://…" />
        </>
      )}
    />
  )
}

interface DefinitionRow {
  id: string
  sort_order: number
  term: string
  definition: string
  image_url: string | null
}

/** Génère une définition par IA depuis un terme (Edge Function, auth JWT organisateur).
 *  La définition est insérée puis la liste se rafraîchit ; éditable ensuite via le CRUD. */
function GenerateDefinitionBar({ slug, onGenerated }: { slug: string; onGenerated: () => void }) {
  const [term, setTerm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    const t = term.trim()
    if (!t) return
    setBusy(true)
    setError(null)
    try {
      await generateDefinition(slug, t)
      setTerm('')
      onGenerated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-3 rounded-xl bg-white p-3 shadow-sm">
      <p className="mb-2 font-mono text-xs text-control-dim">Générer par IA</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value.slice(0, 60))}
          onKeyDown={(e) => e.key === 'Enter' && void generate()}
          placeholder="Terme à définir (ex. RAG)"
          className="min-w-0 flex-1 rounded-lg border border-control-bg bg-white px-3 py-2 text-sm outline-control-accent"
        />
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy || !term.trim()}
          className="rounded-lg bg-control-ink px-4 py-2 font-mono text-sm text-white active:scale-95 disabled:opacity-50"
        >
          {busy ? 'Génération…' : 'Générer'}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

export function DefinitionsSection({ eventId, slug }: { eventId: string; slug: string }) {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <>
    <ResetBar
      eventId={eventId}
      scope="definitions"
      label="Réinitialiser les définitions"
      onDone={() => setRefreshKey((k) => k + 1)}
    />
    <GenerateDefinitionBar slug={slug} onGenerated={() => setRefreshKey((k) => k + 1)} />
    <ListSection<DefinitionRow>
      key={refreshKey}
      table="definitions"
      eventId={eventId}
      addLabel="Ajouter une définition"
      emptyRow={() => ({ term: '', definition: '', image_url: null })}
      renderSummary={(d) => (
        <div className="flex items-center gap-3">
          {d.image_url && (
            <img src={d.image_url} alt="" className="h-9 w-9 rounded object-cover" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">{d.term}</p>
            <p className="truncate text-xs text-control-dim">{d.definition}</p>
          </div>
        </div>
      )}
      renderForm={(d, set) => (
        <>
          <TextField label="Terme" value={str(d.term)} onChange={(v) => set('term', v)} />
          <TextArea label="Définition" value={str(d.definition)} onChange={(v) => set('definition', v)} />
          <ImageField
            label="Image (optionnelle)"
            url={typeof d.image_url === 'string' ? d.image_url : null}
            folder="definitions"
            maxDim={800}
            onUploaded={(url) => set('image_url', url)}
          />
        </>
      )}
    />
    </>
  )
}

interface QuestionRow {
  id: string
  sort_order: number
  text: string
  source: string
  status: string
}

export function QuestionsSection({ eventId }: { eventId: string }) {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <>
    <ResetBar
      eventId={eventId}
      scope="questions"
      label="Réinitialiser les questions"
      onDone={() => setRefreshKey((k) => k + 1)}
    />
    <ListSection<QuestionRow>
      key={refreshKey}
      table="questions"
      eventId={eventId}
      addLabel="Ajouter une question préparée"
      emptyRow={() => ({ text: '', source: 'prepared', status: 'pending' })}
      renderSummary={(q) => (
        <p className="truncate text-sm">
          {q.source === 'audience' && (
            <span className="mr-2 rounded bg-control-accent px-1.5 py-0.5 font-mono text-[10px] text-white">Public</span>
          )}
          {q.text}
        </p>
      )}
      renderForm={(d, set) => (
        <TextArea label="Question (300 car. max)" value={str(d.text)} onChange={(v) => set('text', v.slice(0, 300))} />
      )}
    />
    </>
  )
}

interface PollRow {
  id: string
  sort_order: number
  kind: string
  question: string
  options: { id: string; label: string }[]
  status: string
  show_results: boolean
}

function optionsToText(options: unknown): string {
  if (!Array.isArray(options)) return ''
  return options.map((o) => (o as { label?: string }).label ?? '').join('\n')
}

// Préserve les ids existants par position : poll_votes référence option_id —
// rééditer un sondage déjà voté ne doit pas orphaniner les votes.
function textToOptions(
  text: string,
  existing?: { id: string; label: string }[],
): { id: string; label: string }[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((label, i) => ({ id: existing?.[i]?.id ?? `opt-${i + 1}`, label }))
}

// Remplace une option par position en préservant son id (cf. textToOptions :
// poll_votes référence option_id). Complète les positions manquantes.
function setCampLabel(
  options: { id: string; label: string }[],
  index: number,
  label: string,
): { id: string; label: string }[] {
  const next = [0, 1].map((i) => options[i] ?? { id: `opt-${i + 1}`, label: '' })
  next[index] = { ...next[index], label }
  return next
}

export function PollsSection({ eventId, kind }: { eventId: string; kind: 'poll' | 'versus' }) {
  // Différence métier (D2 / PRD 5.4.8) : versus = exactement 2 camps, résultats
  // masqués pendant le vote ; sondage = N options, résultats en temps réel.
  const isVersus = kind === 'versus'
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <>
    <ResetBar
      eventId={eventId}
      scope={isVersus ? 'votes' : 'polls'}
      label={isVersus ? 'Réinitialiser les votes' : 'Réinitialiser les sondages'}
      onDone={() => setRefreshKey((k) => k + 1)}
    />
    <ListSection<PollRow>
      key={refreshKey}
      table="polls"
      eventId={eventId}
      filter={{ kind }}
      addLabel={isVersus ? 'Ajouter un vote' : 'Ajouter un sondage'}
      emptyRow={() => ({
        kind,
        question: '',
        options: [],
        _options_text: '',
        status: 'draft',
        show_results: true,
        created_live: false,
      })}
      renderSummary={(p) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{p.question}</p>
          <p className="font-mono text-xs text-control-dim">
            {p.options.map((o) => o.label).join(isVersus ? ' vs ' : ' / ')} · {p.status}
            {!p.show_results && ' · résultats cachés'}
          </p>
        </div>
      )}
      renderForm={(d, set) => {
        const options = Array.isArray(d.options)
          ? (d.options as { id: string; label: string }[])
          : []
        return (
          <>
            <TextField label="Question" value={str(d.question)} onChange={(v) => set('question', v)} />
            {isVersus ? (
              // Deux camps fixes : impose structurellement 2 options (PRD 5.4.8).
              <>
                <TextField
                  label="Camp A"
                  value={str(options[0]?.label)}
                  onChange={(v) => set('options', setCampLabel(options, 0, v))}
                />
                <TextField
                  label="Camp B"
                  value={str(options[1]?.label)}
                  onChange={(v) => set('options', setCampLabel(options, 1, v))}
                />
                <p className="font-mono text-xs text-control-dim">
                  Résultats masqués pendant le vote, révélés à la clôture.
                </p>
              </>
            ) : (
              <>
                <TextArea
                  label="Options (une par ligne)"
                  value={
                    typeof d._options_text === 'string' ? d._options_text : optionsToText(d.options)
                  }
                  onChange={(v) => {
                    set('_options_text', v)
                    set('options', textToOptions(v, options))
                  }}
                />
                <p className="font-mono text-xs text-control-dim">
                  Résultats affichés en temps réel sur l'écran pendant le vote.
                </p>
              </>
            )}
            {/* Toggle clôture réservé au versus : le sondage est toujours en
                direct (show_results forcé à true via emptyRow). */}
            {isVersus && (
              <Toggle
                label="Afficher les résultats à la clôture"
                checked={bool(d.show_results)}
                onChange={(v) => set('show_results', v)}
              />
            )}
          </>
        )
      }}
    />
    </>
  )
}
