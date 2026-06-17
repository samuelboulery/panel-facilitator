import { describe, expect, it } from 'vitest'
import { pollView } from './pollDisplay'

describe('pollView — règle D2', () => {
  describe('poll (sondage) — barres temps réel dès le live', () => {
    it('live → barres immédiates, peu importe show_results', () => {
      expect(pollView('live', 'poll', true, 5).kind).toBe('bars')
      expect(pollView('live', 'poll', false, 5).kind).toBe('bars')
    })

    it('live sans vote → barres quand même (0 %)', () => {
      expect(pollView('live', 'poll', true, 0).kind).toBe('bars')
    })

    it('clôturé + résultats visibles → barres', () => {
      expect(pollView('closed', 'poll', true, 5).kind).toBe('bars')
    })

    it('clôturé + résultats visibles + 0 vote → no-votes', () => {
      expect(pollView('closed', 'poll', true, 0).kind).toBe('no-votes')
    })

    it('clôturé + résultats masqués → thanks (chiffres cachés même clôturé)', () => {
      expect(pollView('closed', 'poll', false, 5).kind).toBe('thanks')
      expect(pollView('closed', 'poll', false, 0).kind).toBe('thanks')
    })
  })

  describe('versus (vote) — résultats masqués pendant le vote', () => {
    it('live → split A/B sans chiffres', () => {
      expect(pollView('live', 'versus', true, 5).kind).toBe('versus-live')
      expect(pollView('live', 'versus', false, 5).kind).toBe('versus-live')
      expect(pollView('live', 'versus', true, 0).kind).toBe('versus-live')
    })

    it('clôturé + résultats visibles → barres révélées', () => {
      expect(pollView('closed', 'versus', true, 5).kind).toBe('bars')
    })

    it('clôturé + résultats visibles + 0 vote → no-votes', () => {
      expect(pollView('closed', 'versus', true, 0).kind).toBe('no-votes')
    })

    it('clôturé + résultats masqués → thanks', () => {
      expect(pollView('closed', 'versus', false, 5).kind).toBe('thanks')
    })
  })

  describe('états non actifs', () => {
    it('draft → rien', () => {
      expect(pollView('draft', 'poll', true, 0).kind).toBe('none')
      expect(pollView('draft', 'versus', true, 0).kind).toBe('none')
    })

    it('archived → rien', () => {
      expect(pollView('archived', 'poll', true, 3).kind).toBe('none')
      expect(pollView('archived', 'versus', true, 3).kind).toBe('none')
    })
  })
})
