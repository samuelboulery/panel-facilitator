// Résilience du suivi sondage (PRD 7.1 — mode dégradé) : subscribePoll réplique
// le pattern resync-on-SUBSCRIBED de screen_state. On vérifie ici qu'une
// reconnexion déclenche bien un re-fetch complet (poll + résultats agrégés) et
// qu'une erreur de canal n'émet rien (l'EP garde son dernier état).
import { beforeEach, describe, expect, it, vi } from 'vitest'

type StatusCallback = (status: string) => void

const POLL_ID = '11111111-1111-1111-1111-111111111111'

const mockState = {
  onStatus: null as StatusCallback | null,
  pollFetchCalls: 0,
  votesFetchCalls: 0,
  pollRow: null as unknown,
  voteRows: [] as unknown[],
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
  return {
    supabase: {
      channel: () => channel,
      removeChannel: (c: unknown) => {
        mockState.removed.push(c)
        return Promise.resolve('ok')
      },
      from: (table: string) => {
        if (table === 'polls') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => {
                  mockState.pollFetchCalls += 1
                  return Promise.resolve({ data: mockState.pollRow, error: null })
                },
              }),
            }),
          }
        }
        // poll_votes : select(...).eq(...) est awaité directement
        return {
          select: () => ({
            eq: () => {
              mockState.votesFetchCalls += 1
              return Promise.resolve({ data: mockState.voteRows, error: null })
            },
          }),
        }
      },
    },
  }
})

import { subscribePoll } from './eventData'

const validPoll = {
  id: POLL_ID,
  kind: 'poll',
  question: 'Préférence ?',
  options: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  status: 'live',
  show_results: true,
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  mockState.onStatus = null
  mockState.pollFetchCalls = 0
  mockState.votesFetchCalls = 0
  mockState.pollRow = validPoll
  mockState.voteRows = [{ option_id: 'a' }, { option_id: 'a' }, { option_id: 'b' }]
  mockState.removed = []
})

describe('subscribePoll — résilience', () => {
  it('resynchronise poll + résultats à chaque connexion du canal', async () => {
    const onPoll = vi.fn()
    const onResults = vi.fn()
    const sub = subscribePoll(POLL_ID, onPoll, onResults)

    mockState.onStatus?.('SUBSCRIBED')
    await flush()
    expect(mockState.pollFetchCalls).toBe(1)
    expect(onPoll).toHaveBeenCalledWith(expect.objectContaining({ status: 'live', showResults: true }))
    expect(onResults).toHaveBeenLastCalledWith({ a: 2, b: 1 })

    // Reconnexion : nouveau fetch (récupère les votes manqués pendant la coupure).
    mockState.onStatus?.('CHANNEL_ERROR')
    mockState.onStatus?.('SUBSCRIBED')
    await flush()
    expect(mockState.pollFetchCalls).toBe(2)
    expect(mockState.votesFetchCalls).toBe(2)
    sub.unsubscribe()
  })

  it('n’émet rien sur erreur de canal seule (mode dégradé)', async () => {
    const onPoll = vi.fn()
    const onResults = vi.fn()
    const sub = subscribePoll(POLL_ID, onPoll, onResults)

    mockState.onStatus?.('CHANNEL_ERROR')
    await flush()
    expect(onPoll).not.toHaveBeenCalled()
    expect(onResults).not.toHaveBeenCalled()
    sub.unsubscribe()
  })

  it('plus aucune émission après unsubscribe (fetch en vol compris)', async () => {
    const onPoll = vi.fn()
    const onResults = vi.fn()
    const sub = subscribePoll(POLL_ID, onPoll, onResults)
    mockState.onStatus?.('SUBSCRIBED')
    sub.unsubscribe() // avant résolution du fetch
    await flush()
    expect(onPoll).not.toHaveBeenCalled()
    expect(onResults).not.toHaveBeenCalled()
    expect(mockState.removed).toHaveLength(1)
  })
})
