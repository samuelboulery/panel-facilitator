# CHANGELOG

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
