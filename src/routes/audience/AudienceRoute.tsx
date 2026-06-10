// Architecture : surface audience (mobile) — cible du QR code projeté.
// Deux fonctions : poser une question (modérée par la régie, jamais affichée
// automatiquement) et voter quand un sondage/vote est live.
// Anti double-vote : fingerprint anonyme en localStorage (PLAN.md D5).
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { fetchEventData } from '../../realtime/eventData'
import { subscribePollList } from '../../realtime/controlData'
import { castVote, submitQuestion } from '../../realtime/mutations'
import { questionSubmissionSchema } from '../../shared/schemas'
import type { EventPublic, Poll } from '../../shared/types'

const FINGERPRINT_KEY = 'panel-facilitator:fingerprint'
const VOTED_KEY_PREFIX = 'panel-facilitator:voted:'

// localStorage peut jeter (navigation privée Safari) : le vote doit
// fonctionner quand même, sans persistance dans ce cas.
function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Pas de persistance — acceptable, le serveur déduplique par fingerprint.
  }
}

let sessionFingerprint: string | null = null

function getFingerprint(): string {
  if (sessionFingerprint) return sessionFingerprint
  let fp = safeStorageGet(FINGERPRINT_KEY)
  if (!fp) {
    fp = crypto.randomUUID()
    safeStorageSet(FINGERPRINT_KEY, fp)
  }
  sessionFingerprint = fp
  return fp
}

function QuestionForm({ slug }: { slug: string }) {
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    const parsed = questionSubmissionSchema.safeParse({
      text,
      authorName: author || undefined,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setState('sending')
    setError(null)
    try {
      await submitQuestion(slug, parsed.data.text, parsed.data.authorName)
      setState('sent')
      setText('')
    } catch {
      setState('error')
      setError('Envoi impossible — réessayer')
    }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-semibold text-control-ink">Question envoyée !</p>
        <p className="mt-2 text-sm text-control-dim">
          La régie la verra et pourra l’afficher à l’écran.
        </p>
        <button
          type="button"
          onClick={() => {
            setState('idle')
            setError(null)
          }}
          className="mt-5 rounded-xl bg-control-ink px-6 py-3 font-mono text-white active:scale-95"
        >
          En poser une autre
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-mono text-sm tracking-wide text-control-dim">Votre question</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={300}
        rows={4}
        placeholder="Posez votre question aux intervenant·es…"
        className="w-full resize-none rounded-xl bg-control-panel p-4 text-base outline-control-accent"
      />
      <div className="mt-1 text-right font-mono text-xs text-control-dim">{text.length}/300</div>
      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        maxLength={80}
        placeholder="Votre prénom (optionnel)"
        className="mt-2 w-full rounded-xl bg-control-panel px-4 py-3 text-base outline-control-accent"
      />
      <p className="mt-2 h-5 text-sm text-red-600">{error ?? ''}</p>
      <button
        type="button"
        disabled={state === 'sending' || text.trim().length === 0}
        onClick={() => void send()}
        className="mt-2 w-full rounded-2xl bg-control-ink py-4 font-mono text-lg text-white active:scale-[0.98] disabled:opacity-40"
      >
        {state === 'sending' ? 'Envoi…' : 'Envoyer'}
      </button>
    </div>
  )
}

function VotePanel({ poll }: { poll: Poll }) {
  const votedKey = `${VOTED_KEY_PREFIX}${poll.id}`
  const [votedFor, setVotedFor] = useState<string | null>(() => safeStorageGet(votedKey))
  const [sending, setSending] = useState(false)

  const vote = async (optionId: string) => {
    if (votedFor || sending) return
    // Optimiste AVANT l'await : bloque tout second tap pendant l'envoi.
    setVotedFor(optionId)
    setSending(true)
    try {
      await castVote(poll.id, optionId, getFingerprint())
      safeStorageSet(votedKey, optionId)
    } catch {
      // Vote refusé (clôturé entre-temps) : retour à l'état votable.
      setVotedFor(null)
    } finally {
      setSending(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="rounded-2xl border-2 border-control-accent bg-white p-5 shadow-md"
    >
      <p className="mb-1 font-mono text-xs tracking-[0.2em] text-control-accent uppercase">
        {poll.kind === 'versus' ? 'Vote en cours' : 'Sondage en cours'}
      </p>
      <h2 className="mb-4 text-xl font-semibold text-control-ink">{poll.question}</h2>
      <div className={poll.kind === 'versus' ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-2.5'}>
        {poll.options.map((option) => {
          const chosen = votedFor === option.id
          return (
            <button
              key={option.id}
              type="button"
              disabled={votedFor !== null || sending}
              onClick={() => void vote(option.id)}
              className={`rounded-2xl px-4 py-4 text-lg font-semibold transition active:scale-[0.97] ${
                chosen
                  ? 'bg-control-accent text-white'
                  : votedFor
                    ? 'bg-control-panel text-control-dim'
                    : 'bg-control-panel text-control-ink'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {votedFor && (
        <p className="mt-4 text-center font-mono text-sm text-control-dim">
          Merci, votre vote est pris en compte — regardez l’écran !
        </p>
      )}
    </motion.div>
  )
}

export default function AudienceRoute() {
  const { slug } = useParams<{ slug: string }>()
  const [event, setEvent] = useState<EventPublic | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [polls, setPolls] = useState<Poll[]>([])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    void fetchEventData(slug).then((d) => {
      if (cancelled) return
      if (d) setEvent(d.event)
      else setNotFound(true)
    })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!event) return
    const sub = subscribePollList(event.id, setPolls)
    return () => sub.unsubscribe()
  }, [event])

  const livePoll = useMemo(() => polls.find((p) => p.status === 'live') ?? null, [polls])

  if (notFound) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-control-bg p-6">
        <p className="font-mono text-control-dim">Événement introuvable.</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-control-bg font-display text-control-ink">
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-10">
        <header className="px-1 pt-4">
          <p className="font-mono text-xs tracking-[0.25em] text-control-dim uppercase">
            {event?.subtitle ?? 'Table ronde'}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{event?.title ?? ''}</h1>
        </header>

        {/* Le vote en cours passe devant le formulaire — c'est l'action chaude. */}
        <AnimatePresence>{livePoll && <VotePanel key={livePoll.id} poll={livePoll} />}</AnimatePresence>

        {slug && <QuestionForm slug={slug} />}
      </div>
    </div>
  )
}
