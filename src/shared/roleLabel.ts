// Libellé de rôle genré, partagé EP / IR / backoffice. Le genre est optionnel :
// sans valeur, repli sur la forme inclusive (PRD — produit FR). Animateur·rice
// pour l'hôte, Intervenant·e pour le panel.
export type Gender = 'f' | 'm' | null

export function roleLabel(isHost: boolean, gender: Gender): string {
  if (isHost) {
    return gender === 'f' ? 'Animatrice' : gender === 'm' ? 'Animateur' : 'Animateur·rice'
  }
  return gender === 'f' ? 'Intervenante' : gender === 'm' ? 'Intervenant' : 'Intervenant·e'
}
