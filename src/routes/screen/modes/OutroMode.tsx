// Mode OUTRO (PRD 5.5) — remerciements + sponsors grand format.
// Aucun sponsor : message de clôture seul (Q4 — pas d'espace vide).
import type { EventData } from '../../../realtime/eventData'

export function OutroMode({ data }: { data: EventData }) {
  const { event, sponsors } = data
  return (
    <div className="relative z-2 flex h-full flex-col items-center justify-center gap-20 pb-16 text-center">
      <div>
        <p className="micro-label mb-8">Merci</p>
        <h1 className="display-title max-w-[1300px] text-7xl">
          {event.closingMessage ?? event.title}
        </h1>
      </div>

      {sponsors.length > 0 && (
        <div className="flex max-w-[1400px] flex-wrap items-center justify-center gap-x-20 gap-y-10">
          {sponsors.map((sponsor) => (
            <img
              key={sponsor.id}
              src={sponsor.logoUrl}
              alt={sponsor.name}
              className="max-h-16 w-auto opacity-90 brightness-0 invert"
              draggable={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}
