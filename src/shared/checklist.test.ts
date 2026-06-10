// Tests de la checklist pré-événement (Étape 4 du prompt) — détection du
// contenu manquant avant le jour J.
import { describe, it, expect } from 'vitest'
import { buildChecklist } from './checklist'
import type { Content, Definition, EventPublic, Poll, Speaker, Sponsor } from './types'

const event: EventPublic = {
  id: 'e1',
  slug: 'demo',
  title: 'Table ronde',
  subtitle: null,
  edition: null,
  eventDate: null,
  startAt: '2026-06-10T18:00:00Z',
  closingMessage: 'Merci !',
  assoSlideEnabled: false,
  assoContent: null,
  qrUrl: 'https://example.com/q/demo',
  sponsorScrollSpeed: 30,
}

const host: Speaker = {
  id: 'h1', firstName: 'Camille', lastName: 'D', title: null, company: null,
  bio: null, photoUrl: 'https://x/p.webp', isHost: true, sortOrder: 0, hidden: false,
}
const speaker: Speaker = { ...host, id: 's1', isHost: false }
const sponsor: Sponsor = { id: 'sp1', name: 'X', logoUrl: 'https://x/l.webp', sortOrder: 0 }
const content: Content = { id: 'c1', kind: 'embed_gslides', url: 'https://docs.google.com/presentation/d/abc/edit', label: 'Deck', sortOrder: 0 }
const definition: Definition = { id: 'd1', term: 'LLM', definition: 'x', sortOrder: 0 }
const poll: Poll = { id: 'p1', kind: 'poll', question: 'Q ?', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], status: 'draft', showResults: true }

const full = {
  event,
  speakers: [host, speaker],
  sponsors: [sponsor],
  contents: [content],
  definitions: [definition],
  polls: [poll],
}

describe('buildChecklist', () => {
  it('événement complet : aucune erreur ni avertissement', () => {
    const issues = buildChecklist(full)
    expect(issues.filter((i) => i.level !== 'info')).toHaveLength(0)
  })

  it('erreur si heure de début manquante (timer attente mort)', () => {
    const issues = buildChecklist({ ...full, event: { ...event, startAt: null } })
    expect(issues.some((i) => i.level === 'error' && /début/i.test(i.message))).toBe(true)
  })

  it('erreur si aucun speaker visible', () => {
    const issues = buildChecklist({ ...full, speakers: [host] })
    expect(issues.some((i) => i.level === 'error' && /speaker/i.test(i.message))).toBe(true)
  })

  it('avertissement si pas d’animateur·rice', () => {
    const issues = buildChecklist({ ...full, speakers: [speaker] })
    expect(issues.some((i) => i.level === 'warning' && /animateur/i.test(i.message))).toBe(true)
  })

  it('avertissement par photo de speaker manquante', () => {
    const issues = buildChecklist({
      ...full,
      speakers: [host, { ...speaker, photoUrl: null }],
    })
    expect(issues.some((i) => i.level === 'warning' && /photo/i.test(i.message))).toBe(true)
  })

  it('avertissement si QR URL manquante ou invalide', () => {
    expect(
      buildChecklist({ ...full, event: { ...event, qrUrl: null } }).some(
        (i) => i.level === 'warning' && /qr/i.test(i.message),
      ),
    ).toBe(true)
    expect(
      buildChecklist({ ...full, event: { ...event, qrUrl: 'pas-une-url' } }).some(
        (i) => i.level === 'warning' && /qr/i.test(i.message),
      ),
    ).toBe(true)
  })

  it('erreur si un contenu embed a une URL invalide pour son type', () => {
    const bad: Content = { ...content, url: 'https://evil.com/deck' }
    const issues = buildChecklist({ ...full, contents: [bad] })
    expect(issues.some((i) => i.level === 'error' && /Deck/.test(i.message))).toBe(true)
  })

  it('erreur si slide asso activée sans contenu (PRD 5.3.1)', () => {
    const issues = buildChecklist({
      ...full,
      event: { ...event, assoSlideEnabled: true, assoContent: null },
    })
    expect(issues.some((i) => i.level === 'error' && /asso/i.test(i.message))).toBe(true)
  })

  it('erreur si un sondage a moins de 2 options', () => {
    const issues = buildChecklist({
      ...full,
      polls: [{ ...poll, options: [{ id: 'a', label: 'A' }] }],
    })
    expect(issues.some((i) => i.level === 'error' && /option/i.test(i.message))).toBe(true)
  })

  it('infos (non bloquantes) si aucun sponsor / définition / message de clôture', () => {
    const issues = buildChecklist({
      ...full,
      sponsors: [],
      definitions: [],
      event: { ...event, closingMessage: null },
    })
    expect(issues.filter((i) => i.level === 'info').length).toBeGreaterThanOrEqual(3)
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(0)
  })
})
