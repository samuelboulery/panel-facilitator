// Overlay définition (PRD 5.4.9) — tiers inférieur, style dictionnaire.
import { useEffect, useState } from 'react'
import { fetchDefinition } from '../../../realtime/eventData'
import type { Definition } from '../../../shared/types'

export function DefinitionOverlay({ id }: { id: string }) {
  const [definition, setDefinition] = useState<Definition | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchDefinition(id).then((d) => {
      if (!cancelled) setDefinition(d)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (!definition) return null

  return (
    <div className="rounded-3xl border border-white/10 bg-ink-soft/95 p-10 shadow-2xl backdrop-blur-md">
      <p className="micro-label mb-4 text-accent">Définition</p>
      <p className="display-title mb-4 text-5xl">{definition.term}</p>
      <p className="max-w-[1100px] text-2xl leading-relaxed text-paper-dim">
        {definition.definition}
      </p>
    </div>
  )
}
