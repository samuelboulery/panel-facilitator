// Mode OUTRO (PRD 5.5) — remerciements + sponsors grand format.
// Aucun sponsor : message de clôture seul (Q4 — pas d'espace vide).
import type { EventData } from '../../../realtime/eventData'
import { MovableCard } from '../components/MovableCard'

export function OutroMode({ data }: { data: EventData }) {
  const { event, sponsors } = data
  return (
    <div className="relative z-2 h-full text-center">
      <MovableCard
        slideKey="outro-thanks"
        className="stage-card absolute left-1/2 top-[34%] max-w-[1300px] -translate-x-1/2 -translate-y-1/2 text-center"
      >
        <p className="micro-label mb-8">Merci</p>
        <h1 className="display-title text-7xl">
          {event.closingMessage ?? event.title}
        </h1>
      </MovableCard>

      {sponsors.length > 0 && (
        <MovableCard
          slideKey="outro-sponsors"
          className="stage-card absolute bottom-[12%] left-1/2 w-fit max-w-[1400px] -translate-x-1/2"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-20 gap-y-10">
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
        </MovableCard>
      )}
    </div>
  )
}
