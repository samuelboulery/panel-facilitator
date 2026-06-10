// QR code permanent des questions audience (PRD 5.4.3) — coin inférieur droit,
// masquable par la régie. URL invalide ou absente : rien (aucun espace vide).
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
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ type: 'tween', duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-6 bottom-22 z-20 flex flex-col items-center gap-2 rounded-2xl bg-paper p-3 shadow-2xl"
        >
          <QRCodeSVG value={url} size={104} bgColor="#e8e9f2" fgColor="#0e0f14" />
          <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-ink uppercase">
            Vos questions
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
