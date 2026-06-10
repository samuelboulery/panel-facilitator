<context>
Tu vas construire un outil web de gestion d'écran en temps réel pour des tables rondes design.

L'outil est composé de trois surfaces :

1. **Écran Public (EP)** — projeté dans la salle via HDMI/beamer. Lecture seule.
   Reçoit les commandes en temps réel depuis l'IR. Toujours visible. Aucune interaction directe.

2. **Interface de Régie / Animateur (IR)** — tablette ou PC. Surface de contrôle principale.
   La régie et l'animateur utilisent la même interface. La régie voit potentiellement plus de détails.
   L'interface a trois vues slideables (navigation horizontale) :
   - Vue "Slides" : changer de mode (Attente → Intro → Dynamique → Outro)
   - Vue "Gestion" (centre, vue par défaut) : piloter les éléments actifs (questions, sondages, définitions, votes)
   - Vue "Notes" : notes de l'animateur pour la session en cours
   L'interface est protégée par un code PIN de session.

3. **Backoffice de configuration** — accès PC avant l'événement.
   Permet de préparer tout le contenu : speakers, sponsors, questions, sondages, définitions, événement.
   Les transitions et décisions live restent dans l'IR.

L'Écran Public opère dans 4 modes globaux gérés par la régie :
- **ATTENTE** : timer de décompte, fiches speakers en rotation, bandeau sponsors
- **INTRO** : slides dynamiques web (asso optionnelle → titre table ronde → animateur → speakers individuels → grille récap)
- **DYNAMIQUE** : mode principal de la table ronde. Permet d'afficher à l'instant T :
  - Un embed Google Slides ou Figma (via lien configuré)
  - Une image, une vidéo
  - Un sondage avec vote et résultats temps réel
  - Un vote (ex : "Hugo vs Vincent")
  - Une question préparée ou soumise par l'audience via QR code
  - Une définition de terme
  - Le bandeau speakers permanent
  - Le QR code pour les questions audience (masquable par la régie)
- **OUTRO** : écran de clôture avec message configurable et logos sponsors

