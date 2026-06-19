// Architecture : validation aux frontières (PLAN.md, règles projet).
// Toute donnée venant de Supabase (fetch ou payload realtime) passe par ces
// schémas avant d'entrer dans l'app — jamais de cast aveugle.
import { z } from 'zod'
import type { ScreenState } from './types'

export const modeSchema = z.enum(['attente', 'intro', 'dynamique', 'outro'])

export const overlaySchema = z.object({
  type: z.enum(['poll', 'question', 'definition']),
  id: z.string().min(1),
})

/** Ligne `screen_state` (snake_case DB) → ScreenState (camelCase app). */
export const screenStateRowSchema = z
  .object({
    mode: modeSchema,
    intro_slide_index: z.number().int().min(0),
    main_content_id: z.string().uuid().nullable(),
    overlay: overlaySchema.nullable(),
    speakers_banner_visible: z.boolean(),
    qr_visible: z.boolean(),
    timer_started_at: z.string().nullable().default(null),
    card_positions: z
      .record(
        z.object({
          x: z.number(),
          y: z.number(),
          edge: z.enum(['top', 'bottom', 'left', 'right']).optional(),
        }),
      )
      .default({}),
  })
  .transform(
    (row): ScreenState => ({
      mode: row.mode,
      introSlideIndex: row.intro_slide_index,
      mainContentId: row.main_content_id,
      overlay: row.overlay,
      speakersBannerVisible: row.speakers_banner_visible,
      qrVisible: row.qr_visible,
      timerStartedAt: row.timer_started_at,
      cardPositions: row.card_positions,
    }),
  )

export const eventPublicRowSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    subtitle: z.string().nullable(),
    edition: z.string().nullable(),
    event_date: z.string().nullable(),
    start_at: z.string().nullable(),
    closing_message: z.string().nullable(),
    asso_slide_enabled: z.boolean(),
    asso_content: z.unknown().nullable(),
    qr_url: z.string().nullable(),
    sponsor_scroll_speed: z.number(),
    branding_profile_id: z.string().uuid().nullable().default(null),
  })
  .transform((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    edition: r.edition,
    eventDate: r.event_date,
    startAt: r.start_at,
    closingMessage: r.closing_message,
    assoSlideEnabled: r.asso_slide_enabled,
    assoContent: r.asso_content ?? null,
    qrUrl: r.qr_url,
    sponsorScrollSpeed: r.sponsor_scroll_speed,
    brandingProfileId: r.branding_profile_id,
  }))

export const speakerRowSchema = z
  .object({
    id: z.string().uuid(),
    first_name: z.string(),
    last_name: z.string(),
    title: z.string().nullable(),
    company: z.string().nullable(),
    bio: z.string().nullable(),
    photo_url: z.string().nullable(),
    is_host: z.boolean(),
    gender: z.enum(['f', 'm']).nullable(),
    sort_order: z.number(),
    hidden: z.boolean(),
  })
  .transform((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    title: r.title,
    company: r.company,
    bio: r.bio,
    photoUrl: r.photo_url,
    isHost: r.is_host,
    gender: r.gender,
    sortOrder: r.sort_order,
    hidden: r.hidden,
  }))

export const sponsorRowSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    logo_url: z.string(),
    sort_order: z.number(),
  })
  .transform((r) => ({
    id: r.id,
    name: r.name,
    logoUrl: r.logo_url,
    sortOrder: r.sort_order,
  }))

export const contentRowSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(['embed_gslides', 'embed_figma', 'image', 'video']),
    url: z.string(),
    label: z.string(),
    sort_order: z.number(),
  })
  .transform((r) => ({
    id: r.id,
    kind: r.kind,
    url: r.url,
    label: r.label,
    sortOrder: r.sort_order,
  }))

export const brandingRowSchema = z
  .object({
    bg_color: z.string(),
    text_color: z.string(),
    accent_color: z.string(),
    bg_image_url: z.string().nullable().default(null),
  })
  .transform((r) => ({
    bgColor: r.bg_color,
    textColor: r.text_color,
    accentColor: r.accent_color,
    bgImageUrl: r.bg_image_url,
  }))

export const definitionRowSchema = z
  .object({
    id: z.string().uuid(),
    term: z.string(),
    definition: z.string(),
    image_url: z.string().nullable().default(null),
    sort_order: z.number(),
    used: z.boolean().default(false),
  })
  .transform((r) => ({
    id: r.id,
    term: r.term,
    definition: r.definition,
    imageUrl: r.image_url,
    sortOrder: r.sort_order,
    used: r.used,
  }))

export const questionRowSchema = z
  .object({
    id: z.string().uuid(),
    text: z.string(),
    source: z.enum(['prepared', 'audience']),
    status: z.enum(['pending', 'displayed', 'done', 'archived']),
    author_name: z.string().nullable(),
    pinned: z.boolean(),
    sort_order: z.number(),
  })
  .transform((r) => ({
    id: r.id,
    text: r.text,
    source: r.source,
    status: r.status,
    authorName: r.author_name,
    pinned: r.pinned,
    sortOrder: r.sort_order,
  }))

export const pollRowSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(['poll', 'versus']),
    question: z.string(),
    options: z.array(z.object({ id: z.string(), label: z.string() })),
    status: z.enum(['draft', 'live', 'closed', 'archived']),
    show_results: z.boolean(),
  })
  .transform((r) => ({
    id: r.id,
    kind: r.kind,
    question: r.question,
    options: r.options,
    status: r.status,
    showResults: r.show_results,
  }))

/** Contenu de la slide asso (jsonb libre en DB — validé au rendu). */
export const assoContentSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
  })
  .nullable()

export const questionSubmissionSchema = z.object({
  text: z.string().trim().min(1, 'Question vide').max(300, '300 caractères maximum'),
  authorName: z.string().trim().max(80).optional(),
})

export const pinSchema = z
  .string()
  .regex(/^\d{4,8}$/, 'PIN : 4 à 8 chiffres')
