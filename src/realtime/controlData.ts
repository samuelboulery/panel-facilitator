// Architecture : données live de l'Interface de Régie.
// Les listes (questions, sondages) sont re-fetchées intégralement à chaque
// changement temps réel — volumes V1 faibles (une salle), simplicité > delta.
import { supabase } from './client'
import {
  definitionRowSchema,
  pollRowSchema,
  questionRowSchema,
  speakerRowSchema,
} from '../shared/schemas'
import type { Definition, Poll, Question, Speaker } from '../shared/types'

export interface ListSubscription {
  unsubscribe: () => void
}

function subscribeList<T>(
  table: 'questions' | 'polls' | 'speakers' | 'definitions',
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

/** Définitions en temps réel — génération LLM et usage unique (repasse IR). */
export function subscribeDefinitionList(
  eventId: string,
  onList: (definitions: Definition[]) => void,
): ListSubscription {
  return subscribeList('definitions', eventId, definitionRowSchema, onList)
}

/** Speakers en temps réel — masquage live depuis l'IR (PRD 5.3.4). */
export function subscribeSpeakerList(
  eventId: string,
  onList: (speakers: Speaker[]) => void,
): ListSubscription {
  return subscribeList('speakers', eventId, speakerRowSchema, onList)
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

