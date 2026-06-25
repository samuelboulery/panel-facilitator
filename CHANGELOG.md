# CHANGELOG

## Refonte régie — carrousel unifié, états in-place, notes par le haut (25 juin 2026)

### Livré

- **Carrousel unique = le deck** (`DeckCarousel`) : fusion des anciennes vues Slides + Gestion. La slide « dynamique » affiche le dashboard de gestion ; les slides « fixes » affichent l'aperçu EP. Navigation au drag sur le fond + clic en bordure (slides en peek) + clavier ←/→ ; chaque déplacement pilote l'EP via la machine à états (inchangée).
- **Bandeau d'état bas supprimé** (`StatusBar` retiré). Ses fonctions sont relogées : horloge, timer manuel (renommé « Restant »), toggle QR dans la card **Infos** du dashboard ; navigation dans le carrousel.
- **États « en cours » in-place** : l'élément actif passe en fond accent / texte blanc à sa place. Définition = barre de progression jusqu'à l'auto-fermeture (12 s) puis disparaît (la chip active reste visible le temps de l'overlay). Sondage/vote = bouton « Arrêter / Révéler / Retirer » in-card. Question affichée = bouton « Retirer ».
- **Notes par le haut** (`NotesPanel`) : poignée centrée en haut, tap ou drag pour ouvrir/fermer (remplace l'onglet Notes du pager). Éditeur inchangé.
- **Modale « Modifier la position des cards »** (`CardPositionModal`) : remplace l'édition inline. Aperçu de la scène dynamique avec cartes draggables (`MovableCard` → `screen_state.cardPositions`, inchangé). Déclenchée depuis la slide dynamique (bas-droite) et sous les slides fixes.

### Notes

- Aucune modification de l'EP (`src/routes/screen`) ni du schéma DB. Aucune nouvelle dépendance.

## Revue des définitions générées (23 juin 2026)

### Livré

- **Modale de revue à la génération LLM (IR)** : générer une définition depuis `/control` ouvre une modale présentant terme + définition, avec trois actions — « Annuler la définition » (suppression), « Valider la définition » (ajout à la liste), « Valider et lancer » (validation + projection immédiate sur l'EP, sans la confirmation 3 s habituelle, la modale faisant office de confirmation).
- **Brouillons invisibles avant validation** : la génération IR insère un brouillon `validated=false`, filtré de la liste régie tant que la régie n'a pas validé. Le rate-limit DeepSeek reste adossé aux inserts de `definitions` (pas de trou anti-abus). Le backoffice (JWT) continue d'insérer des définitions prêtes (`validated=true`).
- Nouvelle colonne `definitions.validated` (default true → lignes existantes visibles) ; RPC `control_validate_definition` et `control_delete_definition`.

### Setup requis

- `supabase db reset` (migrations `20260623000001_definition_validated.sql` et `20260623000002_service_role_grants.sql`) + redéploiement de l'Edge Function `define-term`. La migration grants restaure les privilèges baseline de `service_role` (absents dans la stack), sans lesquels la fonction échoue en 42501 (premier appel direct via client service_role).

## Contenu dynamique — site, flèches, deck navigable (18 juin 2026)

### Livré (3 retours utilisateur)

- **Type de contenu « Site web »** (`embed_site`) : iframe vers toute URL https valide, en plus de Google Slides / Figma / image / vidéo. La whitelist de domaines (`src/shared/embed.ts`) ne s'applique qu'aux embeds Slides/Figma ; le site est saisi par l'organisateur au backoffice (frontière de confiance = admin, jamais public). Sandbox `allow-scripts allow-same-origin allow-presentation`.
- **Navigation clavier ←/→** du carrousel régie (vue Slides) : pilote l'EP comme les boutons/swipe existants. Gaté sur la vue active, n'intercepte pas la frappe dans un champ de saisie — cible télécommande de présentation / clavier BT iPad.
- **Deck Google Slides navigable depuis la régie** : nouvelle colonne `screen_state.content_step` (la régie ne peut pas piloter un iframe cross-origin en JS → l'index passe par l'état partagé, l'EP le traduit en URL `/embed?slide=N`). Rendu sans flash par cross-fade 2 iframes (`GSlidesDeck.tsx`). Boutons ◀/▶ sur la carte du deck dans l'IR. Changer de contenu réinitialise l'index à 0.

### Limites connues

- Le contrôle interne ne vaut que pour Google Slides (positionnable par URL). Figma / site quelconque ne sont pas pilotables à distance (cross-origin). Le saut à la slide N dépend du paramètre d'URL honoré par le lecteur `/embed` Google — encodé en un seul endroit (`embed.ts`) pour ajustement.

### Setup requis

- `supabase db reset` (migrations `20260618000003_content_site.sql`, `20260618000004_content_step.sql`).

## Repasse IR (11 juin 2026)

### Livré (9 retours utilisateur)

- **Vue Slides = carrousel de présentation** (maquette iPad 15) : deck unifié Attente → slides intro → contenus dynamiques → Outro ; grande preview centrale, cartes adjacentes en peek, swipe/tap/flèches pilotent l'EP (position dérivée de `screen_state`). Masquage speaker sur la carte.
- **Navigation par swipe pur** : plus d'onglets — les vues adjacentes dépassent (~4 %) de chaque côté comme poignées (tap sur le peek = naviguer).
- **« + » sur tous les blocs** : questions (création inline → `control_create_question`), définitions (génération LLM), sondages/votes (existant).
- **Définitions par LLM** : Edge Function `define-term` (**DeepSeek `deepseek-chat`**, clé API côté serveur uniquement, auth PIN avant tout appel, `verify_jwt` désactivé car auth applicative). Saisir un mot → définition courte FR insérée → chip en temps réel (table `definitions` ajoutée au realtime).
- **Définitions à usage unique** : `used` marqué au lancement, la chip disparaît (RPC `control_set_definition_used`).
- **Timer Durée manuel** : `screen_state.timer_started_at`, bouton ▶/■ sur la case Durée de la barre d'état.
- **Questions posées retirées** de la liste (statut `done` filtré).
- **Section « EP » supprimée** de la barre d'état (latence/presence IR nettoyées).
- **Drag & drop persisté** : listes questions/sondages/votes (Reorder framer-motion + handle ⠿), chips définitions (grid-reorder maison par proximité de centres) ; RPC `control_reorder` avec whitelist de tables.

### Fixes de revue

- **Course mode/index intro corrigée** : entrer en intro envoyait l'index seulement côté client optimiste (le serveur gardait l'ancien) et SlidesView aurait émis 2 RPCs concurrents — désormais `setIntroMode` = un seul patch `{mode, intro_slide_index}` ; `goToIntroSlide` valide en 2 temps, mute en 1 RPC.
- ReorderableList : ordre final lu via ref (jamais de closure périmée) ; chips : refs filtrées sur la liste courante, distance de drag réinitialisée ; reorder polls inclut les archivés (sort_order cohérents).

### Setup requis

- `supabase/functions/.env` : `DEEPSEEK_API_KEY=sk-…` (local) ; en cloud : `supabase secrets set DEEPSEEK_API_KEY=…`. Lancer la fonction localement : `supabase functions serve define-term --env-file supabase/functions/.env` (laisser tourner — `supabase start` seul ne sert pas les Edge Functions).

## Sprint 5 — Qualité & résilience (10 juin 2026)

### Livré

- **Checklist pré-événement** (`src/shared/checklist`, TDD 10 tests) : règles pures à 3 niveaux (bloquant / dégradé / info) — heure de début, QR, asso sans contenu, speakers/photos manquants, URLs embed invalides, sondages < 2 options… Section « Checklist ✓ » dans le backoffice avec état « Prêt pour l'événement ».
- **Tests de résilience** (4 tests, client Supabase mocké) : resynchronisation complète à chaque reconnexion, aucun changement d'état émis sur coupure (mode dégradé), payloads realtime corrompus ignorés (jamais d'état invalide sur l'EP), aucune émission après désabonnement.
- **`TESTING.md`** : matrice des critères d'acceptance PRD §10 (15/15 couverts), scénario manuel de test de coupure réseau à rejouer avant chaque événement, commandes de lancement local.

### Vérification

- 55/55 tests, build, lint verts.

## Sprint 4 — Backoffice (10 juin 2026)

### Livré

- **Auth organisateur** (Supabase Auth, login uniquement — compte créé hors app ; dev : `admin@demo.local`/`demo1234`). Mono-événement V1 : premier événement chargé, création guidée sinon (PIN initial 0000 à changer).
- **Section Événement** : titre/sous-titre/édition/date, heure de début du timer (conversion locale↔UTC correcte au réaffichage), message de clôture, URL du QR, vitesse du bandeau sponsors, **slide asso** (toggle + contenu, activation bloquée si nom vide — PRD 5.3.1), **PIN de session** (RPC `admin_set_pin`, hash bcrypt serveur, jamais en clair), URLs des 3 surfaces avec bouton copier (dont l'URL EP avec son token).
- **Sections CRUD** (composant générique `ListSection` : ajout, édition inline, suppression, réordonnancement ▲▼) : speakers (photo, animateur·rice), sponsors (logo), contenus (Google Slides/Figma/image/vidéo), définitions, questions préparées, sondages, votes (options une par ligne, toggle résultats).
- **Upload d'images** : redimensionnement + conversion **WebP** côté client (canvas, 800 px photos / 400 px logos), bucket Storage `media` (lecture publique, écriture authentifiée), cache 1 an.
- **Migrations** : bucket + policies + `admin_set_pin`, `admin_create_event`.

### Vérification

- 41/41 tests, build, lint verts. Smoke : RLS bloque inserts anonymes, `admin_set_pin` refuse l'anonyme et le PIN changé est accepté par `control_auth`, CRUD authentifié OK.
- Revue : 7 fixes (try/finally bitmap, flag watchAuth, **réaffichage start_at UTC→local**, exclusion clés serveur en update, préservation des ids d'options — votes liés par `option_id`, log upload, validation type fichier).

## Sprint 3 — Intro / Outro / Audience (10 juin 2026)

### Livré

- **Séquence intro complète** (`src/shared/introSlides`, TDD 7 tests) : asso (optionnelle) → titre → animateur → speakers individuels → grille récap. Partagée EP/IR — une seule source de vérité de la séquence.
- **EP mode INTRO** : slides web générées des données (slide personne avec photo/bio, grille animée en cascade), transitions latérales, index borné.
- **IR navigation intro** : précédent/suivant, saut direct, position n/total, **masquage d'un speaker en live** (désistement, PRD 5.3.4) avec restauration — nouvelle migration `control_set_speaker_hidden` + table `speakers` en realtime (l'EP recalcule séquence et bandeaux instantanément).
- **Surface audience `/q/{slug}`** (mobile) : formulaire de question (300 car., compteur, prénom optionnel, confirmation), panneau de vote qui apparaît dès qu'un sondage/vote passe live (versus = 2 gros boutons), fingerprint anti double-vote, états votés persistés.

### Décisions

- Masquage speaker mid-intro : EP et IR clampent l'index avec la même fonction pure sur les mêmes données temps réel — désync transitoire < 1 s acceptée (mono-opérateur), pas de duplication de la logique de séquence en SQL.
- localStorage encapsulé (navigation privée Safari) : le vote fonctionne sans persistance, le serveur déduplique par fingerprint.
- Fingerprint réinitialisable en vidant le localStorage = limite V1 documentée (D5).

### Vérification

- 41/41 tests, build, lint verts. Smoke RPC : question soumise, 301 caractères rejetés, double vote ignoré serveur, masquage speaker aller-retour.
- Revue : 4 fixes (validation Zod `asso_content`, vote optimiste avant await, localStorage safe, reset erreur formulaire).

## Sprint 2 — Interface de Régie (10 juin 2026)

### Livré

- **Structure 3 vues slideables** (Slides | Gestion par défaut | Notes) : onglets + swipe horizontal (`dragDirectionLock` pour ne pas voler le scroll vertical), design maquettes (fond lavande, cartes blanches, accent bleu).
- **Vue Gestion** : définitions en chips, questions (préparées + audience temps réel, badge « Public », épingler/archiver, état « posée »), sondages et votes en sections séparées, création ad hoc (+), toggles bandeau speakers / QR, « Fermer l'overlay ».
- **Modale de lancement 3 s** (maquettes Frames 149–151) : envoi auto à 0, « Envoyer » immédiat, « Annuler » bloque ; compte à rebours insensible aux re-renders parent (votes temps réel).
- **Barre d'état noire** (maquettes iPad 13/17/18) : overlay actif, mode courant, heure, durée (depuis `start_at`), pastille connexion EP (presence) + latence (ping 10 s) ; extension sondage live avec barres de résultats + compteur + « Arrêter le sondage » ; rappel question active + « Retirer la question ».
- **Vue Slides** : aperçu état EP (mode, contenu, overlay, toggles), navigation 4 modes, sélection du contenu principal.
- **Vue Notes** : autosave debounce 1 s + flush au démontage (aucune frappe perdue).
- **useControlState** : validation locale par la machine à états AVANT chaque RPC (un conflit de priorité est refusé instantanément avec toast), mise à jour optimiste, l'état serveur fait foi via realtime.
- **Migration `control_set_question_pinned`** (badge Pin des maquettes).

### Décisions

- Lancement de sondage : `status='live'` confirmé PUIS overlay — jamais d'overlay sur un sondage resté draft.
- « Durée » de la barre d'état = temps écoulé depuis `events.start_at` (00h00 avant le début).
- Pas de protection anti-écrasement optimiste/realtime (mono-opérateur V1, l'état serveur s'auto-corrige au prochain événement).

### Vérification

- 34/34 tests, build, lint verts. Chaîne RPC → `screen_state` validée sur stack locale (attente→dynamique→attente).
- Revue : 3 fixes appliqués (deps modale → ref, ordre live→overlay, flush notes au démontage) ; « double-confirm race » écarté (JS mono-thread).

## Sprint 1 — Écran Public (10 juin 2026)

### Livré

- **Direction design « affiche de scène »** : fond encre (projection salle sombre), display Archivo étiré très gras, micro-labels IBM Plex Mono (écho à la barre d'état des maquettes IR), accent indigo électrique, grain + vignette CSS statiques.
- **Mode ATTENTE** : compte à rebours monumental (tabulaire, arrêt à zéro → « C'est parti ! »), rotation des fiches speakers (6 s, statique si un seul), titre + édition.
- **Mode DYNAMIQUE** : contenu principal (embed Google Slides / Figma whitelistés, image, vidéo) ; scène calme intentionnelle si aucun contenu ou URL invalide (jamais d'erreur projetée). Overlays « lower-third » animés : question (attribution public/préparée), définition (style dictionnaire), sondage/vote.
- **Sondages vs votes (D2)** : `poll` = barres de résultats temps réel pendant le vote (agrégation client de `poll_votes` en realtime) ; `versus` = split A/B sans chiffres pendant le vote, révélation à la clôture ; `show_results=false` = chiffres cachés même clôturé ; « Aucun vote » géré.
- **Bandeaux** : sponsors permanent sur les 4 modes (marquee CSS pur, absent si aucun sponsor), speakers masquable (haut, compacté > 4), QR code masquable (caché si URL invalide).
- **Modes INTRO/OUTRO basiques** : slide titre / remerciements + logos grand format (séquence intro complète au Sprint 3).
- **Couche données** : `fetchEventData` (1 chargement au boot EP), schémas Zod par table, `subscribePoll` avec resync à chaque reconnexion.

### Décisions

- `qrcode.react` ajouté (validé) : génération SVG locale, zéro réseau pendant le live.
- Embeds : whitelist stricte `docs.google.com` / `figma.com` dans `toEmbedUrl` — URL hors domaine = fallback, jamais d'iframe arbitraire. `sandbox` avec `allow-scripts` assumé (Slides/Figma sont des apps JS ; cross-origin, `allow-same-origin` ne donne accès qu'à leur propre origine).
- Fonts Google (Archivo, IBM Plex Mono) chargées au boot avec fallback système — risque réseau limité au chargement initial, jamais en cours de live.

### Vérification

- 34/34 tests verts (machine à états + helpers embed), build OK, lint OK.
- Revue de code : 2 fixes appliqués (reset rotation speakers sur changement de liste, fallback initiales avatar) ; faux positifs documentés (setters React stables, sandbox iframe requis).

## Sprint 0 — Fondations (10 juin 2026)

### Livré

- **Scaffolding** : app Vite unique (React 19 + TypeScript + Tailwind CSS 4), ESLint, Vitest. Routes lazy : `/screen/:slug`, `/control/:slug`, `/admin`, `/q/:slug` — code-splitting vérifié (un chunk par surface).
- **Schéma Supabase** : migration initiale — 10 tables, RLS sur tout, vue `events_public` (masque `pin_hash`/`screen_token`), 9 RPCs `SECURITY DEFINER` (auth PIN, mutations régie, soumission questions, votes), publication realtime (`screen_state`, `polls`, `poll_votes`, `questions`), trigger de création auto `screen_state`/`notes`. Seed démo (event `demo`, PIN `1234`).
- **Machine à états** (`src/shared`) : réducteur pur immuable, 25 tests (TDD red→green). Modes, priorité overlay (sondage/vote > question > définition), fermeture auto en sortie de mode dynamique, toggles bandeau/QR.
- **Abstraction realtime** (`src/realtime`) : client isolé (frontière ESLint `no-restricted-imports`), subscribe `screen_state` avec re-fetch à chaque (re)connexion — mode dégradé : l'EP garde son dernier état rendu, aucun indicateur visible audience. Mutations 100 % RPC. Presence (l'IR voit si l'EP est connecté).
- **Écran PIN de l'IR** : pavé numérique tactile, verrou 30 s après 5 échecs, session en sessionStorage validée par Zod.

### Décisions prises en cours de sprint

- **Erreurs RPC sanitisées** : log détaillé console, message générique UI (pas de fuite d'erreurs Postgres) — suite revue de code.
- **PIN conservé en sessionStorage (compromis V1 assumé)** : les RPCs exigent le PIN à chaque mutation ; exiger une re-saisie après refresh en plein live serait pire pour la régie. Portée : onglet courant uniquement. À revisiter si V2 multi-opérateurs (vrais tokens de session côté serveur).
- **Navigation libre entre modes** : la régie peut revenir en arrière (erreur de manipulation) — le PRD n'impose que le déroulé nominal.
- **Transition de mode ferme l'overlay actif** : un overlay n'a de sens qu'en mode dynamique.

### En attente

- `supabase start` non exécuté (Docker arrêté) — la migration sera validée au premier lancement local.

### Vérification

- 25/25 tests verts, build OK (chunks séparés par surface), lint OK.
- Revue de code : 0 CRITICAL ; 5 HIGH corrigés (gestion d'erreurs async, sanitisation messages, validation sessionStorage, verrou PIN) ; PIN/sessionStorage documenté comme compromis.
