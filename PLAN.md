# PLAN.md — Outil de gestion de tables rondes design

> Étape 1 du développement — à valider avant tout code.
> Sources : `PRD.md` v1.1, `prompt.md`, maquettes IR (`screens maquettes/`).

---

## 1. Stack choisie

| Couche | Choix | Version |
|---|---|---|
| Frontend (4 surfaces) | React + Vite + TypeScript | React 19, Vite 6 |
| Styling / animations | Tailwind CSS + Framer Motion | v4 / v11 |
| Backend / DB / Realtime | Supabase (PostgreSQL + Realtime + Auth + Storage) | cloud |
| Monorepo | pnpm workspaces | — |
| Hébergement fronts | Vercel (un projet par app) | — |

### Justification : React + Supabase Realtime vs alternatives

**Supabase Realtime retenu** contre Node.js + Socket.io :

- **Moins de surface à construire et opérer.** Socket.io exige un serveur custom (hébergement, scaling, reconnexion, persistance d'état à écrire soi-même). Supabase fournit DB + canal temps réel + storage images + auth dans un service managé unique.
- **La persistance d'état est le cœur du besoin.** Le mode dégradé exige que l'EP retrouve son état après coupure. Avec Socket.io il faudrait une couche de persistance séparée (Redis/Postgres) ; avec Supabase, l'état EST une ligne Postgres et le canal `postgres_changes` notifie les changements — source de vérité et transport unifiés.
- **Latence.** Round-trip mutation → notification Realtime : 200–500 ms mesurés typiquement, très en-dessous de l'exigence < 2 s.
- **Presence intégrée** : l'indicateur "EP connecté" dans l'IR (exigence P2) est natif via Supabase Presence.
- **Reconnexion automatique** intégrée au client `supabase-js` (backoff exponentiel), couvre l'exigence < 30 s.

**Vite SPA retenu** contre Next.js : les 4 surfaces sont des SPA temps réel pures, aucun besoin SSR/SEO. Vite = build plus simple, dev server plus rapide, zéro serveur applicatif.

---

## 2. Architecture des surfaces

**Monorepo pnpm** (conforme à la structure recommandée du prompt) :

```
/
├── PLAN.md / CHANGELOG.md
├── apps/
│   ├── screen/        ← EP — 1920×1080, lecture seule, route /screen/:slug
│   ├── control/       ← IR — tablette, PIN, routes /control/:slug
│   ├── admin/         ← Backoffice — PC, auth Supabase
│   └── audience/      ← Formulaire mobile QR (questions + votes) — voir décision D1
├── packages/
│   ├── shared/        ← Types TS, schémas Zod, machine à états, constantes
│   └── realtime/      ← Abstraction canal (subscribe état, mutations, presence)
└── supabase/          ← Migrations SQL, seed, config
```

- **4 apps, pas 3** : le PRD arbitre « système de vote interne » et « formulaire de questions interne » (Q1/Q2). Il faut donc une surface mobile pour l'audience — ajoutée en `apps/audience` (décision D1).
- Chaque app est déployée indépendamment sur Vercel ; `packages/*` sont buildés en interne (pas de publication npm).
- `packages/realtime` isole supabase-js : si on devait migrer vers Socket.io un jour, seul ce package change.

---

## 3. Modèle de données (PostgreSQL / Supabase)

```
events
├─ id uuid PK, slug text unique, title, subtitle, edition, event_date
├─ start_at timestamptz            ← cible du timer ATTENTE
├─ closing_message text            ← OUTRO
├─ asso_slide_enabled bool, asso_content jsonb   ← slide asso optionnelle
├─ qr_url text                     ← destination QR (formulaire audience)
├─ sponsor_scroll_speed int
├─ pin_hash text                   ← PIN IR, haché (jamais en clair)
└─ screen_token text unique        ← clé d'association EP (voir §4)

speakers      (id, event_id FK, first_name, last_name, title, company, bio,
               photo_url, is_host bool, sort_order, hidden bool)
               -- is_host=true ⇒ animateur. hidden ⇒ masqué live depuis l'IR (désistement)

sponsors      (id, event_id FK, name, logo_url, sort_order)

contents      (id, event_id FK, kind enum[embed_gslides|embed_figma|image|video],
               url, label, sort_order)
               -- contenus principaux du mode DYNAMIQUE

questions     (id, event_id FK, text varchar(300), source enum[prepared|audience],
               status enum[pending|displayed|done|archived],
               author_name text null, pinned bool, sort_order, created_at)

polls         (id, event_id FK, kind enum[poll|versus], question text,
               options jsonb [{id, label}],
               status enum[draft|live|closed|archived],
               show_results bool, created_live bool)
               -- "votes" du PRD = kind='versus' (décision D2)

poll_votes    (id, poll_id FK, option_id, voter_fingerprint text, created_at,
               UNIQUE(poll_id, voter_fingerprint))   ← anti double-vote

definitions   (id, event_id FK, term, definition, sort_order)

notes         (event_id PK/FK, content_md text, updated_at)

screen_state  (event_id PK/FK,                       ← SOURCE DE VÉRITÉ EP
               mode enum[attente|intro|dynamique|outro],
               intro_slide_index int,
               main_content_id FK contents null,
               overlay jsonb null,    -- {type: question|poll|definition, id}
               speakers_banner_visible bool,
               qr_visible bool,
               updated_at)
```

**Règle de priorité des overlays** (Q5 : sondage/vote > question > définition) : appliquée côté `packages/shared` (machine à états) ET par contrainte applicative dans les mutations — lancer un sondage ferme automatiquement l'overlay question/définition actif (un seul overlay dans `screen_state.overlay`).

**Sécurité (RLS)** :
- Lecture publique des données nécessaires à l'EP/audience filtrée par event (slug/token).
- Écritures live (mutations IR, soumission questions, votes) via **RPC Postgres** validant le contexte (token écran, PIN session, fingerprint).
- Backoffice : Supabase Auth (un compte organisateur) — politiques RLS `authenticated`.

---

## 4. Mécanisme de canal EP / IR

**Proposition : association par URL uniques dérivées de l'événement + état persistant en DB.**

| Surface | Association | Auth |
|---|---|---|
| EP | `/screen/{slug}?k={screen_token}` — URL ouverte une fois sur le PC de projection | token long aléatoire (lecture seule) |
| IR | `/control/{slug}` → saisie **PIN** à l'ouverture | PIN haché vérifié par RPC, session en localStorage |
| Audience | `/q/{slug}` (URL du QR code) | aucune — fingerprint anonyme |

**Synchronisation :**

1. Toute action IR = **UPDATE de `screen_state`** (via RPC authentifiée par session PIN).
2. L'EP est abonné au canal Realtime `postgres_changes` sur sa ligne `screen_state` (+ `polls`/`poll_votes` quand un sondage est live pour les résultats temps réel).
3. **Au (re)chargement ou à la reconnexion, l'EP re-fetch `screen_state`** → l'état courant est toujours reconstructible. C'est ce qui rend le mode dégradé trivial : connexion perdue ⇒ l'EP garde son dernier état rendu ; connexion retrouvée ⇒ re-fetch + resubscribe.
4. **Presence** sur canal `event:{id}` : l'IR voit si l'EP est connecté + heartbeat → indicateur latence/connexion (exigence P2).

**Justification vs alternatives :**
- *Code de session à taper sur l'EP* : rejeté — l'écran de projection n'a souvent pas de clavier accessible, et le PRD interdit toute UI de contrôle sur l'EP.
- *Broadcast éphémère seul (sans état DB)* : rejeté — un EP qui se recharge perdrait l'état ; incompatible avec le mode dégradé exigé.
- *URL unique + état DB* : zéro friction le jour J (un favori sur le PC de régie), état toujours récupérable, token révocable en backoffice.

---

## 5. Plan de développement — sprints

Ordre aligné sur les priorités P1→P4 du prompt ; chaque sprint livre de la valeur testable.

### Sprint 0 — Fondations (débloque tout)
- Scaffolding monorepo pnpm (4 apps Vite + 2 packages + supabase/)
- Migrations initiales (schéma §3), seed de démo
- `packages/shared` : types, schémas Zod, **machine à états** ATTENTE→INTRO→DYNAMIQUE→OUTRO + règles de priorité overlay
- `packages/realtime` : client, subscribe `screen_state`, mutations RPC, presence
- Routing des 4 apps, écran PIN de l'IR
- Mode dégradé EP (conservation dernier état + re-fetch au resubscribe)

### Sprint 1 — Écran Public (P1)
- Mode ATTENTE : timer (arrêt à zéro), rotation fiches speakers, bandeau sponsors (caché si vide)
- Mode DYNAMIQUE : contenu principal (embed Google Slides/Figma, image, vidéo) + overlays question / sondage / vote / définition avec résultats temps réel
- Bandeau speakers permanent + QR code (masquables) ; fallbacks (avatar générique, QR caché si URL invalide)
- Contraintes : 1920×1080, aucune scrollbar, aucune UI de contrôle, animations 60fps (Framer Motion)

### Sprint 2 — Interface de Régie (P2)
- Structure 3 vues slideables (Slides | **Gestion** par défaut | Notes) — conforme maquettes iPad
- Vue Gestion : sections Définitions (chips), Questions (préparées + audience, pin/archive), Sondages, Votes ; **modale de lancement avec compte à rebours 3 s annulable** (maquettes Frame 149–151)
- Barre d'état basse : overlay actif, mode courant, heure, durée session, résultats sondage live + « Arrêter le sondage » (maquette iPad 18)
- Vue Slides : navigation modes + aperçu état EP ; Vue Notes : éditeur Markdown sauvegardé en continu
- Indicateur connexion EP + latence ; toggles bandeau speakers / QR
- Création sondage/vote ad hoc depuis l'IR

### Sprint 3 — Intro / Outro + Audience (P3)
- Slides web INTRO générées des données (asso optionnelle → titre → animateur → speakers 1/n → grille récap), navigation manuelle depuis l'IR, masquage speaker désisté
- OUTRO : message clôture + logos sponsors grand format
- `apps/audience` : formulaire questions (300 car. max) + interface de vote sondage, fingerprint anti double-vote

### Sprint 4 — Backoffice (P4)
- Auth organisateur, CRUD : événement, speakers/animateur, sponsors, questions préparées, sondages/votes, définitions, contenus embed, QR url, toggle asso, PIN session
- Upload images → Supabase Storage, conversion WebP

### Sprint 5 — Qualité & résilience
- Tests reconnexion EP < 30 s ; checklist pré-événement backoffice (contenus manquants)
- Optimisation images, audit fallbacks, tests des critères d'acceptance du PRD §10

---

## 6. Décisions d'architecture autonomes

| # | Décision | Justification |
|---|---|---|
| **D1** | App `apps/audience` ajoutée (4ᵉ surface, route `/q/{slug}`) | Q1/Q2 arbitrent vote + questions en interne ⇒ il faut une surface mobile audience. Non listée dans la structure du prompt mais impliquée par le PRD. |
| **D2** | Votes = `polls` avec `kind='versus'` | PRD 5.4.8 : « fonctionne comme un sondage simplifié à deux options ». Même mécanique d'états, de votes et de priorité ⇒ une seule table, deux rendus. |
| **D3** | État EP = ligne `screen_state` en DB (DB-first), pas broadcast éphémère | Mode dégradé et reload EP gratuits ; source de vérité unique ; l'IR peut afficher l'état réel. |
| **D4** | PIN haché en DB, vérifié par RPC ; jamais transmis/stocké en clair | Sécurité basique exigible même pour un PIN 4–6 chiffres. |
| **D5** | Anti double-vote par fingerprint UUID en localStorage | Pas d'auth audience en V1 ; suffisant pour un usage événementiel bienveillant. Documenté comme limite connue. |
| **D6** | Compte à rebours « Envoyer 3 s » annulable côté IR avant mutation | Présent dans les maquettes (Frames 149–151) ; filet de sécurité anti-erreur de la régie. |
| **D7** | Backoffice protégé par Supabase Auth (1 compte organisateur) | Le PIN ne protège que l'IR live ; le backoffice contient toute la donnée ⇒ vraie auth. Multi-utilisateurs hors scope V1. |
| **D8** | Timer ATTENTE calculé côté client depuis `events.start_at` | Pas de tick serveur ; précision suffisante, zéro trafic réseau. |
| **D9** | Résultats sondage temps réel via subscribe `poll_votes` + agrégation client | Volume V1 faible (une salle) ; évite triggers/vues matérialisées prématurés. |
| **D10** | Vercel pour les 4 fronts, Supabase cloud pour le backend | Zéro ops, previews par PR, conforme aux recommandations PRD §7.3. |

---

## Validation attendue

Points à confirmer avant Sprint 0 :
1. La 4ᵉ app `audience` (D1) vous convient ?
2. Fusion votes/sondages en une table (D2) OK ?
3. Supabase cloud (compte existant ?) ou instance locale pour le dev ?
