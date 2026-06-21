// Deck de présentation de l'IR : séquence macro Attente → slides intro →
// Dynamique → Outro. Partagé par la vue Slides (carrousel d'aperçu) et la barre
// d'état (flèches de navigation). Naviguer pilote directement l'EP via
// useControlState — toujours validé par la machine à états.
import type { EventData } from '../../../realtime/eventData'
import { buildIntroSlides, clampIntroIndex, type IntroSlide } from '../../../shared/introSlides'
import type { ScreenState } from '../../../shared/types'
import type { ControlState } from '../hooks/useControlState'

export type DeckSlide =
  | { kind: 'attente'; key: string; label: string; hint: string }
  | { kind: 'intro'; key: string; label: string; hint: string; introIndex: number; intro: IntroSlide }
  | { kind: 'dynamique'; key: string; label: string; hint: string }
  | { kind: 'outro'; key: string; label: string; hint: string }

export function buildDeck(data: EventData): DeckSlide[] {
  const intro = buildIntroSlides(data.event, data.speakers)
  return [
    { kind: 'attente', key: 'attente', label: 'Attente', hint: 'Timer · speakers · sponsors' },
    ...intro.map(
      (slide, i): DeckSlide => ({
        kind: 'intro',
        key: `intro-${slide.kind}-${slide.speaker?.id ?? i}`,
        label: slide.label,
        hint: 'Intro',
        introIndex: i,
        intro: slide,
      }),
    ),
    // Slide dynamique — cœur de la table ronde (PRD 5.4) : scène titre au repos.
    // Les contenus projetés se lancent depuis la vue Gestion (card Contenus).
    { kind: 'dynamique', key: 'dynamique', label: data.event.title, hint: 'Dynamique' },
    { kind: 'outro', key: 'outro', label: 'Outro', hint: 'Remerciements · sponsors' },
  ]
}

/** État EP synthétique pour le rendu d'aperçu d'une slide du deck. */
export function slideToState(slide: DeckSlide): ScreenState {
  const base: ScreenState = {
    mode: 'attente',
    introSlideIndex: 0,
    mainContentId: null,
    contentStep: 0,
    overlay: null,
    speakersBannerVisible: true,
    qrVisible: false,
    timerStartedAt: null,
    cardPositions: {},
  }
  switch (slide.kind) {
    case 'attente':
      return base
    case 'intro':
      return { ...base, mode: 'intro', introSlideIndex: slide.introIndex }
    case 'dynamique':
      // QR visible dans l'aperçu IR pour pouvoir le positionner (l'EP réel suit qrVisible).
      return { ...base, mode: 'dynamique', qrVisible: true }
    case 'outro':
      return { ...base, mode: 'outro' }
  }
}

/** Position courante dans le deck, dérivée de l'état EP. */
export function currentDeckIndex(deck: DeckSlide[], screen: ScreenState): number {
  switch (screen.mode) {
    case 'attente':
      return 0
    case 'intro': {
      const introSlides = deck.filter((slide) => slide.kind === 'intro')
      const idx = clampIntroIndex(screen.introSlideIndex, introSlides.length)
      const slide = introSlides[idx]
      return slide ? deck.indexOf(slide) : 0
    }
    case 'dynamique': {
      // Contenus gérés dans Gestion : la slide dynamique = scène titre.
      const main = deck.findIndex((slide) => slide.kind === 'dynamique')
      return main !== -1 ? main : deck.length - 1
    }
    case 'outro':
      return deck.length - 1
  }
}

/** Navigue l'EP vers une slide du deck (mode + index intro dans un seul RPC). */
export function goToDeckSlide(slide: DeckSlide, control: ControlState): void {
  switch (slide.kind) {
    case 'attente':
      control.setMode('attente')
      break
    case 'intro':
      // Mode + index dans un seul RPC — pas de course serveur.
      control.goToIntroSlide(slide.introIndex)
      break
    case 'dynamique':
      // Contenus pilotés depuis Gestion : ici on garantit juste le mode dynamique
      // (sans toucher au contenu courant, qui reste géré par la card Contenus).
      if (control.screen.mode !== 'dynamique') control.setMode('dynamique')
      break
    case 'outro':
      control.setMode('outro')
      break
  }
}
