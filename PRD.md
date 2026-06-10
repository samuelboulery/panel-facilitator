# PRD — Outil de gestion de tables rondes design
**Product Requirements Document — v1.1 | Juin 2026**

| | |
|---|---|
| **Statut** | Draft — V1 scope |
| **Version** | v1.1 — Questions ouvertes arbitrées, mode TABLE RONDE renommé DYNAMIQUE |
| **Audience** | Équipe produit & développement |
| **Domaine** | Événementiel design — Interface temps réel multi-écrans |

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Objectifs produit](#2-objectifs-produit)
3. [Utilisateurs & personas](#3-utilisateurs--personas)
4. [Architecture fonctionnelle](#4-architecture-fonctionnelle)
5. [Features détaillées](#5-features-détaillées)
6. [Flux utilisateur principaux](#6-flux-utilisateur-principaux)
7. [Exigences techniques](#7-exigences-techniques)
8. [Hors scope V1](#8-hors-scope-v1)
9. [Risques & mitigations](#9-risques--mitigations)
10. [Critères d'acceptance](#10-critères-dacceptance)
11. [Questions ouvertes](#11-questions-ouvertes)

---

## 1. Résumé exécutif

### Vision

Créer un outil web de gestion dynamique d'écran pour les tables rondes centrées sur le design. L'outil permet à une régie de piloter en temps réel ce qui est affiché sur un écran projeté devant l'audience : slides statiques, éléments interactifs (questions, sondages, définitions, votes), et bandeau permanent de sponsors.

### Problème résolu

Les tables rondes design souffrent d'un manque d'outils spécialisés : les outils de présentation classiques (PowerPoint, Keynote) ne permettent pas d'injecter des éléments dynamiques à la volée depuis une interface de régie. La régie doit pouvoir gérer l'ordre du jour, les questions d'audience, les sondages et les transitions sans interrompre le déroulé.

### Valeur clé

- Deux surfaces distinctes : écran public projeté + interface de régie/animateur
- Transitions fluides entre modes (attente, intro, dynamique, outro)
- Injection d'éléments dynamiques sans quitter le contexte de l'événement
- Bandeau sponsors persistant sur tout l'écran public

---

## 2. Objectifs produit

| # | Objectif | Métrique de succès | Horizon |
|---|---|---|---|
| O1 | Permettre à une régie de piloter intégralement l'écran public depuis une interface de contrôle séparée | Zéro action nécessitant un accès direct à l'écran projeté pendant l'événement | V1 |
| O2 | Gérer l'intégralité du cycle d'un événement (attente → intro → dynamique → outro) | Passage fluide entre 4 modes sans rechargement visible | V1 |
| O3 | Permettre l'injection d'éléments dynamiques (questions, sondages, définitions, votes) en cours de table ronde | Délai d'affichage < 2 secondes après déclenchement régie | V1 |
| O4 | Garantir la visibilité permanente des sponsors durant tout l'événement | Bandeau présent sur 100% des états de l'écran public (caché si aucun sponsor configuré) | V1 |
| O5 | Permettre une préparation complète des contenus avant l'événement (speakers, questions, sondages, définitions) | 100% du contenu paramétrable hors ligne avant le live | V1 |

---

## 3. Utilisateurs & personas

| Persona | Description | Appareil | Accès |
|---|---|---|---|
| **La Régie** | Technicien ou membre de l'équipe organisatrice. Gère les transitions, les éléments dynamiques et l'ordre du jour en temps réel. Accès complet à l'IR, avec potentiellement plus de détails que l'animateur. | PC ou tablette | Interface de Régie (protégée par PIN) |
| **L'Animateur** | Mène la table ronde. Utilise la même interface que la régie (IR) en lecture et en contrôle partiel. Dispose d'une vue "Notes" dédiée. | Tablette personnelle | Interface de Régie (même surface, accès PIN) |
| **L'Audience** | Participants présents dans la salle. Voit l'écran projeté. Peut soumettre des questions via QR code depuis leur smartphone. | Aucun (projection) + smartphone (QR code) | Écran public uniquement |
| **L'Organisateur** | Prépare l'événement à l'avance : speakers, sponsors, questions, sondages, définitions. | PC (backoffice) | Interface de configuration |

---

## 4. Architecture fonctionnelle

### 4.1 Trois surfaces applicatives

| Surface | Description | Contraintes |
|---|---|---|
| **Écran Public (EP)** | Affiché en projection / HDMI dans la salle. Lecture seule. Reçoit les commandes de la régie via synchronisation temps réel. | Aucune interaction directe possible. Toujours visible. Pas de scrollbar, pas d'UI de contrôle visible. Optimisé 1920×1080. |
| **Interface de Régie / Animateur (IR)** | Utilisée par la régie et l'animateur pour piloter l'EP en temps réel. Trois vues slideables : **Slides** (navigation entre modes) \| **Gestion** (vue centrale par défaut, pilotage des éléments actifs) \| **Notes** (notes de l'animateur). | Protégée par un code PIN de session. Optimisée tactile (tablette). La régie peut voir plus de détails ou d'options que l'animateur selon l'implémentation. |
| **Backoffice de configuration** | Interface de préparation pré-événement. Permet de saisir et configurer tout le contenu : speakers, sponsors, questions, sondages, votes, définitions, paramètres de l'événement, URL d'embed. | Accès PC. Non utilisée en live. |

### 4.2 Machine à états globaux

L'écran public opère dans l'un des 4 modes principaux. La régie déclenche les transitions depuis la vue "Slides" de l'IR.

| Mode | Description | Transition vers | Déclencheur |
|---|---|---|---|
| **ATTENTE** | Affiché avant le début de l'événement. Timer, speakers, sponsors. | INTRO | Régie (manuel) |
| **INTRO** | Présentation de l'asso (optionnelle), de la table ronde, de l'animateur et des speakers. Slides web dynamiques générées depuis les données backoffice. | DYNAMIQUE | Régie (manuel) |
| **DYNAMIQUE** | Mode principal de la table ronde. Affiche à l'instant T ce que la régie active : embed (Google Slides / Figma), image, vidéo, sondage, vote, question, définition. Bandeau speakers et QR code permanents (masquables). | OUTRO | Régie (manuel) |
| **OUTRO** | Écran de clôture avec remerciements et sponsors. | — | — |

> ⚠️ **Note sur les overlays en mode DYNAMIQUE** : Les éléments dynamiques (questions, sondages, votes, définitions) sont affichés en overlay par-dessus le contenu principal (embed ou fond de scène). Ils ne remplacent pas le mode global. En cas de conflit simultané, la priorité est : **sondage/vote > question > définition**.

---

## 5. Features détaillées

### 5.1 Éléments généraux transversaux

#### 5.1.1 Bandeau sponsors / logos permanent

| Champ | Détail |
|---|---|
| **Comportement** | Un bandeau fixe est affiché en bas de l'écran public sur TOUS les modes (attente, intro, dynamique, outro). Il défile ou affiche les logos en rotation. |
| **Déclencheur** | Automatique dès le chargement de l'écran public. Configuré en backoffice avant l'événement. |
| **Écran(s)** | Écran Public uniquement. |
| **États** | Actif en permanence. Non masquable via la régie en V1. |
| **Edge cases** | Si aucun sponsor configuré : bandeau caché (aucun espace vide visible). Si logo trop grand : redimensionnement proportionnel automatique. |
| **Configuration** | Liste de logos (format image WebP), ordre, vitesse de défilement configurable en backoffice. |

#### 5.1.2 Positionnement dynamique

| Champ | Détail |
|---|---|
| **Comportement** | Le layout de l'écran public s'adapte dynamiquement selon le mode et les éléments actifs. En mode DYNAMIQUE, l'ajout d'un overlay (question, sondage, définition) redimensionne ou masque partiellement le contenu principal. |
| **Déclencheur** | Automatique lors d'un changement d'état déclenché par la régie. |
| **Écran(s)** | Écran Public. |
| **Edge cases** | Si plusieurs éléments dynamiques sont potentiellement actifs simultanément, la règle de priorité s'applique : sondage/vote > question > définition. Un seul overlay à la fois. |
| **V2** | Changement de thème (couleurs, typo) — explicitement hors scope V1. |

#### 5.1.3 Gestion des slides / du contenu principal

| Champ | Détail |
|---|---|
| **Comportement** | En mode DYNAMIQUE, la régie configure l'URL d'embed (Google Slides ou Figma) en backoffice. L'IR permet de naviguer entre les slides de l'embed si l'API le permet, ou de basculer entre différents embeds. En modes INTRO et OUTRO, les slides sont des pages web générées dynamiquement depuis les données backoffice. |
| **Déclencheur** | Régie (manuel depuis la vue Slides de l'IR). |
| **Écran(s)** | Écran Public (affichage). Interface Régie — vue Slides (navigation + aperçu de l'état EP courant). |
| **Format contenu DYNAMIQUE** | Embed Google Slides ou Figma via URL configurée en backoffice. Également : image, vidéo (URL). |
| **Format slides INTRO / OUTRO** | Pages web générées dynamiquement depuis les données saisies en backoffice (titre, speakers, animateur, message de clôture, etc.). |
| **Edge cases** | URL d'embed invalide ou non configurée : afficher un écran de fallback configurable. Slide supprimée pendant le live : la régie est notifiée, l'EP reste sur le dernier état valide. |

---

### 5.2 Mode ATTENTE

#### 5.2.1 Timer de début

| Champ | Détail |
|---|---|
| **Comportement** | Un compte à rebours est affiché en grand sur l'écran public, indiquant l'heure de début de la table ronde. Le format est configurable (ex : "Début dans 12:34"). |
| **Déclencheur** | Automatique dès l'entrée en mode ATTENTE. L'heure cible est configurée en backoffice. |
| **Écran(s)** | Écran Public. |
| **États** | En décompte / Arrivé à zéro (affiche "C'est parti !" ou message configurable). |
| **Edge cases** | Timer arrivé à zéro mais régie pas encore passée en mode INTRO : le timer reste à zéro, n'avance pas en négatif. |

#### 5.2.2 Présentation des speakers (attente)

| Champ | Détail |
|---|---|
| **Comportement** | Les fiches speakers (photo, prénom, nom, titre, société) sont affichées en rotation ou en grille sur l'écran public durant l'attente. |
| **Déclencheur** | Automatique en mode ATTENTE. |
| **Écran(s)** | Écran Public. |
| **Edge cases** | Si un speaker n'a pas de photo : afficher un avatar générique. Si un seul speaker : pas de rotation, affichage centré. |
| **Configuration** | Liste des speakers, photos, biographies configurées en backoffice avant l'événement. |

---

### 5.3 Mode INTRO

#### 5.3.1 Présentation de l'association (optionnelle)

| Champ | Détail |
|---|---|
| **Comportement** | Une slide de présentation de l'organisation / association peut être activée ou désactivée depuis le backoffice. Si désactivée, l'intro commence directement par le nom de la table ronde. |
| **Déclencheur** | Configuré en backoffice (toggle actif/inactif). Affichage déclenché par la régie. |
| **Écran(s)** | Écran Public. |
| **États** | Actif / Inactif (configuré avant l'événement). |
| **Edge cases** | Si le toggle est activé mais que le contenu est vide : le backoffice bloque l'activation avec un message d'erreur explicite. |

#### 5.3.2 Nom de la table ronde

| Champ | Détail |
|---|---|
| **Comportement** | Affichage du titre de la table ronde, de l'édition et de la date en écran plein ou en slide web. |
| **Déclencheur** | Régie (avancée de slide dans le mode INTRO). |
| **Écran(s)** | Écran Public. |
| **Configuration** | Titre, sous-titre, date, édition — configurés en backoffice. |

#### 5.3.3 Présentation de l'animateur

| Champ | Détail |
|---|---|
| **Comportement** | Slide dédiée à l'animateur : photo, prénom / nom, titre, société, courte bio. |
| **Déclencheur** | Régie. |
| **Écran(s)** | Écran Public. |
| **Edge cases** | Pas de photo de l'animateur configurée : afficher avatar générique. |

#### 5.3.4 Présentation des speakers

| Champ | Détail |
|---|---|
| **Comportement** | Chaque speaker est présenté sur sa propre slide : photo, prénom / nom, titre, société, bio courte. La régie avance manuellement d'un speaker à l'autre. Une vue grille récapitulative est affichée en fin de séquence. |
| **Déclencheur** | Régie (avance slide par slide). |
| **Écran(s)** | Écran Public. |
| **États** | Slide speaker individuelle / vue grille récapitulative (incluse en scope V1). |
| **Edge cases** | Si un speaker s'est désisté, la régie peut masquer sa slide depuis l'IR sans revenir au backoffice. |

---

### 5.4 Mode DYNAMIQUE

#### 5.4.1 Contenu principal — embed et médias

| Champ | Détail |
|---|---|
| **Comportement** | La régie sélectionne dans l'IR ce qui est affiché en contenu principal sur l'EP : embed Google Slides, embed Figma, image ou vidéo (URL). Le contenu est configuré en backoffice mais peut être sélectionné à la volée depuis l'IR. |
| **Déclencheur** | Régie (sélection dans la vue Slides ou Gestion de l'IR). |
| **Écran(s)** | Écran Public (affichage plein écran sous les overlays permanents). Interface Régie (sélection). |
| **Edge cases** | URL invalide ou inaccessible : fallback visuel avec message discret dans l'IR. |

#### 5.4.2 Bandeau speakers permanent

| Champ | Détail |
|---|---|
| **Comportement** | En mode DYNAMIQUE, un bandeau permanent (haut ou bas de l'écran, hors bandeau sponsors) affiche les photos miniatures, le nom, le titre et la société de chaque speaker actif. |
| **Déclencheur** | Automatique en mode DYNAMIQUE. |
| **Écran(s)** | Écran Public. |
| **États** | Visible par défaut. Masquable temporairement par la régie depuis l'IR (ex : pour une slide plein écran). |
| **Edge cases** | Plus de 4 speakers : adapté par défilement ou réduction des fiches. Nom très long : troncature avec ellipsis. |

#### 5.4.3 QR Code permanent pour les questions

| Champ | Détail |
|---|---|
| **Comportement** | Un QR code redirigeant vers le formulaire interne de questions est affiché en permanence sur l'EP en mode DYNAMIQUE, en position fixe (coin inférieur gauche ou droit). |
| **Déclencheur** | Automatique dès l'entrée en mode DYNAMIQUE. |
| **Écran(s)** | Écran Public. |
| **États** | Visible par défaut. Masquable ponctuellement par la régie depuis l'IR. |
| **Configuration** | URL de destination configurée en backoffice. Le QR code est généré automatiquement à partir de l'URL. |
| **Edge cases** | URL invalide ou non configurée : QR code non affiché, aucun espace vide visible. |

#### 5.4.4 Highlight de questions par la régie

| Champ | Détail |
|---|---|
| **Comportement** | La régie voit dans l'IR (vue Gestion) une liste des questions soumises via le formulaire interne (QR code). Elle peut "highlighter" une question, qui s'affiche alors en overlay sur l'EP. |
| **Déclencheur** | Régie (sélection manuelle dans la vue Gestion de l'IR). |
| **Écran(s)** | Écran Public (overlay). Interface Régie — vue Gestion (liste + action highlight). |
| **États** | Question : en attente / highlightée / archivée (après traitement). |
| **Edge cases** | Si un sondage ou vote est déjà actif, la question ne peut pas être highlightée simultanément (sondage/vote prioritaire). La régie est informée dans l'IR. Contenu inapproprié : jamais de diffusion automatique — toujours validation régie. |
| **Source des questions** | Formulaire interne lié au QR code (développement interne, pas d'outil tiers). |

#### 5.4.5 Questions préparées

| Champ | Détail |
|---|---|
| **Comportement** | L'animateur ou l'organisateur prépare un jeu de questions à l'avance en backoffice. La régie peut les afficher en overlay sur l'EP depuis la vue Gestion de l'IR. |
| **Déclencheur** | Régie (déclenchement manuel depuis la liste dans l'IR). |
| **Écran(s)** | Écran Public (overlay). Interface Régie — vue Gestion (liste ordonnable, bouton "afficher"). |
| **États** | Non affichée / En cours d'affichage / Déjà posée (marquée visuellement dans l'IR). |
| **Edge cases** | La question en cours est fermée avant d'en ouvrir une nouvelle. Si un sondage/vote est actif, la question préparée ne peut pas être lancée simultanément. |

#### 5.4.6 Question en cours (affichage actif)

| Champ | Détail |
|---|---|
| **Comportement** | La question active (préparée ou highlightée depuis l'audience) s'affiche en overlay sur l'EP. L'IR indique clairement quelle question est "en cours". La régie peut la fermer manuellement. |
| **Déclencheur** | Régie. |
| **Écran(s)** | Écran Public (overlay). Interface Régie — vue Gestion (indicateur "question active" + bouton fermer). |
| **États** | Inactive / Active / Fermée. |
| **Edge cases** | Question très longue : limiter à 300 caractères max ou tronquer avec indication visible. |

#### 5.4.7 Sondages

| Champ | Détail |
|---|---|
| **Comportement — Préparés** | Les sondages sont créés en backoffice avant l'événement : question + options (choix multiple ou oui/non). La régie lance le sondage depuis l'IR. L'EP affiche la question et les options. |
| **Comportement — Créés en live** | La régie peut créer un sondage ad hoc depuis l'IR durant la table ronde : saisie de la question et des options, puis lancement immédiat. |
| **Déclencheur** | Régie (lancement + clôture manuelle depuis la vue Gestion). |
| **Écran(s)** | Écran Public (sondage en overlay, résultats si activés). Interface Régie — vue Gestion (lancement, suivi résultats temps réel, clôture, toggle affichage résultats). |
| **États** | Non lancé / En cours (vote ouvert) / Clôturé (résultats visibles ou cachés) / Archivé. |
| **Affichage résultats** | La régie choisit si les résultats sont affichés ou non sur l'EP à la clôture du vote. |
| **Système de vote** | Développement interne (pas d'outil tiers). Vote accessible via le formulaire interne sur smartphone. |
| **Priorité** | Le sondage est prioritaire sur toute question active (question fermée automatiquement au lancement du sondage). |
| **Edge cases** | Aucun vote à la clôture : afficher "Aucun résultat" ou cacher les résultats selon le toggle. |

#### 5.4.8 Votes

| Champ | Détail |
|---|---|
| **Comportement** | Un vote binaire (ex : "Hugo vs Vincent") peut être lancé depuis l'IR. Fonctionne comme un sondage simplifié à deux options. Les résultats sont affichables sur l'EP. |
| **Déclencheur** | Régie (lancement + clôture manuelle depuis la vue Gestion). |
| **Écran(s)** | Écran Public (overlay). Interface Régie — vue Gestion. |
| **États** | Non lancé / En cours / Clôturé / Archivé. |
| **Priorité** | Même priorité que le sondage (sondage/vote > question > définition). |
| **Configuration** | Votes préparés en backoffice ou créés ad hoc depuis l'IR. |

#### 5.4.9 Définitions

| Champ | Détail |
|---|---|
| **Comportement** | La régie peut afficher en overlay une définition de terme préparée en backoffice. Utile pour contextualiser un concept technique pour l'audience. |
| **Déclencheur** | Régie (sélection depuis la vue Gestion). |
| **Écran(s)** | Écran Public (overlay). Interface Régie — vue Gestion (liste des définitions disponibles, bouton "afficher"). |
| **États** | Non affichée / Active / Fermée. |
| **Priorité** | Priorité la plus basse (sondage/vote > question > définition). |
| **Edge cases** | Si un sondage, vote ou question est actif : la définition ne peut pas être lancée simultanément. |

---

### 5.5 Mode OUTRO

#### 5.5.1 Écran de clôture

| Champ | Détail |
|---|---|
| **Comportement** | Affiche un écran de remerciements avec les logos des sponsors en grand format. Peut inclure le nom de l'événement et un message de clôture configurable. Slide web générée dynamiquement depuis les données backoffice. |
| **Déclencheur** | Régie (transition manuelle vers mode OUTRO). |
| **Écran(s)** | Écran Public. |
| **Configuration** | Message de clôture, liste des sponsors avec logo haute résolution, configurés en backoffice. |
| **Edge cases** | Si aucun sponsor configuré : afficher uniquement le message de clôture. |

---

### 5.6 Interface de Régie / Animateur (IR) — Structure détaillée

L'IR est une interface tablette-first avec trois vues accessibles par navigation horizontale (swipe ou onglets) :

#### Vue "Slides" (gauche)
- Navigation entre les 4 modes globaux (ATTENTE → INTRO → DYNAMIQUE → OUTRO)
- Aperçu de l'état courant de l'EP (miniature ou indicateur de mode)
- En mode INTRO : navigation slide par slide (asso, titre, animateur, speakers, grille)

#### Vue "Gestion" (centre — vue par défaut)
- **Section Définitions** : liste des définitions disponibles avec action "Afficher"
- **Section Questions** : liste des questions préparées + questions soumises par l'audience, avec actions "Afficher" / "Archiver"
- **Section Sondages** : liste des sondages et votes préparés, avec bouton "Lancer"
- Indicateur visuel de l'overlay actuellement actif sur l'EP
- Bouton "Fermer l'overlay" global
- Toggle : masquer/afficher le bandeau speakers sur l'EP
- Toggle : masquer/afficher le QR code sur l'EP
- Indicateur de latence et état de connexion EP

#### Vue "Notes" (droite)
- Éditeur de notes de l'animateur pour la session (Markdown basique)
- Données sauvegardées en temps réel côté serveur

---

## 6. Flux utilisateur principaux

### 6.1 Flux régie — déroulé complet d'un événement

1. La régie ouvre l'Interface de Régie (IR) sur tablette/PC et saisit le PIN de session.
2. L'écran public (EP) se charge automatiquement en mode **ATTENTE** avec timer, speakers et bandeau sponsors.
3. La régie vérifie l'aperçu de l'EP dans la vue Slides de l'IR.
4. Au moment voulu, la régie passe en mode **INTRO** depuis la vue Slides.
5. La régie fait avancer les slides d'intro (asso optionnelle → titre → animateur → speakers → grille récap).
6. La régie passe en mode **DYNAMIQUE**. Le bandeau speakers et le QR code apparaissent sur l'EP.
7. La régie active un embed Google Slides depuis la vue Gestion. L'EP affiche le contenu.
8. La régie affiche une définition en overlay. Elle la ferme après quelques secondes.
9. La régie affiche une question préparée en overlay sur l'EP. Elle la ferme après lecture.
10. La régie reçoit des questions audience via le formulaire interne dans la vue Gestion. Elle en highlight une sur l'EP.
11. La régie lance un sondage (question fermée automatiquement). L'EP affiche les options. La régie clôture et affiche les résultats.
12. La régie passe en mode **OUTRO**. L'EP affiche l'écran de remerciements.

### 6.2 Flux écran public — expérience audience

1. L'audience arrive dans la salle. L'EP affiche le timer, les speakers et le bandeau sponsors.
2. L'événement commence : l'EP transite vers l'intro sans action de l'audience.
3. Les speakers sont présentés visuellement, un par un, puis en grille récapitulative.
4. La table ronde commence : le contenu s'affiche avec les fiches speakers et le QR code visible.
5. L'audience scanne le QR code pour poser des questions via leur smartphone.
6. Des définitions, questions ou sondages/votes apparaissent en overlay, pilotés par la régie.
7. L'événement se clôture sur l'écran de remerciements.

---

## 7. Exigences techniques

### 7.1 Synchronisation temps réel

| Exigence | Détail |
|---|---|
| **Latence cible** | Délai d'affichage < 2 secondes entre action régie et mise à jour écran public. |
| **Protocole** | Connexion persistante nécessaire (WebSocket ou Server-Sent Events). L'équipe technique choisit la solution la plus robuste : WebSocket via Socket.io ou Supabase Realtime sont les options recommandées. |
| **Mode dégradé** | Si la connexion est interrompue, l'EP reste sur son dernier état et affiche un indicateur de reconnexion invisible pour l'audience (voyant visible uniquement dans l'IR). Reconnexion automatique en moins de 30 secondes. |
| **Canal d'événement** | L'EP et l'IR s'associent via un mécanisme à définir par l'équipe technique (code de session, URL unique ou autre). Le choix doit être documenté et justifié dans PLAN.md. |
| **Authentification IR** | L'IR est protégée par un code PIN de session configuré en backoffice. |

### 7.2 Performances

| Exigence | Détail |
|---|---|
| **Résolution EP** | Optimisé pour une résolution de projection standard (1920×1080 minimum). Interface responsive non requise pour l'EP. |
| **Chargement initial** | L'EP doit être opérationnel en < 5 secondes sur une connexion normale. |
| **Animations** | Les transitions entre modes et l'apparition des overlays doivent être fluides (60fps cible). Privilégier CSS transitions sur manipulations DOM lourdes. |
| **Images** | Photos de speakers et logos sponsors optimisés (format WebP, dimensions définies en backoffice). |

### 7.3 Stack technique — Recommandations

> **Stack recommandée** (l'équipe technique est libre de l'ajuster — toute décision doit être documentée dans PLAN.md) :
>
> - **Frontend EP + IR :** React (SPA)
> - **Synchronisation :** WebSocket (Socket.io) ou Supabase Realtime
> - **Backend / Backoffice :** Node.js + PostgreSQL
> - **Hébergement :** solution cloud standard (Vercel, Railway, Render)
> - **Structure projet :** monorepo recommandé (apps/screen, apps/control, apps/admin, packages/shared, packages/realtime)

---

## 8. Hors scope V1

| Feature | Justification / Version cible |
|---|---|
| Changement de thème (couleurs, typographie) | Complexité UX élevée. Prévu **V2**. |
| Application mobile native (iOS / Android) | Le web responsive couvre le besoin V1. |
| Enregistrement / replay de session | Hors périmètre événementiel. |
| Gestion multi-événements simultanés | Cas d'usage non prioritaire en V1. |
| Traduction / internationalisation | Interface en français uniquement en V1. |
| Statistiques et analytics post-événement | Prévu **V2**. |
| Accès régie multi-utilisateurs simultanés avec gestion des conflits | Un seul opérateur régie actif en V1. |

---

## 9. Risques & mitigations

| P | Risque | Impact | Mitigation | Statut |
|---|---|---|---|---|
| 🔴 H | Perte de connexion régie → EP en live | EP figé, plus de contrôle | Reconnexion auto < 30s + mode dégradé (EP reste sur dernier état) | À implémenter |
| 🔴 H | Latence élevée sur réseau de salle (Wi-Fi saturé) | Actions régie non reflétées en temps réel | Tester sur réseau 4G / hotspot en fallback. Indicateur de latence dans l'IR. | À anticiper |
| 🟡 M | Contenu de question inapproprié projeté par erreur | Impact réputationnel | Les questions ne s'affichent jamais automatiquement — toujours validation régie | By design |
| 🟡 M | Speaker sans photo / contenu manquant en live | Affichage dégradé | Fallback visuel (avatar générique). Checklist pré-événement recommandée en backoffice. | By design |
| 🟡 M | URL embed invalide ou inaccessible en live | Contenu principal absent sur l'EP | Fallback visuel + alerte dans l'IR. Vérification recommandée en backoffice avant l'événement. | À implémenter |
| 🟢 L | Résolution de projection non standard (ex : 4:3) | Mise en page cassée sur l'EP | Tester sur le matériel cible avant l'événement. Support 16:9 prioritaire. | Risque accepté V1 |

*P = Probabilité : H = Haute, M = Moyenne, L = Faible*

---

## 10. Critères d'acceptance (Definition of Done)

| Feature | Critère d'acceptance | Test type |
|---|---|---|
| Synchronisation EP / IR | Toute action IR est reflétée sur l'EP en moins de 2 secondes sur réseau local standard. | Test de performance |
| Bandeau sponsors | Le bandeau est visible sur les 4 modes, même lors de l'affichage d'un overlay. Absent si aucun sponsor configuré. | Test visuel / régression |
| Navigation slides INTRO | La régie peut naviguer slide par slide à travers l'intro, y compris la grille récapitulative. | Test fonctionnel |
| Questions préparées | Une question affichée sur l'EP peut être fermée par la régie, restaurant le contenu précédent. | Test fonctionnel |
| Sondage préparé | Un sondage peut être lancé, clôturé et ses résultats affichés ou cachés sur l'EP. | Test fonctionnel |
| Sondage live | La régie peut créer et lancer un sondage ad hoc sans préparation en backoffice. | Test fonctionnel |
| Vote | Un vote binaire peut être lancé, clôturé et ses résultats affichés sur l'EP. | Test fonctionnel |
| Définition | Une définition peut être affichée et fermée sans impacter les autres éléments de l'EP. | Test fonctionnel |
| Priorité overlays | Le lancement d'un sondage/vote ferme automatiquement toute question ou définition active. | Test fonctionnel |
| Masquage bandeau speakers | La régie peut masquer/afficher le bandeau speakers depuis l'IR en mode DYNAMIQUE. | Test fonctionnel |
| Masquage QR code | La régie peut masquer/afficher le QR code depuis l'IR en mode DYNAMIQUE. | Test fonctionnel |
| Mode ATTENTE | Le timer se décompte correctement et s'arrête à zéro sans valeur négative. | Test fonctionnel |
| Slide asso optionnelle | Configurer le toggle OFF en backoffice supprime la slide de l'intro. Activation bloquée si contenu vide. | Test de configuration |
| PIN de session | L'IR est inaccessible sans saisie du PIN correct configuré en backoffice. | Test de sécurité |
| Reconnexion EP | Après 30 secondes de perte réseau, l'EP se reconnecte automatiquement et recharge l'état courant. | Test de résilience |
| Mode dégradé | En cas de perte réseau, l'EP reste affiché sur son dernier état connu sans écran blanc. | Test de résilience |

---

## 11. Questions ouvertes

> ✅ Toutes les questions critiques ont été arbitrées. Les éléments ci-dessous documentent les décisions prises.

| # | Question | Décision |
|---|---|---|
| Q1 | Système de vote pour les sondages : outil tiers ou développement interne ? | **Développement interne.** |
| Q2 | Source des questions audience via QR code : formulaire interne ou outil tiers ? | **Formulaire interne.** |
| Q3 | L'animateur a-t-il accès à une vue "monitor" de l'EP sur son propre appareil ? | **Oui.** L'animateur utilise la même IR que la régie (avec PIN). Vue Notes et vue Gestion disponibles. L'animateur et la régie peuvent utiliser l'IR simultanément. |
| Q4 | Que se passe-t-il si aucun sponsor n'est configuré : bandeau vide, caché, ou message par défaut ? | **Bandeau caché.** Aucun espace vide visible. |
| Q5 | Règle de priorité d'affichage si plusieurs éléments actifs simultanément ? | **Sondage/Vote > Question > Définition.** Un seul overlay à la fois. |
| Q6 | Le bandeau speakers en mode DYNAMIQUE est-il masquable temporairement par la régie ? | **Oui.** Toggle dans la vue Gestion de l'IR. |
| Q7 | Le QR code est-il masquable ponctuellement par la régie ? | **Oui.** Toggle dans la vue Gestion de l'IR. |
| Q8 | Quel est le format de définition des slides ? | **Mode DYNAMIQUE** : embed Google Slides ou Figma via URL (+ image/vidéo). **Modes INTRO / OUTRO** : pages web générées dynamiquement depuis les données backoffice. |
| Q9 | L'Interface de Régie est-elle protégée par un code PIN ou une session dédiée ? | **Oui.** Code PIN configuré en backoffice, saisi à l'ouverture de l'IR. |
| Q10 | Vue grille récapitulative des speakers en fin d'intro : incluse ou hors scope V1 ? | **Incluse en V1.** |
| Q11 | Canal d'événement : comment EP et IR s'associent-ils ? | **À décider par l'équipe technique.** Options : code de session, URL unique, QR code de liaison. Le choix doit être documenté et justifié dans PLAN.md. |

---

*PRD v1.1 — Outil Tables Rondes Design — Juin 2026*
*Changements v1.1 : Mode TABLE RONDE renommé DYNAMIQUE — Toutes questions ouvertes arbitrées — Mode DYNAMIQUE enrichi (votes, définitions, embed, masquage QR/speakers) — Section IR détaillée (3 vues) — Système de vote/questions interne confirmé — Slide asso : blocage si contenu vide ajouté — Vue grille speakers confirmée V1*
