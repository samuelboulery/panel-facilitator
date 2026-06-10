# TESTING — Vérification des critères d'acceptance (PRD §10)

## Tests automatisés

`pnpm test` — 55 tests :
- **Machine à états** (25) : transitions, priorité overlays, toggles, immutabilité
- **Helpers embed** (9) : whitelist Google Slides / Figma, URLs invalides
- **Séquence intro** (7) : asso optionnelle, speakers masqués, clamp d'index
- **Checklist pré-événement** (10) : règles error/warning/info
- **Résilience realtime** (4) : resync à la reconnexion, état conservé sur coupure, payloads corrompus ignorés, pas d'émission après unsubscribe

## Matrice d'acceptance PRD §10

| Critère | Couverture | Statut |
|---|---|---|
| Sync EP/IR < 2 s | UPDATE `screen_state` → `postgres_changes` (~200–500 ms mesurés en local) ; latence affichée dans l'IR | ✅ vérifié local, à mesurer sur réseau salle |
| Bandeau sponsors sur 4 modes, absent si vide | `SponsorBanner` monté hors transitions de mode ; `null` si liste vide | ✅ code + visuel |
| Navigation slides INTRO (incl. grille) | `buildIntroSlides` + nav IR ; tests unitaires | ✅ tests |
| Question fermée restaure le contenu | Overlay indépendant du contenu principal (`screen_state.overlay` seul changé) | ✅ fonctionnel |
| Sondage lancé/clôturé/résultats affichés ou cachés | `setPollStatus` + `show_results` ; rendu conditionnel testé visuellement | ✅ fonctionnel |
| Sondage créé en live | `AdHocPollModal` → `control_create_poll` | ✅ fonctionnel |
| Vote binaire lancé/clôturé/résultats | `kind='versus'` : split pendant le vote, barres à la clôture | ✅ fonctionnel |
| Définition affichée/fermée sans impact | Overlay type `definition`, priorité la plus basse | ✅ tests machine |
| Priorité overlays (sondage ferme question) | `applyAction` SHOW_OVERLAY — tests dédiés | ✅ tests |
| Masquage bandeau speakers / QR depuis l'IR | Toggles vue Gestion → `screen_state` | ✅ fonctionnel |
| Timer attente s'arrête à zéro | `useCountdown` (`Math.max(0, …)`) | ✅ code |
| Slide asso OFF supprime la slide ; activation bloquée si vide | `buildIntroSlides` (test) + blocage formulaire + checklist | ✅ tests + UI |
| PIN : IR inaccessible sans PIN correct | `control_auth` (hash bcrypt) ; smoke testé bon/mauvais PIN | ✅ smoke |
| Reconnexion EP < 30 s | Backoff supabase-js plafonné à 10 s + resync au `SUBSCRIBED` (test unitaire) | ✅ test + manuel ci-dessous |
| Mode dégradé : EP figé sur dernier état, pas d'écran blanc | Aucune émission sur erreur canal (test) ; aucun indicateur visible audience | ✅ test |

## Test manuel de résilience (à rejouer avant chaque événement)

1. `supabase start` + `pnpm dev`. Ouvrir EP (`/screen/demo?k=…`) et IR (`/control/demo`).
2. Passer en mode dynamique, afficher une définition.
3. **Couper le réseau de la machine EP** (Wi-Fi off) 20 s.
   - Attendu : l'EP reste sur la définition affichée, AUCUN indicateur visible ; la pastille EP de l'IR passe au rouge.
4. Pendant la coupure, fermer la définition et lancer un sondage depuis l'IR.
5. **Rétablir le réseau.**
   - Attendu : en < 30 s, l'EP affiche le sondage (état re-fetché, pas seulement le dernier événement) ; pastille IR verte.
6. Recharger l'EP (F5) : il revient directement sur l'état courant.

## Lancement local

```bash
supabase start && supabase db reset   # stack + schéma + seed
pnpm dev
# EP   : http://localhost:5173/screen/demo?k=demo-screen-token-dev-only
# IR   : http://localhost:5173/control/demo   (PIN 1234)
# Q    : http://localhost:5173/q/demo
# Admin: http://localhost:5173/admin          (admin@demo.local / demo1234 — à créer, voir README seed)
```
