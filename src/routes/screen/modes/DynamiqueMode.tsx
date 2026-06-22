// Mode DYNAMIQUE (PRD 5.4) — cœur de la table ronde.
// Panneaux positionnés en absolu sur la scène 1920×1080 : QR ancré en haut à
// droite, contenu principal plein cadre. Titre + overlay forment UN seul groupe
// repositionnable (une ancre commune). Le sens d'empilement suit l'ancre : ancré
// bas → overlay sous le titre (titre poussé vers le haut) ; ancré haut/centre →
// overlay au-dessus (le titre descend). Contenu projeté : le titre est masqué (le
// QR reste), le groupe ne porte plus que l'overlay — même ancre, même comportement.
import { motion } from 'framer-motion'
import type { EventData } from '../../../realtime/eventData'
import type { CardPosition, Content, EventPublic, Overlay, ScreenState } from '../../../shared/types'
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

// Carte titre en verre dépoli (maquette 250:1090). La largeur et l'ancrage sont
// portés par le groupe parent (RestingGroup) — ici, juste le contenu.
// `layout` : anime le glissement du titre quand l'overlay apparaît/disparaît
// (sinon il se téléporte à sa nouvelle place dans la colonne flex).
function TitleCard({ event }: { event: EventPublic }) {
  const date = formatEventDate(event.eventDate)
  const lead = event.subtitle ?? event.edition
  return (
    <motion.div
      layout
      transition={{ type: 'tween', duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="stage-card flex flex-col gap-5"
    >
      {(lead || date) && (
        <div className="flex items-center gap-5 text-3xl text-paper">
          {lead && <span>{lead}</span>}
          {lead && date && <span className="text-accent">•</span>}
          {date && <span>{date}</span>}
        </div>
      )}
      <p className="display-title text-7xl text-paper">{event.title}</p>
    </motion.div>
  )
}

// Groupe dynamique = titre + overlay sous une seule ancre (slideKey commun). L'ordre
// d'empilement suit le bord d'ancre vertical : ancré bas → titre puis overlay (le
// titre est poussé vers le haut) ; sinon overlay puis titre (le titre descend).
// Par défaut (aucune position enregistrée) : ancré en haut à gauche, à côté du QR.
// `showTitle` false (contenu projeté) : le groupe ne porte que l'overlay.
function DynamicGroup({
  event,
  overlay,
  pos,
  showTitle,
}: {
  event: EventPublic
  overlay: Overlay | null
  pos: CardPosition | undefined
  showTitle: boolean
}) {
  const anchorBottom = pos?.anchorY === 'bottom'
  const title = showTitle ? <TitleCard event={event} /> : null
  const ovl = <OverlayHost overlay={overlay} enterFrom={anchorBottom ? 'bottom' : 'top'} />
  return (
    <MovableCard
      slideKey="dynamique-resting"
      className="absolute left-16 top-16 flex w-[51.25rem] max-w-[58%] flex-col gap-10"
    >
      {anchorBottom ? (
        <>
          {title}
          {ovl}
        </>
      ) : (
        <>
          {ovl}
          {title}
        </>
      )}
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
          className="h-full w-full rounded-[1.25rem] border-0"
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
  const hasContent = Boolean(content && url)

  return (
    <div className="relative z-2 h-full">
      {/* Contenu principal plein cadre — ancré en absolu, sous les panneaux */}
      {hasContent && content && (
        <div className="absolute inset-16">
          <MainContent content={content} step={state.contentStep} />
        </div>
      )}

      {/* QR : ancré en haut à droite, repositionnable */}
      <MovableCard slideKey="dynamique-qr" className="absolute right-16 top-16">
        <QrBadge url={data.event.qrUrl} visible={state.qrVisible} />
      </MovableCard>

      {/* Groupe titre + overlay sous une ancre commune. Contenu projeté : titre
          masqué — on ne rend le groupe que s'il porte un overlay (même ancre). */}
      {(!hasContent || state.overlay !== null) && (
        <DynamicGroup
          event={data.event}
          overlay={state.overlay}
          pos={state.cardPositions['dynamique-resting']}
          showTitle={!hasContent}
        />
      )}
    </div>
  )
}
