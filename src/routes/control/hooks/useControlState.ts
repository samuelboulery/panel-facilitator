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
import type { ScreenState, Mode, Overlay } from '../../../shared/types'
import type { ControlSession } from '../../../realtime/mutations'
import * as mutations from '../../../realtime/mutations'
import { subscribeScreenState, type ConnectionStatus } from '../../../realtime/screenState'
import { watchScreenPresence } from '../../../realtime/presence'
import { measureLatency } from '../../../realtime/controlData'

const LATENCY_INTERVAL_MS = 10_000

export interface ControlState {
  screen: ScreenState
  connection: ConnectionStatus
  screenOnline: boolean
  latencyMs: number | null
  /** Dernier refus de la machine à états — à afficher en toast. */
  lastError: string | null
  clearError: () => void
  setMode: (mode: Mode) => void
  setIntroSlide: (index: number) => void
  setMainContent: (contentId: string | null) => void
  showOverlay: (overlay: Overlay) => void
  closeOverlay: () => void
  toggleSpeakersBanner: () => void
  toggleQr: () => void
}

export function useControlState(session: ControlSession): ControlState {
  const [screen, setScreen] = useState<ScreenState>(initialScreenState)
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const [screenOnline, setScreenOnline] = useState(false)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
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
    const presence = watchScreenPresence(session.eventId, setScreenOnline)
    return () => {
      sub.unsubscribe()
      presence.leave()
    }
  }, [session.eventId])

  useEffect(() => {
    let disposed = false
    const ping = async () => {
      const ms = await measureLatency()
      if (!disposed) setLatencyMs(ms)
    }
    void ping()
    const id = setInterval(ping, LATENCY_INTERVAL_MS)
    return () => {
      disposed = true
      clearInterval(id)
    }
  }, [])

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
    screenOnline,
    latencyMs,
    lastError,
    clearError: useCallback(() => setLastError(null), []),
    setMode: useCallback(
      (mode: Mode) =>
        dispatch({ type: 'SET_MODE', mode }, () => mutations.setMode(session, mode)),
      [dispatch, session],
    ),
    setIntroSlide: useCallback(
      (index: number) =>
        dispatch({ type: 'SET_INTRO_SLIDE', index }, () =>
          mutations.setIntroSlide(session, index),
        ),
      [dispatch, session],
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
  }
}
