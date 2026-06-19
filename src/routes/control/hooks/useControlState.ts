// Architecture : cerveau de l'IR — état EP temps réel + validation locale par
// la machine à états AVANT toute mutation RPC. Une action invalide (ex :
// définition pendant un sondage) est refusée localement avec le motif affiché,
// sans aller-retour serveur. La DB reste la source de vérité.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyAction,
  initialScreenState,
  type ScreenAction,
} from '../../../shared/stateMachine'
import type { ScreenState, Mode, Overlay, CardPosition } from '../../../shared/types'
import type { ControlSession } from '../../../realtime/mutations'
import * as mutations from '../../../realtime/mutations'
import { subscribeScreenState, type ConnectionStatus } from '../../../realtime/screenState'

export interface ControlState {
  screen: ScreenState
  connection: ConnectionStatus
  /** Dernier refus de la machine à états — à afficher en toast. */
  lastError: string | null
  clearError: () => void
  setMode: (mode: Mode) => void
  setIntroSlide: (index: number) => void
  /** Entre en mode intro directement sur une slide (un seul RPC, pas de course). */
  goToIntroSlide: (index: number) => void
  setMainContent: (contentId: string | null) => void
  showOverlay: (overlay: Overlay) => void
  closeOverlay: () => void
  toggleSpeakersBanner: () => void
  toggleQr: () => void
  /** Repositionne une carte de scène (drag & drop) ; persiste la map fusionnée. */
  setCardPosition: (key: string, pos: CardPosition) => void
}

export function useControlState(session: ControlSession): ControlState {
  const [screen, setScreen] = useState<ScreenState>(initialScreenState)
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const [lastError, setLastError] = useState<string | null>(null)
  // L'état courant vit dans une ref pour valider sans recréer les callbacks.
  const screenRef = useRef(screen)
  screenRef.current = screen

  useEffect(() => {
    const sub = subscribeScreenState({
      eventId: session.eventId,
      onState: setScreen,
      onConnectionChange: setConnection,
    })
    return () => {
      sub.unsubscribe()
    }
  }, [session.eventId])

  /**
   * Valide l'action localement (machine à états), applique optimistiquement,
   * puis envoie la mutation. En cas d'échec RPC, l'état serveur fera foi au
   * prochain événement realtime.
   */
  const dispatch = useCallback(
    (action: ScreenAction, mutate: () => Promise<void>) => {
      const result = applyAction(screenRef.current, action)
      if (!result.ok) {
        setLastError(result.reason)
        return
      }
      setScreen(result.state)
      mutate().catch((err: unknown) => {
        setLastError(err instanceof Error ? err.message : 'Erreur réseau')
      })
    },
    [],
  )

  return {
    screen,
    connection,
    lastError,
    clearError: useCallback(() => setLastError(null), []),
    setMode: useCallback(
      (mode: Mode) =>
        dispatch({ type: 'SET_MODE', mode }, () =>
          // La machine remet l'index intro à 0 côté client : le serveur doit
          // suivre dans le MÊME patch (sinon l'EP garderait l'ancien index).
          mode === 'intro'
            ? mutations.setIntroMode(session, 0)
            : mutations.setMode(session, mode),
        ),
      [dispatch, session],
    ),
    setIntroSlide: useCallback(
      (index: number) =>
        dispatch({ type: 'SET_INTRO_SLIDE', index }, () =>
          mutations.setIntroSlide(session, index),
        ),
      [dispatch, session],
    ),
    goToIntroSlide: useCallback(
      (index: number) => {
        // Validation en deux temps (mode puis index), mutation en un seul RPC.
        const afterMode =
          screenRef.current.mode === 'intro'
            ? { ok: true as const, state: screenRef.current }
            : applyAction(screenRef.current, { type: 'SET_MODE', mode: 'intro' })
        if (!afterMode.ok) {
          setLastError(afterMode.reason)
          return
        }
        const afterIndex = applyAction(afterMode.state, { type: 'SET_INTRO_SLIDE', index })
        if (!afterIndex.ok) {
          setLastError(afterIndex.reason)
          return
        }
        setScreen(afterIndex.state)
        mutations.setIntroMode(session, index).catch((err: unknown) => {
          setLastError(err instanceof Error ? err.message : 'Erreur réseau')
        })
      },
      [session],
    ),
    setMainContent: useCallback(
      (contentId: string | null) =>
        dispatch({ type: 'SET_MAIN_CONTENT', contentId }, () =>
          mutations.setMainContent(session, contentId),
        ),
      [dispatch, session],
    ),
    showOverlay: useCallback(
      (overlay: Overlay) =>
        dispatch({ type: 'SHOW_OVERLAY', overlay }, () =>
          mutations.showOverlay(session, overlay),
        ),
      [dispatch, session],
    ),
    closeOverlay: useCallback(
      () => dispatch({ type: 'CLOSE_OVERLAY' }, () => mutations.closeOverlay(session)),
      [dispatch, session],
    ),
    toggleSpeakersBanner: useCallback(() => {
      const next = !screenRef.current.speakersBannerVisible
      dispatch({ type: 'TOGGLE_SPEAKERS_BANNER' }, () =>
        mutations.setSpeakersBannerVisible(session, next),
      )
    }, [dispatch, session]),
    toggleQr: useCallback(() => {
      const next = !screenRef.current.qrVisible
      dispatch({ type: 'TOGGLE_QR' }, () => mutations.setQrVisible(session, next))
    }, [dispatch, session]),
    // Position : cosmétique, hors machine à états. Optimiste + persistance de la map fusionnée.
    setCardPosition: useCallback(
      (key: string, pos: CardPosition) => {
        const next = { ...screenRef.current.cardPositions, [key]: pos }
        setScreen((s) => ({ ...s, cardPositions: next }))
        mutations.setCardPositions(session, next).catch((err: unknown) => {
          setLastError(err instanceof Error ? err.message : 'Erreur réseau')
        })
      },
      [session],
    ),
  }
}
