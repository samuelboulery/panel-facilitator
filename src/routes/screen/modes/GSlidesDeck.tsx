// Architecture : rendu EP d'un deck Google Slides navigable (PRD 5.4.1).
// Le lecteur /embed est cross-origin : impossible de le piloter en JS. Le seul
// levier est de recharger l'iframe sur une slide donnée (src/shared/embed.ts).
// Pour éviter le flash de rechargement devant l'audience, on tient DEUX calques
// iframe : l'actif (visible) et le suivant (préchargé, caché). Au changement de
// `step`, on charge la nouvelle slide dans le calque caché et, à son `onLoad`,
// on bascule l'opacité — l'ancien calque devient le préchargeur.
import { useEffect, useRef, useState } from 'react'
import { toEmbedUrl } from '../../../shared/embed'

interface Layer {
  /** Identité stable de l'iframe pour ne pas la recréer (sinon re-fetch). */
  key: number
  src: string
  step: number
  /** true une fois l'iframe chargée — déclenche le fondu (piloté par l'état,
   *  pas le DOM : un re-render concurrent ne réinitialise pas le fondu). */
  ready: boolean
}

const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-presentation'

interface GSlidesDeckProps {
  url: string
  step: number
  label: string
}

export function GSlidesDeck({ url, step, label }: GSlidesDeckProps) {
  const initial = toEmbedUrl('embed_gslides', url, step)
  // Compteur de clés monotone : chaque calque chargé garde son iframe.
  const nextKey = useRef(1)
  const [front, setFront] = useState<Layer | null>(
    initial ? { key: 0, src: initial, step, ready: true } : null,
  )
  const [back, setBack] = useState<Layer | null>(null)
  // Reflète `back` pour le promote différé sans recréer le callback onLoad.
  const backRef = useRef<Layer | null>(null)
  backRef.current = back

  useEffect(() => {
    // Slide déjà affichée ou en cours de préchargement : rien à faire.
    if (!front || step === front.step || step === back?.step) return
    const src = toEmbedUrl('embed_gslides', url, step)
    if (!src) return
    setBack({ key: nextKey.current++, src, step, ready: false })
  }, [step, url, front, back?.step])

  if (!front) return null

  return (
    <div className="relative h-full w-full">
      <iframe
        key={front.key}
        src={front.src}
        title={label}
        className="absolute inset-0 h-full w-full border-0"
        allow="autoplay; fullscreen"
        sandbox={IFRAME_SANDBOX}
      />
      {back && (
        <iframe
          key={back.key}
          src={back.src}
          title={label}
          className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-300 ${
            back.ready ? 'opacity-100' : 'opacity-0'
          }`}
          allow="autoplay; fullscreen"
          sandbox={IFRAME_SANDBOX}
          onLoad={() => {
            // Slide suivante prête : fondu par-dessus l'ancienne (toujours visible
            // dessous), puis promotion en actif une fois le fondu terminé — la même
            // clé préserve l'iframe, donc aucun rechargement à la bascule.
            const promotedKey = back.key
            setBack((b) => (b && !b.ready ? { ...b, ready: true } : b))
            setTimeout(() => {
              const current = backRef.current
              // Step ré-avancé entre-temps : ce calque n'est plus le bon, on laisse
              // le nouveau back gérer sa propre promotion.
              if (current?.key !== promotedKey) return
              setFront(current)
              setBack(null)
            }, 300)
          }}
        />
      )}
    </div>
  )
}
