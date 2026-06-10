# panel-facilitator

Outil web de gestion d'écran temps réel pour tables rondes design : une régie pilote depuis une tablette (IR) ce qui s'affiche sur l'écran projeté (EP) — modes, overlays (questions, sondages, votes, définitions), bandeau sponsors.

**Documents de référence — à lire avant toute feature :**
- `PRD.md` — spécification produit complète (v1.1, décisions arbitrées §11)
- `PLAN.md` — stack, architecture, modèle de données, sprints (validé avant code)
- `screens maquettes/` — maquettes iPad de l'IR (vue Gestion, modales 3s, barre d'état)

## Architecture

App unique Vite, 4 surfaces = 4 groupes de routes lazy-loadées :

```
src/routes/screen     EP — écran public 1920×1080, lecture seule  → /screen/{slug}?k={token}
src/routes/control    IR — régie/animateur tablette, PIN          → /control/{slug}
src/routes/admin      Backoffice configuration, Supabase Auth     → /admin
src/routes/audience   Formulaire mobile QR (questions + votes)    → /q/{slug}
src/shared            Types, Zod, machine à états, priorités overlay
src/realtime          Abstraction Supabase (subscribe, mutations RPC, presence)
supabase/             Migrations SQL, seed, config locale
```

**Tech stack :** React 19 + Vite + TypeScript, Tailwind CSS, Framer Motion, Supabase (Postgres + Realtime + Storage + Auth — **local en dev** via CLI/Docker, cloud plus tard).

**Flux temps réel :** action IR → RPC → UPDATE `screen_state` (source de vérité) → `postgres_changes` → EP. Reconnexion = re-fetch `screen_state`.

## Commandes clés

```bash
pnpm install              # dépendances
pnpm dev                  # dev server Vite (toutes les surfaces)
pnpm test                 # tests (Vitest)
pnpm lint                 # ESLint
pnpm build                # build production
supabase start            # stack Supabase locale (Docker requis)
supabase stop             # arrêt de la stack locale
supabase db reset         # rejoue migrations + seed (local uniquement)
```

(Scaffolding Sprint 0 — vérifier ces commandes après init.)

## Conventions

- Code, identifiants, noms de fichiers en **anglais** ; UI et commentaires métier en **français** (produit FR-only V1)
- Machine à états et règles de priorité overlay (`sondage/vote > question > définition`) vivent dans `src/shared` — jamais dupliquées dans les routes
- Tout accès Supabase passe par `src/realtime` — pas d'import `supabase-js` ailleurs
- Commits : Conventional Commits en français (`feat:`, `fix:`, `docs:`…)
- `CHANGELOG.md` mis à jour à chaque sprint avec les décisions prises
- Commentaire d'architecture en tête de chaque fichier structurant

## Contraintes (non négociables — issues du PRD)

- L'EP n'affiche JAMAIS : scrollbar, UI de contrôle, indicateur de reconnexion visible
- Les questions audience ne s'affichent JAMAIS automatiquement sur l'EP — validation régie obligatoire
- Un seul overlay actif à la fois ; lancer un sondage/vote ferme l'overlay courant
- Sondage : résultats en temps réel sur l'EP pendant le vote. Vote (versus) : résultats masqués pendant le vote, affichés uniquement à la clôture
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
