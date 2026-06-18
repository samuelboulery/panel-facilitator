// Mode DYNAMIQUE (PRD 5.4) — cœur de la table ronde.
// Contenu principal (embed whitelisté / image / vidéo) sous les overlays.
// Sans contenu sélectionné : scène calme (titre en filigrane) — jamais d'écran
// d'erreur ni de placeholder générique devant l'audience.
import type { EventData } from '../../../realtime/eventData'
import type { ScreenState } from '../../../shared/types'
import { toEmbedUrl } from '../../../shared/embed'
import { GSlidesDeck } from './GSlidesDeck'
import { SpeakersBanner } from '../components/SpeakersBanner'
import { QrBadge } from '../components/QrBadge'
import { OverlayHost } from '../overlays/OverlayHost'

function MainContent({ data, state }: { data: EventData; state: ScreenState }) {
  const content = state.mainContentId
    ? data.contents.find((c) => c.id === state.mainContentId)
    : null

  if (!content) {
    // Scène au repos : titre discret, l'atmosphère fait le travail.
    return (
      <div className="flex h-full items-center justify-center">
        <p className="display-title max-w-[1100px] text-center text-6xl text-white/12">
          {data.event.title}
        </p>
      </div>
    )
  }

  const url = toEmbedUrl(content.kind, content.url)
  if (!url) {
    // URL invalide : fallback silencieux (l'alerte vit dans l'IR, pas ici).
    return (
      <div className="flex h-full items-center justify-center">
        <p className="display-title text-6xl text-white/12">{data.event.title}</p>
      </div>
    )
  }

  switch (content.kind) {
    case 'embed_gslides':
      // Deck navigable : la slide interne suit state.contentStep (cross-fade).
      // key=content.id : changer de deck remonte le composant (sinon l'ancien
      // iframe resterait, step 0 == front.step 0 ne déclenchant aucun reload).
      return (
        <GSlidesDeck
          key={content.id}
          url={content.url}
          step={state.contentStep}
          label={content.label}
        />
      )
    case 'embed_figma':
    case 'embed_site':
      return (
        <iframe
          src={url}
          title={content.label}
          className="h-full w-full border-0"
          allow="autoplay; fullscreen"
          // allow-scripts requis : Figma/site sont des apps JS. Cross-origin,
          // allow-same-origin ne donne accès qu'à LEUR origine. Figma whitelisté
          // par toEmbedUrl ; site = URL https de confiance (saisie admin).
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      )
    case 'image':
      return <img src={url} alt={content.label} className="h-full w-full object-contain" />
    case 'video':
      return (
        <video src={url} className="h-full w-full object-contain" autoPlay muted loop playsInline />
      )
  }
}

interface DynamiqueModeProps {
  data: EventData
  state: ScreenState
}

export function DynamiqueMode({ data, state }: DynamiqueModeProps) {
  const bannerVisible = state.speakersBannerVisible
  return (
    <div className="relative z-2 h-full">
      {/* Zone contenu : sous le bandeau speakers (80px) et au-dessus des sponsors (64px) */}
      <div
        className="absolute inset-x-0 bottom-16 transition-[top] duration-300"
        style={{ top: bannerVisible ? 80 : 0 }}
      >
        <MainContent data={data} state={state} />
      </div>

      <SpeakersBanner speakers={data.speakers} visible={bannerVisible} />
      <QrBadge url={data.event.qrUrl} visible={state.qrVisible} />
      <OverlayHost overlay={state.overlay} />
    </div>
  )
}
