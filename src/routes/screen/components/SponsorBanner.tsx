// Bandeau sponsors permanent (PRD 5.1.1) — visible sur les 4 modes,
// totalement absent si aucun sponsor (pas d'espace vide, Q4).
// Défilement CSS pur (transform) : 60fps garanti, aucun re-render.
import type { Sponsor } from '../../../shared/types'

interface SponsorBannerProps {
  sponsors: Sponsor[]
  /** Durée d'un cycle complet en secondes (config backoffice). */
  scrollSpeed: number
}

export function SponsorBanner({ sponsors, scrollSpeed }: SponsorBannerProps) {
  if (sponsors.length === 0) return null

  // Piste dupliquée : la translation de -50 % boucle sans couture.
  const track = [...sponsors, ...sponsors]

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 h-16 border-t border-white/10 bg-ink-soft/90 backdrop-blur-sm">
      <div
        className="sponsor-track h-full items-center"
        style={{ '--marquee-duration': `${scrollSpeed}s` } as React.CSSProperties}
      >
        {track.map((sponsor, i) => (
          <div key={`${sponsor.id}-${i}`} className="flex h-full items-center px-14">
            <img
              src={sponsor.logoUrl}
              alt={sponsor.name}
              className="max-h-8 w-auto opacity-80 brightness-0 invert"
              draggable={false}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
