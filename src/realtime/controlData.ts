// Architecture : données live de l'Interface de Régie.
// Les listes (questions, sondages) sont re-fetchées intégralement à chaque
// changement temps réel — volumes V1 faibles (une salle), simplicité > delta.
import { supabase } from './client'
import { pollRowSchema, questionRowSchema } from '../shared/schemas'
import type { Poll, Question } from '../shared/types'

export interface ListSubscription {
  unsubscribe: () => void
}

function subscribeList<T>(
  table: 'questions' | 'polls',
  eventId: string,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  onList: (rows: T[]) => void,
): ListSubscription {
  let disposed = false

  const refetch = async () => {
    try {
      let query = supabase
        .from(table)
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true })
      // Les questions audience partagent sort_order=0 : départage par arrivée.
      if (table === 'questions') {
        query = query.order('created_at', { ascending: true })
      }
      const { data, error } = await query
      if (disposed || error || !data) return
      onList(
        data
          .map((row) => schema.safeParse(row))
          .filter((r) => r.success)
          .map((r) => r.data as T),
      )
    } catch (err) {
      console.error(`[controlData] refetch ${table} échoué :`, err)
    }
  }

  const channel = supabase
    .channel(`list:${table}:${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `event_id=eq.${eventId}` },
      () => void refetch(),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void refetch()
    })

  return {
    unsubscribe: () => {
      disposed = true
      void supabase.removeChannel(channel)
    },
  }
}

export function subscribeQuestionList(
  eventId: string,
  onList: (questions: Question[]) => void,
): ListSubscription {
  return subscribeList('questions', eventId, questionRowSchema, onList)
}

export function subscribePollList(
  eventId: string,
  onList: (polls: Poll[]) => void,
): ListSubscription {
  return subscribeList('polls', eventId, pollRowSchema, onList)
}

export async function fetchNotes(eventId: string): Promise<string> {
  const { data, error } = await supabase
    .from('notes')
    .select('content_md')
    .eq('event_id', eventId)
    .maybeSingle()
  if (error || !data) return ''
  return (data as { content_md: string }).content_md
}

/**
 * Mesure de latence : durée d'un aller-retour PostgREST minimal.
 * Affichée dans la barre d'état de l'IR (exigence P2).
 */
export async function measureLatency(): Promise<number | null> {
  const startedAt = performance.now()
  const { error } = await supabase.from('events_public').select('id').limit(1)
  if (error) return null
  return Math.round(performance.now() - startedAt)
}
