// Architecture : types du domaine partagés par les 4 surfaces.
// Source de vérité de l'état live : table `screen_state` (PLAN.md §3).
// Toute logique de transition/priorité vit dans stateMachine.ts — jamais dans les routes.

export type Mode = 'attente' | 'intro' | 'dynamique' | 'outro'

export type OverlayType = 'poll' | 'question' | 'definition'

export interface Overlay {
  type: OverlayType
  /** id de la ligne polls / questions / definitions */
  id: string
}

/** Miroir TypeScript de la table `screen_state`. */
export interface ScreenState {
  mode: Mode
  introSlideIndex: number
  mainContentId: string | null
  /** Slide interne du contenu dynamique (deck Google Slides). 0 = première. */
  contentStep: number
  overlay: Overlay | null
  speakersBannerVisible: boolean
  qrVisible: boolean
  /** Timer de durée manuel de l'IR (null = arrêté). N'apparaît pas sur l'EP. */
  timerStartedAt: string | null
  /** Positions personnalisées des cartes de scène : slideKey → position en unités 1920×1080. */
  cardPositions: Record<string, CardPosition>
}

/** Bordure de référence d'une carte : l'axe ancré reste collé à ce bord lors des
 *  variations de taille (timer, rotation speakers). Défaut historique = 'top'. */
export type CardEdge = 'top' | 'bottom' | 'left' | 'right'

/** Position d'une carte de scène. `x`/`y` = coordonnées du coin (unités scène),
 *  mais l'axe désigné par `edge` est mesuré DEPUIS ce bord (ex. edge='bottom' →
 *  y = distance du bas). Voir MovableCard pour la reconstruction du coin. */
export interface CardPosition {
  x: number
  y: number
  edge?: CardEdge
}

export type PollKind = 'poll' | 'versus'
export type PollStatus = 'draft' | 'live' | 'closed' | 'archived'
export type QuestionSource = 'prepared' | 'audience'
export type QuestionStatus = 'pending' | 'displayed' | 'done' | 'archived'
export type ContentKind = 'embed_gslides' | 'embed_figma' | 'embed_site' | 'image' | 'video'

export interface EventPublic {
  id: string
  slug: string
  title: string
  subtitle: string | null
  edition: string | null
  eventDate: string | null
  startAt: string | null
  closingMessage: string | null
  assoSlideEnabled: boolean
  assoContent: unknown
  qrUrl: string | null
  sponsorScrollSpeed: number
  brandingProfileId: string | null
}

export interface Branding {
  bgColor: string
  textColor: string
  accentColor: string
  bgImageUrl: string | null
}

export interface Speaker {
  id: string
  firstName: string
  lastName: string
  title: string | null
  company: string | null
  bio: string | null
  photoUrl: string | null
  isHost: boolean
  gender: 'f' | 'm' | null
  sortOrder: number
  hidden: boolean
}

export interface Sponsor {
  id: string
  name: string
  logoUrl: string
  sortOrder: number
}

export interface Content {
  id: string
  kind: ContentKind
  url: string
  label: string
  sortOrder: number
}

export interface Definition {
  id: string
  term: string
  definition: string
  imageUrl: string | null
  sortOrder: number
  /** Déjà affichée pendant l'événement — ne se montre qu'une fois. */
  used: boolean
}

export interface Question {
  id: string
  text: string
  source: QuestionSource
  status: QuestionStatus
  authorName: string | null
  pinned: boolean
  sortOrder: number
}

export interface PollOption {
  id: string
  label: string
}

export interface Poll {
  id: string
  kind: PollKind
  question: string
  options: PollOption[]
  status: PollStatus
  showResults: boolean
}

/** Résultats agrégés d'un sondage : option id → nombre de voix. */
export type PollResults = Record<string, number>

