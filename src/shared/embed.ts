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
 * Construit l'URL `/embed` Google Slides positionnée sur la slide `step` (0-based).
 * SEUL endroit qui encode step→URL (cf. plan, Risque #1) : si le lecteur /embed
 * n'honore pas ce paramètre, c'est ici qu'on l'ajuste (`#slide=N`, etc.).
 * Google Slides attend une position 1-based.
 */
function gslidesEmbedUrl(basePath: string, step: number): string {
  const slide = Math.max(0, step) + 1
  return `https://docs.google.com${basePath}/embed?start=false&loop=false&slide=${slide}`
}

/**
 * Transforme l'URL configurée en backoffice vers sa forme embeddable.
 * Retourne null si l'URL est invalide pour le kind donné (fallback EP).
 * `step` ne concerne que `embed_gslides` (navigation interne du deck) ; ignoré ailleurs.
 */
export function toEmbedUrl(kind: ContentKind, raw: string, step = 0): string | null {
  if (!isValidHttpUrl(raw)) return null
  const url = new URL(raw)

  switch (kind) {
    case 'embed_gslides': {
      if (url.hostname !== 'docs.google.com') return null
      // /presentation/d/{id}/(edit|embed|…) → on extrait toujours le chemin de base
      // pour reconstruire l'embed avec la slide demandée.
      const match = url.pathname.match(/^(\/presentation\/d\/[^/]+)/)
      if (!match) return null
      return gslidesEmbedUrl(match[1], step)
    }

    case 'embed_figma': {
      if (url.hostname !== 'www.figma.com' && url.hostname !== 'figma.com') return null
      if (url.pathname === '/embed') return raw
      return `https://www.figma.com/embed?embed_host=panel-facilitator&url=${encodeURIComponent(raw)}`
    }

    // Site web : toute URL https valide (saisie admin de confiance, jamais public).
    case 'embed_site':
    case 'image':
    case 'video':
      return raw
  }
}
