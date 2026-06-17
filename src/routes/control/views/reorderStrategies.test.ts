import { describe, expect, it } from 'vitest'
import { computePollOrder } from './reorderStrategies'
import type { Poll } from '../../../shared/types'

const poll = (id: string, kind: Poll['kind']): Poll => ({
  id,
  kind,
  question: id,
  options: [],
  status: 'draft',
  showResults: false,
})

const polls: Poll[] = [
  poll('p1', 'poll'),
  poll('p2', 'poll'),
  poll('v1', 'versus'),
  poll('v2', 'versus'),
]

describe('computePollOrder', () => {
  it('réordonne les sondages, recolle les votes après', () => {
    expect(computePollOrder(polls, 'poll', ['p2', 'p1'])).toEqual(['p2', 'p1', 'v1', 'v2'])
  })

  it('réordonne les votes, recolle les sondages avant', () => {
    expect(computePollOrder(polls, 'versus', ['v2', 'v1'])).toEqual(['p1', 'p2', 'v2', 'v1'])
  })

  it('inclut les archivés du même kind via les ids fournis (ordre complet)', () => {
    const withArchived = [...polls, poll('p3', 'poll')]
    expect(computePollOrder(withArchived, 'poll', ['p1', 'p2', 'p3'])).toEqual([
      'p1',
      'p2',
      'p3',
      'v1',
      'v2',
    ])
  })

  it('ne perd aucun autre poll même si le kind réordonné est vide', () => {
    expect(computePollOrder(polls, 'poll', [])).toEqual(['v1', 'v2'])
  })
})
