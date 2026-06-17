// Règle D2 (PRD 5.4.7 / 5.4.8) — décision de rendu de l'overlay sondage/vote,
// extraite en fonction pure pour être testée dans src/shared (jamais dupliquée
// dans les routes) :
//   poll   → barres de résultats EN TEMPS RÉEL dès le live
//   versus → résultats masqués pendant le vote (split A/B), révélés à la clôture
//   show_results=false → chiffres cachés même clôturé (« Merci pour vos votes ! »)
import type { Poll } from './types'

export type PollView =
  | { kind: 'thanks' } // clôturé, résultats volontairement masqués
  | { kind: 'no-votes' } // clôturé, résultats visibles mais aucun vote
  | { kind: 'bars' } // barres de résultats (ResultBars)
  | { kind: 'versus-live' } // split A/B sans chiffres (suspense)
  | { kind: 'none' } // rien à afficher (ex. poll en draft)

/**
 * Décide ce que l'EP affiche dans l'overlay sondage/vote selon la règle D2.
 * Reproduit à l'identique la priorité des branches du rendu d'origine.
 */
export function pollView(
  status: Poll['status'],
  kind: Poll['kind'],
  showResults: boolean,
  totalVotes: number,
): PollView {
  const isLive = status === 'live'
  const isClosed = status === 'closed'

  const showBars =
    (kind === 'poll' && (isLive || (isClosed && showResults))) ||
    (kind === 'versus' && isClosed && showResults)
  const hiddenAtClose = isClosed && !showResults
  const noVotes = isClosed && totalVotes === 0

  if (hiddenAtClose) return { kind: 'thanks' }
  if (noVotes && showBars) return { kind: 'no-votes' }
  if (showBars) return { kind: 'bars' }
  if (kind === 'versus' && isLive) return { kind: 'versus-live' }
  return { kind: 'none' }
}
