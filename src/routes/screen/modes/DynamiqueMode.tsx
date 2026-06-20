// Mode DYNAMIQUE (PRD 5.4) — cœur de la table ronde.
// Panneaux positionnés en absolu sur la scène 1920×1080 : QR ancré en haut à
// droite, contenu principal plein cadre, et un seul groupe en flux — le titre
// + les éléments dynamiques (overlays) qui apparaissent — ancré en bas.
import type { EventData } from '../../../realtime/eventData'
import type { Content, EventPublic, ScreenState } from '../../../shared/types'
import { toEmbedUrl } from '../../../shared/embed'
import { GSlidesDeck } from './GSlidesDeck'
import { QrBadge } from '../components/QrBadge'
import { OverlayHost } from '../overlays/OverlayHost'
import { MovableCard } from '../components/MovableCard'

function formatEventDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

// Scène au repos : carte titre en verre dépoli (maquette 250:1090),
// placée en bas de la colonne par le layout flex.
function RestingScene({ event }: { event: EventPublic }) {
  const date = formatEventDate(event.eventDate)
  const lead = event.subtitle ?? event.edition
  return (
    <MovableCard slideKey="dynamique-resting" className="stage-card flex w-[820px] max-w-[58%] flex-col gap-5">
      {(lead || date) && (
        <div className="flex items-center gap-5 text-3xl text-paper">
          {lead && <span>{lead}</span>}
          {lead && date && <span className="text-accent">•</span>}
          {date && <span>{date}</span>}
        </div>
      )}
      <p className="display-title text-7xl text-paper">{event.title}</p>
    </MovableCard>
  )
}

function MainContent({ content, step }: { content: Content; step: number }) {
  const url = toEmbedUrl(content.kind, content.url)
  if (!url) return null

  switch (content.kind) {
    case 'embed_gslides':
      // Deck navigable : la slide interne suit contentStep (cross-fade).
      // key=content.id : changer de deck remonte le composant (sinon l'ancien
      // iframe resterait, step 0 == front.step 0 ne déclenchant aucun reload).
      return (
        <GSlidesDeck
          key={content.id}
          url={content.url}
          step={step}
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
  const content = state.mainContentId
    ? (data.contents.find((c) => c.id === state.mainContentId) ?? null)
    : null
  const url = content ? toEmbedUrl(content.kind, content.url) : null
  // Scène d'affiche tant qu'aucun contenu principal valide n'est projeté.
  const resting = !content || !url

  return (
    <div className="relative z-2 h-full">
      {/* Contenu principal plein cadre — ancré en absolu, sous les panneaux */}
      {!resting && (
        <div className="absolute inset-16">
          <MainContent content={content} step={state.contentStep} />
        </div>
      )}

      {/* QR : ancré en haut à droite, repositionnable */}
      <MovableCard slideKey="dynamique-qr" className="absolute right-16 top-16">
        <QrBadge url={data.event.qrUrl} visible={state.qrVisible} />
      </MovableCard>

      {/* Groupe dynamique : titre + éléments dynamiques (overlays) qui
          apparaissent — seul ensemble qui reste en flux. Ancré en bas. */}
      <div className="absolute inset-x-16 bottom-16 flex flex-col gap-8">
        <OverlayHost overlay={state.overlay} position={resting ? 'top' : 'bottom'} />
        {resting && <RestingScene event={data.event} />}
      </div>
    </div>
  )
}
