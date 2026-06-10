// Architecture : checklist pré-événement (Étape 4 du prompt) — règles pures,
// affichées dans le backoffice. Trois niveaux :
//   error   → cassera quelque chose le jour J
//   warning → dégradation visible (fallback)
//   info    → choix possible mais à confirmer
import { isValidHttpUrl, toEmbedUrl } from './embed'
import { assoContentSchema } from './schemas'
import type { Content, Definition, EventPublic, Poll, Speaker, Sponsor } from './types'

export type ChecklistLevel = 'error' | 'warning' | 'info'

export interface ChecklistIssue {
  level: ChecklistLevel
  /** Section du backoffice concernée. */
  section: 'event' | 'speakers' | 'sponsors' | 'contents' | 'definitions' | 'polls'
  message: string
}

export interface ChecklistInput {
  event: EventPublic
  speakers: Speaker[]
  sponsors: Sponsor[]
  contents: Content[]
  definitions: Definition[]
  polls: Poll[]
}

export function buildChecklist(input: ChecklistInput): ChecklistIssue[] {
  const { event, speakers, sponsors, contents, definitions, polls } = input
  const issues: ChecklistIssue[] = []
  const add = (level: ChecklistLevel, section: ChecklistIssue['section'], message: string) =>
    issues.push({ level, section, message })

  // ── Événement ──
  if (!event.startAt) {
    add('error', 'event', 'Heure de début manquante — le timer du mode attente sera vide.')
  }
  if (!event.qrUrl || !isValidHttpUrl(event.qrUrl)) {
    add('warning', 'event', 'URL du QR code manquante ou invalide — le QR code sera masqué sur l’écran public.')
  }
  if (!event.closingMessage) {
    add('info', 'event', 'Pas de message de clôture — l’outro affichera le titre de l’événement.')
  }
  if (event.assoSlideEnabled) {
    const parsed = assoContentSchema.safeParse(event.assoContent)
    if (!parsed.success || !parsed.data?.name) {
      add('error', 'event', 'Slide asso activée mais sans contenu — la renseigner ou la désactiver.')
    }
  }

  // ── Speakers ──
  const visible = speakers.filter((s) => !s.hidden && !s.isHost)
  if (visible.length === 0) {
    add('error', 'speakers', 'Aucun speaker visible — modes attente et intro vides.')
  }
  if (!speakers.some((s) => s.isHost && !s.hidden)) {
    add('warning', 'speakers', 'Pas d’animateur·rice — la slide intro correspondante sera omise.')
  }
  for (const s of speakers.filter((sp) => !sp.hidden)) {
    if (!s.photoUrl) {
      add('warning', 'speakers', `Photo manquante pour ${s.firstName} ${s.lastName} — avatar générique affiché.`)
    }
  }

  // ── Sponsors ──
  if (sponsors.length === 0) {
    add('info', 'sponsors', 'Aucun sponsor — le bandeau sera caché (comportement prévu).')
  }

  // ── Contenus ──
  if (contents.length === 0) {
    add('info', 'contents', 'Aucun contenu pour le mode dynamique — scène calme affichée par défaut.')
  }
  for (const c of contents) {
    if (toEmbedUrl(c.kind, c.url) === null) {
      add('error', 'contents', `URL invalide pour « ${c.label} » — fallback affiché sur l’écran public.`)
    }
  }

  // ── Définitions / sondages ──
  if (definitions.length === 0) {
    add('info', 'definitions', 'Aucune définition préparée.')
  }
  const active = polls.filter((p) => p.status !== 'archived')
  if (active.length === 0) {
    add('info', 'polls', 'Aucun sondage ni vote préparé (création possible en live depuis l’IR).')
  }
  for (const p of active) {
    if (p.options.length < 2) {
      add('error', 'polls', `« ${p.question} » : moins de 2 options — lancement impossible.`)
    }
  }

  return issues
}
