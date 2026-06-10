// Mode INTRO — slide titre statique en attendant le Sprint 3 (séquence
// complète : asso → titre → animateur → speakers → grille).
// Intentionnellement identique en composition au mode attente, sans timer.
import type { EventData } from '../../../realtime/eventData'

export function IntroMode({ data }: { data: EventData }) {
  const { event } = data
  return (
    <div className="relative z-2 flex h-full flex-col items-center justify-center pb-16 text-center">
      <p className="micro-label mb-8">
        {[event.subtitle, event.edition].filter(Boolean).join(' — ') || 'Table ronde'}
      </p>
      <h1 className="display-title max-w-[1300px] text-8xl">{event.title}</h1>
      {event.eventDate && (
        <p className="micro-label mt-10">
          {new Date(event.eventDate).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}
