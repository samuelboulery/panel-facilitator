// Tests de la séquence de slides INTRO (PRD 5.3) :
// asso (optionnelle) → titre → animateur → speakers individuels → grille récap.
import { describe, it, expect } from 'vitest'
import { buildIntroSlides, clampIntroIndex } from './introSlides'
import type { EventPublic, Speaker } from './types'

const event: EventPublic = {
  id: 'e1',
  slug: 'demo',
  title: 'Table ronde',
  subtitle: null,
  edition: '2026',
  eventDate: null,
  startAt: null,
  closingMessage: null,
  assoSlideEnabled: false,
  assoContent: null,
  qrUrl: null,
  sponsorScrollSpeed: 30,
  brandingProfileId: null,
}

const speaker = (id: string, opts: Partial<Speaker> = {}): Speaker => ({
  id,
  firstName: `P${id}`,
  lastName: `N${id}`,
  title: null,
  company: null,
  bio: null,
  photoUrl: null,
  isHost: false,
  gender: null,
  sortOrder: 0,
  hidden: false,
  ...opts,
})

describe('buildIntroSlides', () => {
  it('séquence nominale : titre → animateur → speakers → grille', () => {
    const host = speaker('h', { isHost: true })
    const slides = buildIntroSlides(event, [host, speaker('a'), speaker('b')])
    expect(slides.map((s) => s.kind)).toEqual(['title', 'host', 'speaker', 'speaker', 'grid'])
  })

  it('inclut la slide asso en tête si activée', () => {
    const withAsso = { ...event, assoSlideEnabled: true }
    const slides = buildIntroSlides(withAsso, [speaker('a')])
    expect(slides[0].kind).toBe('asso')
  })

  it('omet l’animateur s’il n’y en a pas', () => {
    const slides = buildIntroSlides(event, [speaker('a')])
    expect(slides.map((s) => s.kind)).toEqual(['title', 'speaker', 'grid'])
  })

  it('exclut les speakers masqués (désistement, PRD 5.3.4)', () => {
    const slides = buildIntroSlides(event, [
      speaker('a'),
      speaker('b', { hidden: true }),
      speaker('c'),
    ])
    const speakerSlides = slides.filter((s) => s.kind === 'speaker')
    expect(speakerSlides).toHaveLength(2)
    expect(speakerSlides.map((s) => s.speaker?.id)).toEqual(['a', 'c'])
  })

  it('pas de grille ni de slides speakers si aucun speaker', () => {
    const slides = buildIntroSlides(event, [])
    expect(slides.map((s) => s.kind)).toEqual(['title'])
  })

  it('chaque slide porte un label pour la navigation IR', () => {
    const slides = buildIntroSlides(event, [speaker('a', { firstName: 'Léa', lastName: 'B' })])
    expect(slides.every((s) => s.label.length > 0)).toBe(true)
    expect(slides.find((s) => s.kind === 'speaker')?.label).toContain('Léa')
  })
})

describe('clampIntroIndex', () => {
  it('borne l’index dans [0, longueur-1]', () => {
    expect(clampIntroIndex(-2, 4)).toBe(0)
    expect(clampIntroIndex(2, 4)).toBe(2)
    expect(clampIntroIndex(9, 4)).toBe(3)
    expect(clampIntroIndex(0, 0)).toBe(0)
  })
})
