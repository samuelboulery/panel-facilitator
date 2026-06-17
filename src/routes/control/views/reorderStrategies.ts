// Sondages et votes partagent la table `polls` : réordonner un seul `kind`
// impose de recoller TOUS les autres (y compris archivés) pour garder des
// sort_order cohérents sur l'ensemble. Logique pure, isolée pour être testée
// (une régression ici corrompt l'ordre persisté — bug déjà rencontré en repasse).
import type { Poll } from '../../../shared/types'

/**
 * Ordre complet de la table `polls` après réordonnancement d'un seul `kind`.
 * Les `ids` (nouvel ordre du kind réordonné) sont recollés aux autres polls :
 * poll → [réordonnés, autres] ; versus → [autres, réordonnés].
 */
export function computePollOrder(polls: Poll[], kind: Poll['kind'], ids: string[]): string[] {
  const others = polls.filter((p) => p.kind !== kind).map((p) => p.id)
  return kind === 'poll' ? [...ids, ...others] : [...others, ...ids]
}
