// Architecture : accès données du backoffice. Écritures directes de tables
// (rôle authenticated = pleins droits via RLS) — seules exceptions : le PIN
// (RPC admin_set_pin, hash serveur) et l'upload d'images (Storage).
// L'optimisation WebP est faite côté client avant upload (PRD 7.2).
import { supabase } from './client'

export interface AdminEvent {
  id: string
  slug: string
  title: string
  subtitle: string | null
  edition: string | null
  event_date: string | null
  start_at: string | null
  closing_message: string | null
  asso_slide_enabled: boolean
  asso_content: { name?: string; description?: string } | null
  qr_url: string | null
  sponsor_scroll_speed: number
  screen_token: string
}

/** Premier événement (mono-événement V1). Null si aucun. */
export async function fetchAdminEvent(): Promise<AdminEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, slug, title, subtitle, edition, event_date, start_at, closing_message, asso_slide_enabled, asso_content, qr_url, sponsor_scroll_speed, screen_token',
    )
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data as AdminEvent
}

export async function updateAdminEvent(
  id: string,
  patch: Partial<Omit<AdminEvent, 'id' | 'screen_token'>>,
): Promise<void> {
  const { error } = await supabase.from('events').update(patch).eq('id', id)
  if (error) throw new Error(`Sauvegarde refusée : ${error.message}`)
}

export async function createAdminEvent(slug: string, title: string): Promise<void> {
  // PIN provisoire aléatoire — l'organisateur le définit ensuite via le formulaire.
  const { error } = await supabase.rpc('admin_create_event', { p_slug: slug, p_title: title })
  if (error) throw new Error(`Création refusée : ${error.message}`)
}

export async function setEventPin(eventId: string, pin: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_pin', { p_event_id: eventId, p_pin: pin })
  if (error) throw new Error(`PIN refusé : ${error.message}`)
}

// ── CRUD générique des listes rattachées à l'événement ──

export type AdminTable =
  | 'speakers'
  | 'sponsors'
  | 'contents'
  | 'definitions'
  | 'questions'
  | 'polls'

export async function listRows<T>(
  table: AdminTable,
  eventId: string,
  match?: Record<string, unknown>,
): Promise<T[]> {
  let query = supabase.from(table).select('*').eq('event_id', eventId)
  // Filtre additionnel (ex. kind='poll' vs 'versus' sur la table partagée polls).
  if (match) query = query.match(match)
  const { data, error } = await query.order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as T[]
}

export async function insertRow(
  table: AdminTable,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from(table).insert(values)
  if (error) throw new Error(`Ajout refusé : ${error.message}`)
}

export async function updateRow(
  table: AdminTable,
  id: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from(table).update(values).eq('id', id)
  if (error) throw new Error(`Modification refusée : ${error.message}`)
}

export async function deleteRow(table: AdminTable, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw new Error(`Suppression refusée : ${error.message}`)
}

// ── Réinitialisation de table ronde (RPC admin_reset_round) ──

export type ResetScope = 'all' | 'definitions' | 'questions' | 'polls' | 'votes'

/**
 * Remet l'état « déjà lancé » à zéro (used/status/votes/overlay) sans supprimer
 * le contenu configuré. RPC atomique multi-tables. Options : suppression des
 * questions du public et des sondages/votes créés en direct.
 */
export async function resetRound(
  eventId: string,
  scope: ResetScope,
  opts?: { deleteAudience?: boolean; deleteAdhoc?: boolean },
): Promise<void> {
  const { error } = await supabase.rpc('admin_reset_round', {
    p_event_id: eventId,
    p_scope: scope,
    p_delete_audience: opts?.deleteAudience ?? false,
    p_delete_adhoc: opts?.deleteAdhoc ?? false,
  })
  if (error) throw new Error(`Réinitialisation refusée : ${error.message}`)
}

// ── Upload d'images : redimensionnement + WebP côté client (PRD 7.2) ──

async function toWebp(file: File, maxDim: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas indisponible')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Conversion WebP échouée'))),
        'image/webp',
        0.85,
      )
    })
  } finally {
    bitmap.close()
  }
}

/**
 * Convertit en WebP (côté client), uploade dans le bucket media, retourne
 * l'URL publique. maxDim : 800 pour les photos, 400 pour les logos.
 */
export async function uploadImage(
  file: File,
  folder: 'speakers' | 'sponsors',
  maxDim = 800,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Le fichier doit être une image')
  }
  const blob = await toWebp(file, maxDim)
  const path = `${folder}/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage.from('media').upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000',
  })
  if (error) throw new Error(`Upload refusé : ${error.message}`)
  const { data } = supabase.storage.from('media').getPublicUrl(path)
  return data.publicUrl
}
