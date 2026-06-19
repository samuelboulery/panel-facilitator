// Bandeau sponsors permanent (PRD 5.1.1) — visible sur les 4 modes,
// totalement absent si aucun sponsor (pas d'espace vide, Q4).
// Défilement CSS pur (transform) : 60fps garanti, aucun re-render pendant l'anim.
// On mesure la largeur d'un set au montage et on le répète assez pour couvrir
// l'écran : avec peu de sponsors (cas courant : 2), une simple duplication
// laisserait un trou qui traverse la ligne. Deux sets identiques + translateX(-50%)
// = boucle infinie sans couture quel que soit le nombre de sponsors.
import { useEffect, useRef, useState } from 'react'
import type { Sponsor } from '../../../shared/types'

interface SponsorBannerProps {
  sponsors: Sponsor[]
  /** Durée d'un cycle complet en secondes (config backoffice). */
  scrollSpeed: number
}

export function SponsorBanner({ sponsors, scrollSpeed }: SponsorBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const setRef = useRef<HTMLDivElement>(null)
  const [copies, setCopies] = useState(1)

  useEffect(() => {
    if (!containerRef.current || !setRef.current) return
    const containerWidth = containerRef.current.offsetWidth
    const unitWidth = setRef.current.offsetWidth / copies
    if (unitWidth === 0) return
    // Assez de copies pour qu'un set dépasse toujours la largeur écran → pas de trou.
    const needed = Math.max(1, Math.ceil(containerWidth / unitWidth))
    if (needed !== copies) setCopies(needed)
  }, [sponsors, copies])

  if (sponsors.length === 0) return null

  const set = Array.from({ length: copies }, () => sponsors).flat()

  const renderSet = (prefix: string, ref?: React.Ref<HTMLDivElement>) => (
    <div ref={ref} className="flex h-full items-center">
      {set.map((sponsor, i) => (
        <div key={`${prefix}-${sponsor.id}-${i}`} className="flex h-full items-center px-14">
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name}
            className="max-h-8 w-auto opacity-80 brightness-0 invert"
            draggable={false}
          />
        </div>
      ))}
    </div>
  )

  return (
    <div ref={containerRef} className="blurry absolute inset-x-0 bottom-0 z-20 h-16">
      <div
        className="sponsor-track h-full items-center"
        style={{ '--marquee-duration': `${scrollSpeed}s` } as React.CSSProperties}
      >
        {renderSet('a', setRef)}
        {renderSet('b')}
      </div>
    </div>
  )
}
