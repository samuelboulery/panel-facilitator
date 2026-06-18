import { describe, it, expect } from 'vitest'
import { roleLabel } from './roleLabel'

describe('roleLabel', () => {
  it('genre l\'hôte selon le genre', () => {
    expect(roleLabel(true, 'f')).toBe('Animatrice')
    expect(roleLabel(true, 'm')).toBe('Animateur')
    expect(roleLabel(true, null)).toBe('Animateur·rice')
  })

  it('genre le panel selon le genre', () => {
    expect(roleLabel(false, 'f')).toBe('Intervenante')
    expect(roleLabel(false, 'm')).toBe('Intervenant')
    expect(roleLabel(false, null)).toBe('Intervenant·e')
  })
})
