// Résilience des listes de la Régie (PRD 7.1) : subscribeList re-fetch tout au
// SUBSCRIBED (reconnexion) et conserve la liste courante sur erreur (aucun
// onList appelé) — pas d'écran vide en mode dégradé.
import { beforeEach, describe, expect, it, vi } from 'vitest'

type StatusCallback = (status: string) => void

const EVENT_ID = 'e1'

const mockState = {
  onStatus: null as StatusCallback | null,
  fetchCalls: 0,
  result: { data: null as unknown, error: null as unknown },
  removed: [] as unknown[],
}

vi.mock('./client', () => {
  const channel = {
    on: () => channel,
    subscribe: (cb: StatusCallback) => {
      mockState.onStatus = cb
      return channel
    },
  }
  // Query thenable : eq()/order() renvoient la query ; await déclenche le fetch.
  const query: Record<string, unknown> = {}
  query.eq = () => query
  query.order = () => query
  query.then = (resolve: (v: unknown) => void) => {
    mockState.fetchCalls += 1
    return Promise.resolve(mockState.result).then(resolve)
  }
  return {
    supabase: {
      channel: () => channel,
      removeChannel: (c: unknown) => {
        mockState.removed.push(c)
        return Promise.resolve('ok')
      },
      from: () => ({ select: () => query }),
    },
  }
})

import { subscribePollList } from './controlData'

const validPoll = {
  id: '11111111-1111-1111-1111-111111111111',
  kind: 'poll',
  question: 'Q ?',
  options: [{ id: 'a', label: 'A' }],
  status: 'live',
  show_results: true,
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  mockState.onStatus = null
  mockState.fetchCalls = 0
  mockState.result = { data: [validPoll], error: null }
  mockState.removed = []
})

describe('subscribeList (via subscribePollList) — résilience', () => {
  it('re-fetch la liste à chaque connexion du canal', async () => {
    const onList = vi.fn()
    const sub = subscribePollList(EVENT_ID, onList)

    mockState.onStatus?.('SUBSCRIBED')
    await flush()
    expect(mockState.fetchCalls).toBe(1)
    expect(onList).toHaveBeenCalledWith([expect.objectContaining({ status: 'live' })])

    mockState.onStatus?.('CHANNEL_ERROR')
    mockState.onStatus?.('SUBSCRIBED')
    await flush()
    expect(mockState.fetchCalls).toBe(2)
    sub.unsubscribe()
  })

  it('conserve la liste sur erreur de fetch (aucune émission)', async () => {
    const onList = vi.fn()
    const sub = subscribePollList(EVENT_ID, onList)
    mockState.result = { data: null, error: { message: 'boom' } }

    mockState.onStatus?.('SUBSCRIBED')
    await flush()
    expect(onList).not.toHaveBeenCalled()
    sub.unsubscribe()
  })

  it('plus aucune émission après unsubscribe', async () => {
    const onList = vi.fn()
    const sub = subscribePollList(EVENT_ID, onList)
    mockState.onStatus?.('SUBSCRIBED')
    sub.unsubscribe()
    await flush()
    expect(onList).not.toHaveBeenCalled()
    expect(mockState.removed).toHaveLength(1)
  })
})
