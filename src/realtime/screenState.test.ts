// Tests de résilience du cœur temps réel (PRD 7.1 — mode dégradé) :
// - resynchronisation complète à chaque (re)connexion du canal
// - état conservé côté abonné en cas d'erreur de canal (aucune émission)
// - payloads invalides ignorés (jamais d'état corrompu sur l'EP)
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock du client Supabase ──
// Mock simplifié : couvre le flux de contrôle utilisé par screenState.ts
// (chaînes from().select().eq().maybeSingle(), channel().on().subscribe(),
// removeChannel) — pas l'API supabase-js complète.
type ChannelCallback = (payload: { new: unknown }) => void
type StatusCallback = (status: string) => void

const mockState = {
  onPostgresChanges: null as ChannelCallback | null,
  onStatus: null as StatusCallback | null,
  fetchResult: null as unknown,
  fetchCalls: 0,
  removed: [] as unknown[],
}

vi.mock('./client', () => {
  const channel = {
    on: (_type: string, _filter: unknown, cb: ChannelCallback) => {
      mockState.onPostgresChanges = cb
      return channel
    },
    subscribe: (cb: StatusCallback) => {
      mockState.onStatus = cb
      return channel
    },
  }
  return {
    supabase: {
      channel: () => channel,
      removeChannel: (c: unknown) => {
        mockState.removed.push(c)
        return Promise.resolve('ok')
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => {
              mockState.fetchCalls += 1
              return Promise.resolve({ data: mockState.fetchResult, error: null })
            },
          }),
        }),
      }),
    },
  }
})

import { subscribeScreenState } from './screenState'

const validRow = {
  mode: 'dynamique',
  intro_slide_index: 0,
  main_content_id: null,
  overlay: { type: 'question', id: 'q1' },
  speakers_banner_visible: true,
  qr_visible: false,
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  mockState.onPostgresChanges = null
  mockState.onStatus = null
  mockState.fetchResult = validRow
  mockState.fetchCalls = 0
  mockState.removed = []
})

describe('subscribeScreenState — résilience', () => {
  it('resynchronise (fetch complet) à chaque connexion du canal', async () => {
    const onState = vi.fn()
    const sub = subscribeScreenState({ eventId: 'e1', onState })

    mockState.onStatus?.('SUBSCRIBED')
    await flush()
    expect(mockState.fetchCalls).toBe(1)
    expect(onState).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'dynamique', qrVisible: false }),
    )

    // Coupure puis reconnexion : nouveau fetch (récupère les updates manqués).
    mockState.onStatus?.('CHANNEL_ERROR')
    mockState.onStatus?.('SUBSCRIBED')
    await flush()
    expect(mockState.fetchCalls).toBe(2)
    sub.unsubscribe()
  })

  it('n’émet RIEN sur erreur de canal — l’abonné garde son dernier état (mode dégradé)', async () => {
    const onState = vi.fn()
    const onConnectionChange = vi.fn()
    const sub = subscribeScreenState({ eventId: 'e1', onState, onConnectionChange })

    mockState.onStatus?.('SUBSCRIBED')
    await flush()
    onState.mockClear()

    mockState.onStatus?.('CHANNEL_ERROR')
    await flush()
    expect(onState).not.toHaveBeenCalled()
    expect(onConnectionChange).toHaveBeenLastCalledWith('disconnected')
    sub.unsubscribe()
  })

  it('transmet les UPDATE temps réel validés, ignore les payloads corrompus', async () => {
    const onState = vi.fn()
    const sub = subscribeScreenState({ eventId: 'e1', onState })
    mockState.onStatus?.('SUBSCRIBED')
    await flush()
    onState.mockClear()

    mockState.onPostgresChanges?.({ new: { ...validRow, mode: 'outro' } })
    expect(onState).toHaveBeenCalledWith(expect.objectContaining({ mode: 'outro' }))
    onState.mockClear()

    // Payload corrompu (mode inconnu) : ignoré, pas d'état invalide émis.
    mockState.onPostgresChanges?.({ new: { ...validRow, mode: 'explosion' } })
    expect(onState).not.toHaveBeenCalled()
    sub.unsubscribe()
  })

  it('plus aucune émission après unsubscribe (fetch en vol compris)', async () => {
    const onState = vi.fn()
    const sub = subscribeScreenState({ eventId: 'e1', onState })
    mockState.onStatus?.('SUBSCRIBED')
    sub.unsubscribe() // avant la résolution du fetch
    await flush()
    expect(onState).not.toHaveBeenCalled()
    expect(mockState.removed).toHaveLength(1)
  })
})
