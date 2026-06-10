// Architecture : lecture des données d'événement pour l'EP (et l'IR).
// Tout passe par les schémas Zod de src/shared — jamais de cast aveugle.
// Les résultats de sondage sont agrégés côté client depuis poll_votes
// (PLAN.md D9) : fetch initial + INSERT temps réel.
import { supabase } from './client'
import {
  contentRowSchema,
  definitionRowSchema,
  eventPublicRowSchema,
  pollRowSchema,
  questionRowSchema,
  speakerRowSchema,
  sponsorRowSchema,
} from '../shared/schemas'
import type {
  Content,
  Definition,
  EventPublic,
  Poll,
  PollResults,
  Question,
  Speaker,
  Sponsor,
} from '../shared/types'

export interface EventData {
  event: EventPublic
  speakers: Speaker[]
  sponsors: Sponsor[]
  contents: Content[]
  definitions: Definition[]
}

async function fetchList<T>(
  table: string,
  eventId: string,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data
    .map((row) => schema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data as T)
}

/** Charge l'intégralité des données statiques d'un événement (boot EP). */
export async function fetchEventData(slug: string): Promise<EventData | null> {
  const { data, error } = await supabase
    .from('events_public')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  const parsed = eventPublicRowSchema.safeParse(data)
  if (!parsed.success) return null
  const event = parsed.data

  const [speakers, sponsors, contents, definitions] = await Promise.all([
    fetchList<Speaker>('speakers', event.id, speakerRowSchema),
    fetchList<Sponsor>('sponsors', event.id, sponsorRowSchema),
    fetchList<Content>('contents', event.id, contentRowSchema),
    fetchList<Definition>('definitions', event.id, definitionRowSchema),
  ])

  return { event, speakers, sponsors, contents, definitions }
}

export async function fetchQuestion(id: string): Promise<Question | null> {
  const { data, error } = await supabase.from('questions').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  const parsed = questionRowSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}

export async function fetchDefinition(id: string): Promise<Definition | null> {
  const { data, error } = await supabase
    .from('definitions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  const parsed = definitionRowSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}

export async function fetchPoll(id: string): Promise<Poll | null> {
  const { data, error } = await supabase.from('polls').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  const parsed = pollRowSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}

export interface PollSubscription {
  unsubscribe: () => void
}

/**
 * Suit un sondage en cours : émet le poll (statut, toggle résultats) et les
 * résultats agrégés à chaque vote. L'affichage temps réel vs clôture est
 * décidé par le composant selon poll.kind (PLAN.md D2).
 */
export function subscribePoll(
  pollId: string,
  onPoll: (poll: Poll) => void,
  onResults: (results: PollResults) => void,
): PollSubscription {
  let disposed = false
  const counts: PollResults = {}

  const emitInitial = async () => {
    try {
      const poll = await fetchPoll(pollId)
      if (!disposed && poll) onPoll(poll)

      const { data } = await supabase
        .from('poll_votes')
        .select('option_id')
        .eq('poll_id', pollId)
      if (disposed) return
      for (const key of Object.keys(counts)) delete counts[key]
      for (const row of data ?? []) {
        const optionId = (row as { option_id: string }).option_id
        counts[optionId] = (counts[optionId] ?? 0) + 1
      }
      onResults({ ...counts })
    } catch (err) {
      console.error('[eventData] synchronisation sondage échouée :', err)
    }
  }

  const channel = supabase
    .channel(`poll:${pollId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${pollId}` },
      (payload) => {
        if (disposed) return
        const optionId = (payload.new as { option_id: string }).option_id
        counts[optionId] = (counts[optionId] ?? 0) + 1
        onResults({ ...counts })
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'polls', filter: `id=eq.${pollId}` },
      (payload) => {
        if (disposed) return
        const parsed = pollRowSchema.safeParse(payload.new)
        if (parsed.success) onPoll(parsed.data)
      },
    )
    .subscribe((status) => {
      // Resynchronisation complète à chaque (re)connexion — même logique
      // de mode dégradé que screen_state.
      if (status === 'SUBSCRIBED') void emitInitial()
    })

  return {
    unsubscribe: () => {
      disposed = true
      void supabase.removeChannel(channel)
    },
  }
}
