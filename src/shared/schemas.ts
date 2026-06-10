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
  })
  .transform(
    (row): ScreenState => ({
      mode: row.mode,
      introSlideIndex: row.intro_slide_index,
      mainContentId: row.main_content_id,
      overlay: row.overlay,
      speakersBannerVisible: row.speakers_banner_visible,
      qrVisible: row.qr_visible,
    }),
  )

export const questionSubmissionSchema = z.object({
  text: z.string().trim().min(1, 'Question vide').max(300, '300 caractères maximum'),
  authorName: z.string().trim().max(80).optional(),
})

export const pinSchema = z
  .string()
  .regex(/^\d{4,8}$/, 'PIN : 4 à 8 chiffres')
