// Architecture : mutations de la régie et de l'audience — exclusivement via RPC
// (aucune écriture directe de table depuis le client, voir migration initiale).
// L'IR valide chaque action avec la machine à états (src/shared) AVANT d'appeler
// ces fonctions ; la DB reste la source de vérité.
//
// Convention `.catch(() => undefined)` côté appelants (GestionView, ControlRoute…) :
// échec RPC volontairement silencieux. Mono-opérateur V1 — l'état serveur fait foi
// et se re-synchronise au prochain événement realtime ; rpcError() a déjà loggé le
// détail en console. Pas de retry (D : simplicité > robustesse réseau V1).
import { supabase } from './client'
import type { Overlay, Mode, PollKind, CardPosition } from '../shared/types'

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
  timer_started_at: string | null
  card_positions: Record<string, CardPosition>
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

/** Entrée en mode intro directement sur une slide donnée — UN SEUL patch
 *  (deux RPCs séquentiels créeraient une course mode/index côté serveur). */
export const setIntroMode = (s: ControlSession, index: number) =>
  patchScreenState(s, { mode: 'intro', intro_slide_index: index })

export const setMainContent = (s: ControlSession, contentId: string | null) =>
  patchScreenState(s, { main_content_id: contentId })

/** Lance un contenu : entre en mode dynamique ET fixe le contenu — UN SEUL patch
 *  (deux RPCs séquentiels créeraient une course mode/contenu côté serveur). */
export const setDynamicContent = (s: ControlSession, contentId: string) =>
  patchScreenState(s, { mode: 'dynamique', main_content_id: contentId })

export const showOverlay = (s: ControlSession, overlay: Overlay) =>
  patchScreenState(s, { overlay })

export const closeOverlay = (s: ControlSession) =>
  patchScreenState(s, { overlay: null })

export const setSpeakersBannerVisible = (s: ControlSession, visible: boolean) =>
  patchScreenState(s, { speakers_banner_visible: visible })

export const setQrVisible = (s: ControlSession, visible: boolean) =>
  patchScreenState(s, { qr_visible: visible })

/** Timer de durée manuel (barre d'état IR) : ISO pour démarrer, null pour arrêter. */
export const setTimerStartedAt = (s: ControlSession, startedAt: string | null) =>
  patchScreenState(s, { timer_started_at: startedAt })

/** Positions des cartes de scène (drag & drop) — map slideKey → offset, fusionnée côté client. */
export const setCardPositions = (
  s: ControlSession,
  positions: Record<string, CardPosition>,
) => patchScreenState(s, { card_positions: positions })

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

export async function createQuestion(s: ControlSession, text: string): Promise<void> {
  const { error } = await supabase.rpc('control_create_question', {
    p_slug: s.slug, p_pin: s.pin, p_text: text,
  })
  if (error) throw rpcError('Création de question refusée', error)
}

export async function setDefinitionUsed(
  s: ControlSession,
  definitionId: string,
  used: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('control_set_definition_used', {
    p_slug: s.slug, p_pin: s.pin, p_definition_id: definitionId, p_used: used,
  })
  if (error) throw rpcError('Marquage de définition refusé', error)
}

export type ReorderableTable = 'questions' | 'definitions' | 'polls'

/** Persiste l'ordre après un drag & drop (whitelist côté serveur). */
export async function reorderList(
  s: ControlSession,
  table: ReorderableTable,
  ids: string[],
): Promise<void> {
  const { error } = await supabase.rpc('control_reorder', {
    p_slug: s.slug, p_pin: s.pin, p_table: table, p_ids: ids,
  })
  if (error) throw rpcError('Réordonnancement refusé', error)
}

/** Génère une définition courte par LLM (Edge Function — clé API côté serveur). */
export async function generateDefinition(s: ControlSession, term: string): Promise<void> {
  const { error } = await supabase.functions.invoke('define-term', {
    body: { slug: s.slug, pin: s.pin, term },
  })
  if (error) throw rpcError('Génération de définition échouée', error)
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
