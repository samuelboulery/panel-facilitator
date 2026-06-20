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
  branding_profile_id: string | null
  screen_token: string
}

/** Premier événement (mono-événement V1). Null si aucun. */
export async function fetchAdminEvent(): Promise<AdminEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, slug, title, subtitle, edition, event_date, start_at, closing_message, asso_slide_enabled, asso_content, qr_url, sponsor_scroll_speed, branding_profile_id, screen_token',
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

// ── Bibliothèque de speakers réutilisables (table globale `people`) ──
// Peuplée automatiquement par trigger DB dès qu'un speaker est enregistré.
// Import = copie de la fiche dans une ligne speakers de l'événement courant
// (snapshot éditable, aucun lien conservé).

export interface Person {
  id: string
  first_name: string
  last_name: string
  title: string | null
  company: string | null
  bio: string | null
  photo_url: string | null
  gender: 'f' | 'm' | null
}

export async function listPeople(): Promise<Person[]> {
  const { data, error } = await supabase
    .from('people')
    .select('id, first_name, last_name, title, company, bio, photo_url, gender')
    .order('last_name', { ascending: true })
  if (error || !data) return []
  return data as Person[]
}

/** Retire une fiche de la bibliothèque. Réapparaît si un speaker du même nom est ré-enregistré. */
export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) throw new Error(`Suppression refusée : ${error.message}`)
}

/** Copie une fiche bibliothèque dans les speakers de l'événement (rôle panel par défaut). */
export async function importPersonToEvent(person: Person, eventId: string): Promise<void> {
  const { data } = await supabase
    .from('speakers')
    .select('sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = (data?.[0]?.sort_order ?? -1) + 1
  await insertRow('speakers', {
    event_id: eventId,
    first_name: person.first_name,
    last_name: person.last_name,
    title: person.title,
    company: person.company,
    bio: person.bio,
    photo_url: person.photo_url,
    gender: person.gender,
    is_host: false,
    sort_order: nextOrder,
  })
}

// ── Profils de branding (palette + image de fond, nommés, par événement) ──
// L'EP applique le profil actif de l'événement (events.branding_profile_id ;
// à défaut, le premier créé — cf. fetchBranding, eventData).

export interface BrandingProfile {
  id: string
  event_id: string
  name: string
  bg_color: string
  text_color: string
  accent_color: string
  bg_image_url: string | null
}

export async function listBrandingProfiles(eventId: string): Promise<BrandingProfile[]> {
  const { data, error } = await supabase
    .from('branding_profiles')
    .select('id, event_id, name, bg_color, text_color, accent_color, bg_image_url')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data as BrandingProfile[]
}

export async function createBrandingProfile(
  values: Omit<BrandingProfile, 'id'>,
): Promise<void> {
  const { error } = await supabase.from('branding_profiles').insert(values)
  if (error) throw new Error(`Ajout refusé : ${error.message}`)
}

export async function updateBrandingProfile(
  id: string,
  values: Partial<Omit<BrandingProfile, 'id' | 'event_id'>>,
): Promise<void> {
  const { error } = await supabase.from('branding_profiles').update(values).eq('id', id)
  if (error) throw new Error(`Modification refusée : ${error.message}`)
}

export async function deleteBrandingProfile(id: string): Promise<void> {
  const { error } = await supabase.from('branding_profiles').delete().eq('id', id)
  if (error) throw new Error(`Suppression refusée : ${error.message}`)
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

// ── Génération de définition par IA (Edge Function define-term) ──
// Réutilise la fonction de l'IR ; côté backoffice l'auth se fait par le JWT
// organisateur (joint automatiquement par le client connecté), pas par PIN.
// La fonction insère directement la définition générée dans l'événement.

export async function generateDefinition(slug: string, term: string): Promise<void> {
  const { error } = await supabase.functions.invoke('define-term', {
    body: { slug, term },
  })
  if (error) {
    // supabase-js masque le corps d'un non-2xx derrière error.context (Response) :
    // on l'extrait pour remonter le vrai message (PIN/auth, rate-limit, LLM…).
    let detail = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = (await ctx.json()) as { error?: string }
        if (body?.error) detail = body.error
      } catch {
        /* corps illisible : on garde error.message */
      }
    }
    throw new Error(`Génération de définition échouée : ${detail}`)
  }
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
  folder: 'speakers' | 'sponsors' | 'definitions' | 'branding',
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
