// Architecture : machine à états globale de l'Écran Public (PRD §4.2).
// Réducteur pur et immuable — SEULE source des règles de transition et de
// priorité overlay (PRD Q5 : sondage/vote > question > définition).
// Utilisée par l'IR pour valider les actions avant mutation RPC, et par les
// RPCs côté Postgres (logique dupliquée en SQL minimal, voir migrations).
import type { Mode, Overlay, OverlayType, ScreenState } from './types'

export const MODES: readonly Mode[] = ['attente', 'intro', 'dynamique', 'outro']

/** Priorité d'overlay — plus haut = prioritaire. */
export const OVERLAY_PRIORITY: Record<OverlayType, number> = {
  poll: 3,
  question: 2,
  definition: 1,
}

export const initialScreenState: ScreenState = {
  mode: 'attente',
  introSlideIndex: 0,
  mainContentId: null,
  contentStep: 0,
  overlay: null,
  speakersBannerVisible: true,
  qrVisible: true,
  timerStartedAt: null,
  cardPositions: {},
}

export type ScreenAction =
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SHOW_OVERLAY'; overlay: Overlay }
  | { type: 'CLOSE_OVERLAY' }
  | { type: 'SET_MAIN_CONTENT'; contentId: string | null }
  | { type: 'SET_CONTENT_STEP'; step: number }
  | { type: 'SET_INTRO_SLIDE'; index: number }
  | { type: 'TOGGLE_SPEAKERS_BANNER' }
  | { type: 'TOGGLE_QR' }

export type ActionResult =
  | { ok: true; state: ScreenState }
  | { ok: false; reason: string }

function accept(state: ScreenState): ActionResult {
  return { ok: true, state }
}

function reject(reason: string): ActionResult {
  return { ok: false, reason }
}

/**
 * Un overlay entrant peut-il remplacer l'overlay actif ?
 * Règles PRD 5.4.4 / 5.4.5 / 5.4.7 / 5.4.9 :
 * - priorité strictement supérieure → remplace (fermeture automatique)
 * - même type → remplace (« la question en cours est fermée avant d'en ouvrir une nouvelle »)
 * - priorité inférieure → refusé
 */
function canReplace(current: Overlay | null, next: Overlay): boolean {
  if (current === null) return true
  if (current.type === next.type) return true
  return OVERLAY_PRIORITY[next.type] > OVERLAY_PRIORITY[current.type]
}

export function applyAction(state: ScreenState, action: ScreenAction): ActionResult {
  switch (action.type) {
    case 'SET_MODE': {
      if (action.mode === state.mode) {
        return reject(`Mode « ${state.mode} » déjà actif.`)
      }
      return accept({
        ...state,
        mode: action.mode,
        // Quitter le mode dynamique ferme l'overlay ; entrer en intro repart de la slide 0.
        overlay: null,
        introSlideIndex: action.mode === 'intro' ? 0 : state.introSlideIndex,
      })
    }

    case 'SHOW_OVERLAY': {
      if (state.mode !== 'dynamique') {
        return reject('Les overlays ne sont disponibles qu’en mode dynamique.')
      }
      if (!canReplace(state.overlay, action.overlay)) {
        const blocking = state.overlay as Overlay
        const label = blocking.type === 'poll' ? 'Un sondage/vote' :
          blocking.type === 'question' ? 'Une question' : 'Une définition'
        return reject(`${label} est déjà actif·ve — priorité sondage/vote > question > définition.`)
      }
      return accept({ ...state, overlay: action.overlay })
    }

    case 'CLOSE_OVERLAY': {
      if (state.overlay === null) {
        return reject('Aucun overlay actif à fermer.')
      }
      return accept({ ...state, overlay: null })
    }

    case 'SET_MAIN_CONTENT': {
      if (state.mode !== 'dynamique') {
        return reject('Le contenu principal ne se change qu’en mode dynamique.')
      }
      // Changer de contenu repart de sa première slide interne.
      return accept({ ...state, mainContentId: action.contentId, contentStep: 0 })
    }

    case 'SET_CONTENT_STEP': {
      if (state.mode !== 'dynamique') {
        return reject('La navigation interne n’est disponible qu’en mode dynamique.')
      }
      // Pas de borne haute : total de slides du deck inconnu sans l'API Google.
      const step = Math.max(0, action.step)
      return accept({ ...state, contentStep: step })
    }

    case 'SET_INTRO_SLIDE': {
      if (state.mode !== 'intro') {
        return reject('La navigation de slides n’est disponible qu’en mode intro.')
      }
      if (action.index < 0) {
        return reject('Index de slide invalide.')
      }
      return accept({ ...state, introSlideIndex: action.index })
    }

    case 'TOGGLE_SPEAKERS_BANNER': {
      if (state.mode !== 'dynamique') {
        return reject('Le bandeau speakers ne se pilote qu’en mode dynamique.')
      }
      return accept({ ...state, speakersBannerVisible: !state.speakersBannerVisible })
    }

    case 'TOGGLE_QR': {
      if (state.mode !== 'dynamique') {
        return reject('Le QR code ne se pilote qu’en mode dynamique.')
      }
      return accept({ ...state, qrVisible: !state.qrVisible })
    }
  }
}
