// Architecture : helpers d'embed du mode DYNAMIQUE (PRD 5.4.1).
// Whitelist stricte des domaines embeddables — une URL invalide retourne null
// et l'EP affiche son fallback (jamais d'iframe vers un domaine arbitraire).
import type { ContentKind } from './types'

export function isValidHttpUrl(raw: string): boolean {
  if (!raw) return false
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Transforme l'URL configurée en backoffice vers sa forme embeddable.
 * Retourne null si l'URL est invalide pour le kind donné (fallback EP).
 */
export function toEmbedUrl(kind: ContentKind, raw: string): string | null {
  if (!isValidHttpUrl(raw)) return null
  const url = new URL(raw)

  switch (kind) {
    case 'embed_gslides': {
      if (url.hostname !== 'docs.google.com') return null
      if (url.pathname.includes('/embed')) return raw
      // /presentation/d/{id}/edit… → /presentation/d/{id}/embed
      const match = url.pathname.match(/^(\/presentation\/d\/[^/]+)/)
      if (!match) return null
      return `https://docs.google.com${match[1]}/embed?start=false&loop=false`
    }

    case 'embed_figma': {
      if (url.hostname !== 'www.figma.com' && url.hostname !== 'figma.com') return null
      if (url.pathname === '/embed') return raw
      return `https://www.figma.com/embed?embed_host=panel-facilitator&url=${encodeURIComponent(raw)}`
    }

    case 'image':
    case 'video':
      return raw
  }
}
