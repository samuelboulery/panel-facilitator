// Tests des helpers d'embed (PRD 5.4.1) — transformation des URLs Google
// Slides / Figma vers leurs formes embeddables, validation des URLs.
import { describe, it, expect } from 'vitest'
import { toEmbedUrl, isValidHttpUrl } from './embed'

describe('isValidHttpUrl', () => {
  it('accepte http(s) uniquement', () => {
    expect(isValidHttpUrl('https://example.com')).toBe(true)
    expect(isValidHttpUrl('http://example.com/x?y=1')).toBe(true)
    expect(isValidHttpUrl('ftp://example.com')).toBe(false)
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isValidHttpUrl('pas une url')).toBe(false)
    expect(isValidHttpUrl('')).toBe(false)
  })
})

describe('toEmbedUrl — Google Slides', () => {
  it('convertit une URL /edit en /embed', () => {
    const url =
      'https://docs.google.com/presentation/d/1AbC_dEf/edit#slide=id.p1'
    expect(toEmbedUrl('embed_gslides', url)).toBe(
      'https://docs.google.com/presentation/d/1AbC_dEf/embed?start=false&loop=false',
    )
  })

  it('conserve une URL déjà en /embed', () => {
    const url = 'https://docs.google.com/presentation/d/1AbC/embed?start=true'
    expect(toEmbedUrl('embed_gslides', url)).toBe(url)
  })

  it('rejette une URL non-Google Slides', () => {
    expect(toEmbedUrl('embed_gslides', 'https://evil.com/presentation/d/x/edit')).toBeNull()
  })
})

describe('toEmbedUrl — Figma', () => {
  it('enveloppe une URL de fichier Figma dans l’embed officiel', () => {
    const url = 'https://www.figma.com/proto/AbC123/Maquette?node-id=1-2'
    expect(toEmbedUrl('embed_figma', url)).toBe(
      `https://www.figma.com/embed?embed_host=panel-facilitator&url=${encodeURIComponent(url)}`,
    )
  })

  it('conserve une URL Figma déjà en /embed', () => {
    const url = 'https://www.figma.com/embed?embed_host=x&url=y'
    expect(toEmbedUrl('embed_figma', url)).toBe(url)
  })

  it('rejette une URL non-Figma', () => {
    expect(toEmbedUrl('embed_figma', 'https://evil.com/proto/x')).toBeNull()
  })
})

describe('toEmbedUrl — image et vidéo', () => {
  it('laisse passer toute URL http(s) valide', () => {
    expect(toEmbedUrl('image', 'https://cdn.x.com/a.webp')).toBe('https://cdn.x.com/a.webp')
    expect(toEmbedUrl('video', 'https://cdn.x.com/a.mp4')).toBe('https://cdn.x.com/a.mp4')
  })

  it('rejette les URLs invalides', () => {
    expect(toEmbedUrl('image', 'javascript:alert(1)')).toBeNull()
    expect(toEmbedUrl('video', '')).toBeNull()
  })
})
