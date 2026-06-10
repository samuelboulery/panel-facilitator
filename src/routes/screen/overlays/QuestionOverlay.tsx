// Overlay question (PRD 5.4.6) — préparée ou issue de l'audience.
// Grande citation, attribution mono ; max 300 caractères garanti en amont.
import { useEffect, useState } from 'react'
import { fetchQuestion } from '../../../realtime/eventData'
import type { Question } from '../../../shared/types'

export function QuestionOverlay({ id }: { id: string }) {
  const [question, setQuestion] = useState<Question | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchQuestion(id).then((q) => {
      if (!cancelled) setQuestion(q)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (!question) return null

  const attribution =
    question.source === 'audience'
      ? question.authorName
        ? `Question de ${question.authorName}`
        : 'Question du public'
      : 'Question'

  return (
    <div className="rounded-3xl border border-accent/40 bg-ink-soft/95 p-10 shadow-2xl backdrop-blur-md">
      <p className="micro-label mb-5 text-accent">{attribution}</p>
      <p className="display-title max-w-[1240px] text-5xl leading-tight">
        {question.text}
      </p>
    </div>
  )
}
