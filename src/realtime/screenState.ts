// Architecture : abonnement à l'état écran (source de vérité : table screen_state).
// Mode dégradé (PRD 7.1) : en cas de coupure, l'abonné conserve son dernier état
// rendu (aucun reset) ; à la reconnexion, re-fetch complet puis resubscribe —
// l'état courant est toujours reconstructible depuis la DB.
import { supabase } from './client'
import { screenStateRowSchema } from '../shared/schemas'
import type { ScreenState } from '../shared/types'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface ScreenStateSubscription {
  unsubscribe: () => void
}

export interface SubscribeOptions {
  eventId: string
  onState: (state: ScreenState) => void
  onConnectionChange?: (status: ConnectionStatus) => void
}

async function fetchScreenState(eventId: string): Promise<ScreenState | null> {
  const { data, error } = await supabase
    .from('screen_state')
    .select('mode, intro_slide_index, main_content_id, overlay, speakers_banner_visible, qr_visible')
    .eq('event_id', eventId)
    .maybeSingle()

  if (error || !data) return null
  const parsed = screenStateRowSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}

/**
 * S'abonne aux changements de screen_state pour un événement.
 * Émet l'état initial (fetch), puis chaque mise à jour temps réel.
 * À chaque (re)connexion du canal : re-fetch — couvre les updates manqués hors ligne.
 */
export function subscribeScreenState(options: SubscribeOptions): ScreenStateSubscription {
  const { eventId, onState, onConnectionChange } = options
  let disposed = false

  const emitFresh = async () => {
    try {
      const state = await fetchScreenState(eventId)
      if (!disposed && state) onState(state)
    } catch (err) {
      // Pas de propagation : l'abonné garde son dernier état (mode dégradé) ;
      // le prochain cycle de reconnexion retentera le fetch.
      console.error('[screenState] resynchronisation échouée :', err)
    }
  }

  const channel = supabase
    .channel(`screen_state:${eventId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'screen_state', filter: `event_id=eq.${eventId}` },
      (payload) => {
        const parsed = screenStateRowSchema.safeParse(payload.new)
        if (!disposed && parsed.success) onState(parsed.data)
      },
    )
    .subscribe((status) => {
      if (disposed) return
      if (status === 'SUBSCRIBED') {
        onConnectionChange?.('connected')
        // Reconnexion ou premier subscribe : resynchronisation complète.
        void emitFresh()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Pas de reset d'état côté abonné : l'EP reste sur son dernier état rendu.
        onConnectionChange?.('disconnected')
      }
    })

  onConnectionChange?.('connecting')

  return {
    unsubscribe: () => {
      disposed = true
      void supabase.removeChannel(channel)
    },
  }
}

/** Résout un événement par slug via la vue publique (jamais la table events). */
export async function fetchEventBySlug(slug: string) {
  const { data, error } = await supabase
    .from('events_public')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) return null
  return data
}

/** Valide le token d'association de l'EP (URL /screen/:slug?k=...). */
export async function authenticateScreen(slug: string, token: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('screen_auth', { p_slug: slug, p_token: token })
  if (error) return null
  return (data as string | null) ?? null
}
