// Section Checklist pré-événement — exécute les règles pures de
// src/shared/checklist sur l'état actuel et liste les problèmes par sévérité.
import { useCallback, useEffect, useState } from 'react'
import { listRows, type AdminEvent } from '../../../realtime/adminData'
import { buildChecklist, type ChecklistIssue } from '../../../shared/checklist'
import {
  contentRowSchema,
  definitionRowSchema,
  pollRowSchema,
  speakerRowSchema,
  sponsorRowSchema,
} from '../../../shared/schemas'
import type { EventPublic } from '../../../shared/types'

const LEVEL_STYLE = {
  error: { icon: '⛔', label: 'Bloquant', class: 'border-red-300 bg-red-50' },
  warning: { icon: '⚠️', label: 'Dégradé', class: 'border-amber-300 bg-amber-50' },
  info: { icon: 'ℹ️', label: 'Info', class: 'border-control-bg bg-white' },
} as const

const SECTION_LABELS = {
  event: 'Événement',
  speakers: 'Speakers',
  sponsors: 'Sponsors',
  contents: 'Contenus',
  definitions: 'Définitions',
  polls: 'Sondages / votes',
} as const

function toEventPublic(e: AdminEvent): EventPublic {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    subtitle: e.subtitle,
    edition: e.edition,
    eventDate: e.event_date,
    startAt: e.start_at,
    closingMessage: e.closing_message,
    assoSlideEnabled: e.asso_slide_enabled,
    assoContent: e.asso_content,
    qrUrl: e.qr_url,
    sponsorScrollSpeed: e.sponsor_scroll_speed,
    brandingProfileId: e.branding_profile_id,
  }
}

function parseAll<T>(
  rows: unknown[],
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  dropped: { count: number },
): T[] {
  const parsed = rows.map((r) => schema.safeParse(r))
  dropped.count += parsed.filter((r) => !r.success).length
  return parsed.filter((r) => r.success).map((r) => r.data as T)
}

export function ChecklistSection({ event }: { event: AdminEvent }) {
  const [issues, setIssues] = useState<ChecklistIssue[] | null>(null)

  const run = useCallback(async () => {
    const [speakers, sponsors, contents, definitions, polls] = await Promise.all([
      listRows<unknown>('speakers', event.id),
      listRows<unknown>('sponsors', event.id),
      listRows<unknown>('contents', event.id),
      listRows<unknown>('definitions', event.id),
      listRows<unknown>('polls', event.id),
    ])
    // Des lignes illisibles ne doivent JAMAIS donner un faux « prêt » :
    // elles deviennent un point bloquant de la checklist.
    const dropped = { count: 0 }
    const result = buildChecklist({
      event: toEventPublic(event),
      speakers: parseAll(speakers, speakerRowSchema, dropped),
      sponsors: parseAll(sponsors, sponsorRowSchema, dropped),
      contents: parseAll(contents, contentRowSchema, dropped),
      definitions: parseAll(definitions, definitionRowSchema, dropped),
      polls: parseAll(polls, pollRowSchema, dropped),
    })
    if (dropped.count > 0) {
      result.unshift({
        level: 'error',
        section: 'event',
        message: `${dropped.count} ligne(s) de données illisible(s) — analyse incomplète, vérifier les contenus.`,
      })
    }
    setIssues(result)
  }, [event])

  useEffect(() => {
    void run()
  }, [run])

  if (issues === null) {
    return <p className="font-mono text-sm text-control-dim">Analyse…</p>
  }

  const errors = issues.filter((i) => i.level === 'error')
  const ready = errors.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-2xl p-5 text-center ${
          ready ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
        }`}
      >
        <p className="text-xl font-bold">
          {ready ? 'Prêt pour l’événement ✓' : `${errors.length} point(s) bloquant(s)`}
        </p>
        <p className="mt-1 font-mono text-xs opacity-70">
          {issues.length === 0
            ? 'Aucune remarque.'
            : `${issues.length} remarque(s) au total — relancer l’analyse après correction.`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {issues.map((issue, i) => {
          const style = LEVEL_STYLE[issue.level]
          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl border p-3 ${style.class}`}
            >
              <span aria-hidden>{style.icon}</span>
              <div>
                <p className="text-sm">{issue.message}</p>
                <p className="mt-0.5 font-mono text-[11px] text-control-dim">
                  {style.label} · {SECTION_LABELS[issue.section]}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => void run()}
        className="self-start rounded-xl bg-control-ink px-5 py-2.5 font-mono text-sm text-white active:scale-95"
      >
        Relancer l’analyse
      </button>
    </div>
  )
}
