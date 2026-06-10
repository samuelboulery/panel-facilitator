# panel-facilitator — Règles permanentes

Ces règles s'appliquent à chaque session. Aucune exception.

## Interdictions absolues

- Ne jamais coder avant validation de `PLAN.md` (Étape 1 du prompt) ou hors du sprint en cours
- Ne jamais rouvrir les décisions arbitrées du PRD §11 (Q1–Q11) ni les décisions D1–D10 du PLAN.md validé
- Ne jamais afficher sur l'EP : scrollbar, UI de contrôle, indicateur de reconnexion, question audience non validée par la régie
- Ne jamais stocker le PIN en clair (hash en DB, vérification par RPC)
- Ne jamais importer `supabase-js` directement dans une app — toujours via `packages/realtime`
- Ne pas installer de dépendance sans demander

## Organisation

- Logique partagée (types, machine à états, priorité overlays) → `packages/shared` uniquement
- Une seule source de vérité d'état live : table `screen_state`
- Migrations SQL versionnées dans `supabase/migrations/` — jamais de modification directe du schéma

## Style

- Code anglais, UI française
- Conventional Commits en français
- Animations : CSS transitions / Framer Motion, cible 60fps, pas de manipulation DOM lourde
- Images : WebP, dimensions définies

## Tests

- Cible 80 % de couverture sur `packages/shared` (machine à états, priorités) — logique critique
- Tests de résilience obligatoires Sprint 5 : reconnexion EP, mode dégradé
