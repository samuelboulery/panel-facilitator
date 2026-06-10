// Tests de la machine à états globale (PRD §4.2) et des règles de priorité
// overlay (PRD Q5 : sondage/vote > question > définition, un seul overlay à la fois).
import { describe, it, expect } from 'vitest'
import {
  initialScreenState,
  applyAction,
  type ScreenAction,
} from './stateMachine'
import type { ScreenState } from './types'

const dynamique: ScreenState = {
  ...initialScreenState,
  mode: 'dynamique',
}

function ok(state: ScreenState, action: ScreenAction): ScreenState {
  const result = applyAction(state, action)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  return result.state
}

function ko(state: ScreenState, action: ScreenAction): string {
  const result = applyAction(state, action)
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('attendu: refus')
  return result.reason
}

describe('état initial', () => {
  it('démarre en mode attente, sans overlay, bandeaux visibles', () => {
    expect(initialScreenState.mode).toBe('attente')
    expect(initialScreenState.overlay).toBeNull()
    expect(initialScreenState.speakersBannerVisible).toBe(true)
    expect(initialScreenState.qrVisible).toBe(true)
    expect(initialScreenState.introSlideIndex).toBe(0)
  })
})

describe('transitions de mode', () => {
  it('suit le déroulé nominal attente → intro → dynamique → outro', () => {
    let s = initialScreenState
    s = ok(s, { type: 'SET_MODE', mode: 'intro' })
    s = ok(s, { type: 'SET_MODE', mode: 'dynamique' })
    s = ok(s, { type: 'SET_MODE', mode: 'outro' })
    expect(s.mode).toBe('outro')
  })

  it('autorise la navigation libre entre modes (la régie peut revenir en arrière)', () => {
    const s = ok({ ...initialScreenState, mode: 'outro' }, { type: 'SET_MODE', mode: 'dynamique' })
    expect(s.mode).toBe('dynamique')
  })

  it('ferme l’overlay actif en quittant le mode dynamique', () => {
    const withOverlay: ScreenState = {
      ...dynamique,
      overlay: { type: 'question', id: 'q1' },
    }
    const s = ok(withOverlay, { type: 'SET_MODE', mode: 'outro' })
    expect(s.overlay).toBeNull()
  })

  it('remet l’index de slide intro à zéro en entrant en intro', () => {
    const s = ok(
      { ...initialScreenState, introSlideIndex: 4 },
      { type: 'SET_MODE', mode: 'intro' },
    )
    expect(s.introSlideIndex).toBe(0)
  })

  it('ne change rien si le mode demandé est le mode courant', () => {
    const reason = ko(initialScreenState, { type: 'SET_MODE', mode: 'attente' })
    expect(reason).toMatch(/déjà/i)
  })
})

describe('overlays — restrictions de mode', () => {
  it('refuse tout overlay hors mode dynamique', () => {
    for (const mode of ['attente', 'intro', 'outro'] as const) {
      ko({ ...initialScreenState, mode }, {
        type: 'SHOW_OVERLAY',
        overlay: { type: 'definition', id: 'd1' },
      })
    }
  })
})

