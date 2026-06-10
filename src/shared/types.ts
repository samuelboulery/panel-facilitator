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
  overlay: Overlay | null
  speakersBannerVisible: boolean
  qrVisible: boolean
}

export type PollKind = 'poll' | 'versus'
export type PollStatus = 'draft' | 'live' | 'closed' | 'archived'
export type QuestionSource = 'prepared' | 'audience'
export type QuestionStatus = 'pending' | 'displayed' | 'done' | 'archived'
export type ContentKind = 'embed_gslides' | 'embed_figma' | 'image' | 'video'
