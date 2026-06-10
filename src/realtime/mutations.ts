// Architecture : mutations de la régie et de l'audience — exclusivement via RPC
// (aucune écriture directe de table depuis le client, voir migration initiale).
// L'IR valide chaque action avec la machine à états (src/shared) AVANT d'appeler
// ces fonctions ; la DB reste la source de vérité.
import { supabase } from './client'
import type { Overlay, Mode, PollKind } from '../shared/types'

export interface ControlSession {
  slug: string
  pin: string
  eventId: string
}

/** Vérifie le PIN et ouvre une session régie. Null si PIN invalide. */
export async function controlAuth(slug: string, pin: string): Promise<ControlSession | null> {
  const { data, error } = await supabase.rpc('control_auth', { p_slug: slug, p_pin: pin })
  if (error || !data) return null
  return { slug, pin, eventId: data as string }
}

type ScreenStatePatch = Partial<{
  mode: Mode
  intro_slide_index: number
  main_content_id: string | null
  overlay: Overlay | null
  speakers_banner_visible: boolean
  qr_visible: boolean
}>

/** Log détaillé côté console, message générique côté UI (pas de fuite d'erreur DB). */
function rpcError(context: string, error: unknown): Error {
  console.error(`[mutations] ${context} :`, error)
  return new Error(`${context} — réessayer ou vérifier la connexion.`)
}

async function patchScreenState(session: ControlSession, patch: ScreenStatePatch): Promise<void> {
  const { error } = await supabase.rpc('update_screen_state', {
    p_slug: session.slug,
    p_pin: session.pin,
    p_patch: patch,
  })
  if (error) throw rpcError('Mutation écran refusée', error)
}

export const setMode = (s: ControlSession, mode: Mode) =>
  patchScreenState(s, { mode })

export const setIntroSlide = (s: ControlSession, index: number) =>
  patchScreenState(s, { intro_slide_index: index })

export const setMainContent = (s: ControlSession, contentId: string | null) =>
  patchScreenState(s, { main_content_id: contentId })

export const showOverlay = (s: ControlSession, overlay: Overlay) =>
  patchScreenState(s, { overlay })

export const closeOverlay = (s: ControlSession) =>
  patchScreenState(s, { overlay: null })

export const setSpeakersBannerVisible = (s: ControlSession, visible: boolean) =>
  patchScreenState(s, { speakers_banner_visible: visible })

export const setQrVisible = (s: ControlSession, visible: boolean) =>
  patchScreenState(s, { qr_visible: visible })

export async function setPollStatus(
  s: ControlSession,
  pollId: string,
  status: 'live' | 'closed' | 'archived',
): Promise<void> {
  const { error } = await supabase.rpc('control_set_poll_status', {
    p_slug: s.slug, p_pin: s.pin, p_poll_id: pollId, p_status: status,
  })
  if (error) throw rpcError('Changement de statut refusé', error)
}

export async function createLivePoll(
  s: ControlSession,
  kind: PollKind,
  question: string,
  options: { id: string; label: string }[],
): Promise<string> {
  const { data, error } = await supabase.rpc('control_create_poll', {
    p_slug: s.slug, p_pin: s.pin, p_kind: kind, p_question: question, p_options: options,
  })
  if (error) throw rpcError('Création de sondage refusée', error)
  return data as string
}

export async function setQuestionStatus(
  s: ControlSession,
  questionId: string,
  status: 'pending' | 'displayed' | 'done' | 'archived',
): Promise<void> {
  const { error } = await supabase.rpc('control_update_question_status', {
    p_slug: s.slug, p_pin: s.pin, p_question_id: questionId, p_status: status,
  })
  if (error) throw rpcError('Changement de statut refusé', error)
}

export async function setSpeakerHidden(
  s: ControlSession,
  speakerId: string,
  hidden: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('control_set_speaker_hidden', {
    p_slug: s.slug, p_pin: s.pin, p_speaker_id: speakerId, p_hidden: hidden,
  })
  if (error) throw rpcError('Masquage du speaker refusé', error)
}

export async function setQuestionPinned(
  s: ControlSession,
  questionId: string,
  pinned: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('control_set_question_pinned', {
    p_slug: s.slug, p_pin: s.pin, p_question_id: questionId, p_pinned: pinned,
  })
  if (error) throw rpcError('Épinglage refusé', error)
}

export async function saveNotes(s: ControlSession, contentMd: string): Promise<void> {
  const { error } = await supabase.rpc('control_save_notes', {
    p_slug: s.slug, p_pin: s.pin, p_content_md: contentMd,
  })
  if (error) throw rpcError('Sauvegarde des notes refusée', error)
}

// ── Audience (formulaire QR) ──

export async function submitQuestion(
  slug: string,
  text: string,
  authorName?: string,
): Promise<void> {
  const { error } = await supabase.rpc('submit_question', {
    p_slug: slug, p_text: text, p_author_name: authorName ?? null,
  })
  if (error) throw rpcError('Envoi de la question refusé', error)
}

export async function castVote(
  pollId: string,
  optionId: string,
  fingerprint: string,
): Promise<void> {
  const { error } = await supabase.rpc('cast_vote', {
    p_poll_id: pollId, p_option_id: optionId, p_fingerprint: fingerprint,
  })
  if (error) throw rpcError('Vote refusé', error)
}
