// QR code permanent des questions audience (PRD 5.4.3) — carte verre dépoli
// en haut à droite (maquette Figma 250:1098), masquable par la régie.
// URL invalide ou absente : rien (aucun espace vide).
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { isValidHttpUrl } from '../../../shared/embed'

interface QrBadgeProps {
  url: string | null
  visible: boolean
}

export function QrBadge({ url, visible }: QrBadgeProps) {
  if (!url || !isValidHttpUrl(url)) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -16 }}
          transition={{ type: 'tween', duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="stage-card z-20 flex w-[18.75rem] flex-col items-center gap-6"
        >
          <p className="text-center text-3xl text-paper">Posez-nous vos questions</p>
          <div className="rounded-2xl bg-paper p-4">
            {/* size = résolution de rendu (px) ; la largeur affichée suit la font
                racine via la classe rem (h-auto garde le carré via le viewBox). */}
            <QRCodeSVG
              value={url}
              size={216}
              bgColor="#e8e9f2"
              fgColor="#0e0f14"
              className="h-auto w-[13.5rem]"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