describe('overlays — priorité sondage/vote > question > définition', () => {
  it('affiche chaque type d’overlay sur un écran libre', () => {
    for (const type of ['poll', 'question', 'definition'] as const) {
      const s = ok(dynamique, { type: 'SHOW_OVERLAY', overlay: { type, id: 'x' } })
      expect(s.overlay).toEqual({ type, id: 'x' })
    }
  })

  it('le sondage remplace la question active (fermeture automatique, PRD 5.4.7)', () => {
    const s = ok(
      { ...dynamique, overlay: { type: 'question', id: 'q1' } },
      { type: 'SHOW_OVERLAY', overlay: { type: 'poll', id: 'p1' } },
    )
    expect(s.overlay).toEqual({ type: 'poll', id: 'p1' })
  })

  it('le sondage remplace la définition active', () => {
    const s = ok(
      { ...dynamique, overlay: { type: 'definition', id: 'd1' } },
      { type: 'SHOW_OVERLAY', overlay: { type: 'poll', id: 'p1' } },
    )
    expect(s.overlay).toEqual({ type: 'poll', id: 'p1' })
  })

  it('refuse une question si un sondage est actif (PRD 5.4.4)', () => {
    const reason = ko(
      { ...dynamique, overlay: { type: 'poll', id: 'p1' } },
      { type: 'SHOW_OVERLAY', overlay: { type: 'question', id: 'q1' } },
    )
    expect(reason).toMatch(/sondage/i)
  })

  it('la question remplace la définition active (priorité supérieure)', () => {
    const s = ok(
      { ...dynamique, overlay: { type: 'definition', id: 'd1' } },
      { type: 'SHOW_OVERLAY', overlay: { type: 'question', id: 'q1' } },
    )
    expect(s.overlay).toEqual({ type: 'question', id: 'q1' })
  })

  it('la question en cours est fermée avant d’en ouvrir une nouvelle (PRD 5.4.5)', () => {
    const s = ok(
      { ...dynamique, overlay: { type: 'question', id: 'q1' } },
      { type: 'SHOW_OVERLAY', overlay: { type: 'question', id: 'q2' } },
    )
    expect(s.overlay).toEqual({ type: 'question', id: 'q2' })
  })

  it('refuse une définition si un sondage ou une question est active (PRD 5.4.9)', () => {
    for (const blocking of ['poll', 'question'] as const) {
      ko(
        { ...dynamique, overlay: { type: blocking, id: 'b1' } },
        { type: 'SHOW_OVERLAY', overlay: { type: 'definition', id: 'd1' } },
      )
    }
  })

  it('un nouveau sondage remplace le sondage actif', () => {
    const s = ok(
      { ...dynamique, overlay: { type: 'poll', id: 'p1' } },
      { type: 'SHOW_OVERLAY', overlay: { type: 'poll', id: 'p2' } },
    )
    expect(s.overlay).toEqual({ type: 'poll', id: 'p2' })
  })
})

describe('fermeture d’overlay', () => {
  it('ferme l’overlay actif et restaure le contenu précédent', () => {
    const s = ok(
      { ...dynamique, overlay: { type: 'poll', id: 'p1' }, mainContentId: 'c1' },
      { type: 'CLOSE_OVERLAY' },
    )
    expect(s.overlay).toBeNull()
    expect(s.mainContentId).toBe('c1')
  })

  it('refuse de fermer s’il n’y a aucun overlay', () => {
    ko(dynamique, { type: 'CLOSE_OVERLAY' })
  })
})

describe('contenu principal et navigation intro', () => {
  it('change le contenu principal en mode dynamique', () => {
    const s = ok(dynamique, { type: 'SET_MAIN_CONTENT', contentId: 'c2' })
    expect(s.mainContentId).toBe('c2')
  })

  it('refuse le changement de contenu hors mode dynamique', () => {
    ko(initialScreenState, { type: 'SET_MAIN_CONTENT', contentId: 'c2' })
  })

  it('avance et recule dans les slides intro, sans index négatif', () => {
    const intro: ScreenState = { ...initialScreenState, mode: 'intro' }
    const s = ok(intro, { type: 'SET_INTRO_SLIDE', index: 2 })
    expect(s.introSlideIndex).toBe(2)
    const reason = ko(s, { type: 'SET_INTRO_SLIDE', index: -1 })
    expect(reason).toMatch(/index/i)
  })

  it('refuse la navigation intro hors mode intro', () => {
    ko(dynamique, { type: 'SET_INTRO_SLIDE', index: 1 })
  })
})

describe('toggles bandeau speakers et QR code (PRD Q6/Q7)', () => {
  it('bascule le bandeau speakers en mode dynamique', () => {
    const s = ok(dynamique, { type: 'TOGGLE_SPEAKERS_BANNER' })
    expect(s.speakersBannerVisible).toBe(false)
    const s2 = ok(s, { type: 'TOGGLE_SPEAKERS_BANNER' })
    expect(s2.speakersBannerVisible).toBe(true)
  })

  it('bascule le QR code en mode dynamique', () => {
    const s = ok(dynamique, { type: 'TOGGLE_QR' })
    expect(s.qrVisible).toBe(false)
  })

  it('refuse les toggles hors mode dynamique (sans objet ailleurs)', () => {
    ko(initialScreenState, { type: 'TOGGLE_SPEAKERS_BANNER' })
    ko(initialScreenState, { type: 'TOGGLE_QR' })
  })
})

describe('immutabilité', () => {
  it('ne mute jamais l’état d’entrée', () => {
    const before = structuredClone(dynamique)
    applyAction(dynamique, { type: 'SHOW_OVERLAY', overlay: { type: 'poll', id: 'p1' } })
    expect(dynamique).toEqual(before)
  })
})
