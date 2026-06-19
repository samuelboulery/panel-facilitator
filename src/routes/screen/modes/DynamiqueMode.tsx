// Mode DYNAMIQUE (PRD 5.4) — cœur de la table ronde.
// Layout flexbox en colonne : haut = overlay (scène d'affiche) + QR ;
// centre = contenu principal (embed whitelisté / image / vidéo) ou vide ;
// bas = carte titre / tiers inférieur. Aucun positionnement absolu.
import type { EventData } from '../../../realtime/eventData'
import type { Content, EventPublic, ScreenState } from '../../../shared/types'
import { toEmbedUrl } from '../../../shared/embed'
import { QrBadge } from '../components/QrBadge'
import { OverlayHost } from '../overlays/OverlayHost'

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
    <div className="stage-card flex w-[820px] max-w-[58%] flex-col gap-5">
      {(lead || date) && (
        <div className="flex items-center gap-5 text-3xl text-paper">
          {lead && <span>{lead}</span>}
          {lead && date && <span className="text-accent">•</span>}
          {date && <span>{date}</span>}
        </div>
      )}
      <p className="display-title text-7xl text-paper">{event.title}</p>
    </div>
  )
}

function MainContent({ content }: { content: Content }) {
  const url = toEmbedUrl(content.kind, content.url)
  if (!url) return null

  switch (content.kind) {
    case 'embed_gslides':
    case 'embed_figma':
      return (
        <iframe
          src={url}
          title={content.label}
          className="h-full w-full border-0"
          allow="autoplay; fullscreen"
          // allow-scripts requis : Slides/Figma sont des apps JS. Cross-origin,
          // allow-same-origin ne donne accès qu'à LEUR origine. Domaines
          // whitelistés en amont par toEmbedUrl (src/shared/embed.ts).
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
    <div className="relative z-2 flex h-full flex-col gap-8 p-16">
      {/* Haut : overlay (scène d'affiche) à gauche, QR à droite */}
      <div className="flex shrink-0 items-start justify-between gap-8">
        <div className="min-w-0 flex-1">
          {resting && <OverlayHost overlay={state.overlay} position="top" />}
        </div>
        <QrBadge url={data.event.qrUrl} visible={state.qrVisible} />
      </div>

      {/* Centre + bas : contenu plein cadre puis tiers inférieur, ou titre en bas */}
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-8">
        {!resting && (
          <div className="min-h-0 flex-1">
            <MainContent content={content} />
          </div>
        )}
        {!resting && <OverlayHost overlay={state.overlay} position="bottom" />}
        {resting && <RestingScene event={data.event} />}
      </div>
    </div>
  )
}
