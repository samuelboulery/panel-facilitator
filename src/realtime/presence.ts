// Architecture : présence sur le canal événement — l'IR voit si l'EP est
// connecté (indicateur exigé P2, PRD 5.6). L'EP s'annonce ; l'IR observe.
import { supabase } from './client'

export type PresenceRole = 'screen' | 'control'

export interface PresenceHandle {
  leave: () => void
}

/** L'EP (ou l'IR) s'annonce sur le canal de l'événement. */
export function joinPresence(eventId: string, role: PresenceRole): PresenceHandle {
  const channel = supabase.channel(`presence:${eventId}`, {
    config: { presence: { key: role } },
  })

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      void channel.track({ role, joined_at: new Date().toISOString() })
    }
  })

  return {
    leave: () => {
      void supabase.removeChannel(channel)
    },
  }
}

/** L'IR observe la présence de l'EP. Callback à chaque changement. */
export function watchScreenPresence(
  eventId: string,
  onChange: (screenOnline: boolean) => void,
): PresenceHandle {
  const channel = supabase.channel(`presence:${eventId}`, {
    config: { presence: { key: 'control-watcher' } },
  })

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      onChange('screen' in state)
    })
    .subscribe()

  return {
    leave: () => {
      void supabase.removeChannel(channel)
    },
  }
}
