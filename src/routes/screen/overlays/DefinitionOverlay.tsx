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
    <div className="stage-card flex items-center gap-10">
      <div className="min-w-0 flex-1">
        <p className="micro-label mb-4 text-accent">Définition</p>
        <p className="display-title mb-4 text-5xl">{definition.term}</p>
        <p className="max-w-[68.75rem] text-2xl leading-relaxed text-paper-dim">
          {definition.definition}
        </p>
      </div>
      {definition.imageUrl && (
        <img
          src={definition.imageUrl}
          alt=""
          className="h-56 w-56 shrink-0 rounded-2xl object-cover"
        />
      )}
    </div>
  )
}
