# Contribuer à panel-facilitator

Guide d'onboarding et de collaboration. Les **conventions de code** vivent dans
[`CLAUDE.md`](./CLAUDE.md) et [`.claude/rules/`](./.claude/rules/) — ce fichier ne les recopie pas,
il décrit le **workflow d'équipe**.

## Setup initial

Prérequis : Node 22, [pnpm](https://pnpm.io/), [Docker](https://www.docker.com/) (pour Supabase local), [Supabase CLI](https://supabase.com/docs/guides/local-development).

```bash
pnpm install
supabase start          # démarre Postgres + Realtime + Storage + Auth en local (Docker)
cp .env.example .env.local
# Renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY avec les valeurs
# affichées par `supabase start`
pnpm dev                # serveur Vite, toutes les surfaces
```

Activer le hook local (optionnel mais recommandé — lance lint + tests avant chaque push) :

```bash
git config core.hooksPath .githooks
```

## Workflow quotidien

1. `git switch main && git pull`
2. Créer une branche : `feat/<surface>-<sujet>` (ou `fix/`, `chore/`, `docs/`)
   ex. `feat/ir-carrousel`, `fix/admin-upload`
3. Coder + tests (TDD sur `src/shared`, cible 80 %)
4. `pnpm lint && pnpm test && pnpm build` en local
5. Ouvrir une PR vers `main` → review du binôme → **squash merge**
6. Une PR = une feature. Rebase sur `main` avant merge.

`main` est protégé : pas de push direct, la CI (`lint` + `test` + `build`) doit passer,
1 review d'approbation requise.

## Découpage du travail — par surface

Chacun possède des routes distinctes pour minimiser les conflits :

| Surface | Routes | Owner |
|---|---|---|
| EP — écran public | `src/routes/screen` | Floriane |
| IR — régie tablette | `src/routes/control` | Floriane |
| Backoffice | `src/routes/admin` | Samuel |
| Audience mobile | `src/routes/audience` | Samuel |

**Zones partagées** (toute modif = review attentive de l'autre, car les 4 surfaces en dépendent) :
- `src/shared` — types, machine à états, priorités overlay
- `src/realtime` — abstraction Supabase
- `supabase/migrations/` — voir règle anti-collision ci-dessous

## Migrations Supabase (anti-collision)

Les migrations sont ordonnées par timestamp → deux migrations créées en parallèle peuvent entrer en conflit.

- **Toujours** créer via `supabase migration new <nom>` (timestamp auto, jamais à la main)
- **Une seule PR touche le schéma à la fois** — préviens le binôme avant de créer une migration
- Conflit de timestamp (deux migrations parallèles) : la PR mergée **en second** rebase et renomme son fichier avec un timestamp postérieur
- **Jamais** éditer une migration déjà mergée → toujours une nouvelle migration corrective
- Après avoir pull une migration du binôme : `supabase db reset` (local) pour rejouer migrations + seed

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) en français :
`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`.
Mettre à jour `CHANGELOG.md` à chaque sprint.
