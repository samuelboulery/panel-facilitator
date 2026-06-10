# panel-facilitator

Outil web de gestion d'écran temps réel pour tables rondes design : une régie pilote depuis une tablette (IR) ce qui s'affiche sur l'écran projeté (EP) — modes, overlays (questions, sondages, votes, définitions), bandeau sponsors.

**Documents de référence — à lire avant toute feature :**
- `PRD.md` — spécification produit complète (v1.1, décisions arbitrées §11)
- `PLAN.md` — stack, architecture, modèle de données, sprints (validé avant code)
- `screens maquettes/` — maquettes iPad de l'IR (vue Gestion, modales 3s, barre d'état)

## Architecture

4 surfaces, monorepo pnpm :

```
apps/screen     EP — écran public 1920×1080, lecture seule  → /screen/{slug}?k={token}
apps/control    IR — régie/animateur tablette, PIN          → /control/{slug}
apps/admin      Backoffice configuration, Supabase Auth     → /admin
apps/audience   Formulaire mobile QR (questions + votes)    → /q/{slug}
packages/shared    Types, Zod, machine à états, priorités overlay
packages/realtime  Abstraction Supabase (subscribe, mutations RPC, presence)
supabase/          Migrations SQL, seed
```

**Tech stack :** React 19 + Vite + TypeScript, Tailwind CSS, Framer Motion, Supabase (Postgres + Realtime + Storage + Auth), pnpm workspaces.

**Flux temps réel :** action IR → RPC → UPDATE `screen_state` (source de vérité) → `postgres_changes` → EP. Reconnexion = re-fetch `screen_state`.

## Commandes clés

```bash
pnpm install              # dépendances workspace
pnpm dev                  # toutes les apps en dev
pnpm --filter screen dev  # une seule app (screen|control|admin|audience)
pnpm test                 # tests (Vitest)
pnpm lint                 # ESLint
pnpm build                # build toutes les apps
supabase db reset         # rejoue migrations + seed (local uniquement)
```

(Scaffolding Sprint 0 — vérifier ces commandes après init.)

## Conventions

- Code, identifiants, noms de fichiers en **anglais** ; UI et commentaires métier en **français** (produit FR-only V1)
- Machine à états et règles de priorité overlay (`sondage/vote > question > définition`) vivent dans `packages/shared` — jamais dupliquées dans les apps
- Tout accès Supabase passe par `packages/realtime` — pas de `supabase-js` direct dans les apps
- Commits : Conventional Commits en français (`feat:`, `fix:`, `docs:`…)
- `CHANGELOG.md` mis à jour à chaque sprint avec les décisions prises
- Commentaire d'architecture en tête de chaque fichier structurant

## Contraintes (non négociables — issues du PRD)

- L'EP n'affiche JAMAIS : scrollbar, UI de contrôle, indicateur de reconnexion visible
- Les questions audience ne s'affichent JAMAIS automatiquement sur l'EP — validation régie obligatoire
- Un seul overlay actif à la fois ; lancer un sondage/vote ferme l'overlay courant
- Bandeau sponsors visible sur les 4 modes, caché si aucun sponsor (pas d'espace vide)
- Latence action IR → EP < 2 s ; reconnexion EP < 30 s ; EP figé sur dernier état si offline
- Les décisions arbitrées du PRD §11 (Q1–Q11) sont fermées — ne pas les rouvrir
- Pas de placeholder UX générique — designs intentionnels, contexte événementiel

## graphify

Graphe de connaissance dans `graphify-out/` (non versionné — reconstruit localement).

**Avant d'explorer le codebase :** lire `graphify-out/GRAPH_REPORT.md`, puis `/graphify query "<question>"` pour les questions transverses.

**Après changements :**
- Commits code → hook post-commit relance l'extraction AST automatiquement
- Docs / ADRs / nouvelles features → lancer `/graphify . --update` manuellement