Contraintes permanentes sur l'EP :
- Bandeau sponsors toujours visible (bas d'écran), masqué si aucun sponsor configuré
- En mode DYNAMIQUE : QR code permanent (coin fixe), masquable par la régie
- En mode DYNAMIQUE : bandeau speakers permanent, masquable pour les slides plein-écran
- Résolution cible : 1920×1080. Pas de responsive sur l'EP.
- Animations fluides 60fps. Délai EP < 2s après action régie.

Questions arbitrées (décisions produit déjà prises) :
- Votes et sondages : système interne (pas de Slido/Mentimeter)
- Questions audience : formulaire interne lié au QR code
- Format slides dynamiques : embed Google Slides ou Figma via URL configurée en backoffice
- Slides intro/outro : pages web générées dynamiquement depuis les données de l'événement
- Si plusieurs overlays potentiels simultanés : sondage/vote prioritaire sur les questions
- Si aucun sponsor : bandeau caché
- Canal EP/IR : implémente la solution la plus robuste (code de session, URL unique ou autre)
- Vue grille speakers incluse en fin d'intro
- Q5 priorité overlay : sondage/vote > question > définition
</context>

<instructions>
## Étape 1 — Audit du PRD et clarifications

Lis attentivement le PRD fourni (tables-rondes-design-prd.md) et les maquettes de l'IR (tablette).
Avant de coder, produis un document `PLAN.md` contenant :

1. **Stack choisie** avec justification (évalue React + Supabase Realtime vs alternatives)
2. **Architecture des surfaces** (monorepo ou multi-repo, routing, séparation EP/IR/Backoffice)
3. **Modèle de données** — schéma des entités principales (Event, Speaker, Sponsor, Slide, Question, Sondage, Vote, Session)
4. **Mécanisme de canal EP/IR** — comment les deux surfaces s'associent (propose et justifie)
5. **Plan de développement** — séquence de sprints priorisée, en commençant par ce qui débloque le plus de valeur
6. **Décisions d'architecture** prises de manière autonome, listées clairement avec leur justification

Attends une validation ou des ajustements sur ce PLAN.md avant de démarrer le code.

## Étape 2 — Scaffolding et fondations

Une fois le plan validé :

1. Initialise le projet avec la stack retenue
2. Configure le système de synchronisation temps réel (canal événement, authentification IR par PIN)
3. Crée la structure de routing : `/screen` (EP), `/control` (IR), `/admin` (Backoffice)
4. Mets en place le schéma de base de données et les migrations initiales
5. Implémente la machine à états globaux (ATTENTE → INTRO → DYNAMIQUE → OUTRO)
6. Configure le mode dégradé (EP reste sur dernier état si connexion perdue)

## Étape 3 — Développement des surfaces

Développe dans cet ordre de priorité :

**P1 — Écran Public (EP)**
- Mode ATTENTE complet (timer, speakers, bandeau sponsors)
- Mode DYNAMIQUE : affichage des overlays (question, sondage/vote, définition, embed Figma/Google Slides)
- Bandeau speakers + QR code (masquables)
- Bandeau sponsors permanent

**P2 — Interface de Régie (IR)**
- Structure 3 vues slideables (Slides | Gestion | Notes)
- Vue Gestion : listes définitions, questions, sondages, votes — avec actions de déclenchement
- Vue Slides : navigation entre modes + aperçu de l'état EP courant
- Vue Notes : éditeur de notes session (Markdown basique)
- Indicateur de latence et état connexion EP

**P3 — Modes Intro et Outro**
- Slides web dynamiques générées depuis les données backoffice
- Navigation manuelle slide par slide dans l'IR

**P4 — Backoffice de configuration**
- Gestion événement (titre, date, édition, message clôture)
- Gestion speakers et animateur (photo, nom, titre, société, bio)
- Gestion sponsors (logo, ordre, vitesse défilement)
- Gestion questions préparées, sondages, votes, définitions
- Embed URL (Google Slides / Figma) pour le mode Dynamique
- Gestion QR code (URL destination)
- Toggle slide asso (optionnelle)
- Configuration PIN de session

## Étape 4 — Qualité et résilience

- Mode dégradé EP testé (reconnexion automatique < 30s)
- Fallbacks visuels : avatar générique si photo manquante, QR code masqué si URL invalide
- Checklist pré-événement dans le backoffice (contenu manquant détecté)
- Optimisation images (WebP, dimensions définies)
- Indicateurs d'état dans l'IR (connexion EP, slide courante, overlay actif)
</instructions>

<output_format>
Pour chaque étape, produis :
- Le code fonctionnel dans la structure de fichiers appropriée
- Un commentaire d'architecture en tête de chaque fichier structurant
- Un `CHANGELOG.md` mis à jour à chaque sprint avec les décisions prises

Format des fichiers livrables attendus :
```
/
├── PLAN.md               ← Étape 1, à valider avant de coder
├── CHANGELOG.md          ← Mis à jour en continu
├── apps/
│   ├── screen/           ← Écran Public (EP)
│   ├── control/          ← Interface de Régie / Animateur (IR)
│   └── admin/            ← Backoffice de configuration
├── packages/
│   ├── shared/           ← Types, constantes, machine à états
│   └── realtime/         ← Abstraction synchronisation temps réel
└── supabase/             ← Migrations et schéma (ou équivalent)
```

Si la stack retenue diffère de cette structure, propose l'équivalent adapté dans PLAN.md.
</output_format>

<restrictions>
- Ne commence jamais à coder avant que PLAN.md soit produit et validé
- Ne prends pas de décision silencieuse sur les questions arbitrées listées dans <context> — elles sont fermées
- Pour toute question ouverte non listée, prends une décision autonome et documente-la dans PLAN.md
- L'EP ne doit jamais afficher de scrollbar, d'UI de contrôle, ou d'indicateur de reconnexion visible pour l'audience
- Les questions audience ne s'affichent jamais automatiquement sur l'EP — toujours validation régie
- Ne génère pas de placeholder UX générique — les designs doivent être intentionnels et adaptés au contexte événementiel
</restrictions>
