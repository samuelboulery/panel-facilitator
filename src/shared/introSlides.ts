// Architecture : séquence des slides INTRO (PRD 5.3), partagée EP / IR.
// L'EP rend la slide à screen_state.intro_slide_index ; l'IR navigue avec
// les labels. Liste recalculée à chaque changement (speaker masqué en live
// ⇒ la séquence se raccourcit, l'index est borné par clampIntroIndex).
import { roleLabel } from './roleLabel'
import type { EventPublic, Speaker } from './types'

export type IntroSlideKind = 'asso' | 'title' | 'host' | 'speaker' | 'grid'

export interface IntroSlide {
  kind: IntroSlideKind
  /** Label court pour la navigation IR. */
  label: string
  /** Renseigné pour kind='speaker' et kind='host'. */
  speaker?: Speaker
}

export function buildIntroSlides(event: EventPublic, speakers: Speaker[]): IntroSlide[] {
  const slides: IntroSlide[] = []

  if (event.assoSlideEnabled) {
    slides.push({ kind: 'asso', label: 'Association' })
  }

  slides.push({ kind: 'title', label: 'Titre' })

  const host = speakers.find((s) => s.isHost && !s.hidden)
  if (host) {
    slides.push({ kind: 'host', label: `${roleLabel(true, host.gender)} — ${host.firstName}`, speaker: host })
  }

  const panel = speakers.filter((s) => !s.isHost && !s.hidden)
  for (const speaker of panel) {
    slides.push({
      kind: 'speaker',
      label: `${speaker.firstName} ${speaker.lastName}`,
      speaker,
    })
  }

  if (panel.length > 0) {
    slides.push({ kind: 'grid', label: 'Grille récap' })
  }

  return slides
}

export function clampIntroIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(index, 0), length - 1)
}
