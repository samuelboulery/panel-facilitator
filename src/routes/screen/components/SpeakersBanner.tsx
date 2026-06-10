// Bandeau speakers permanent du mode DYNAMIQUE (PRD 5.4.2).
// Haut d'écran (le bas est pris par les sponsors). Masquable par la régie.
// > 4 speakers : fiches compactées (le PRD permet réduction).
import { AnimatePresence, motion } from 'framer-motion'
import type { Speaker } from '../../../shared/types'
import { SpeakerAvatar } from './SpeakerAvatar'

interface SpeakersBannerProps {
  speakers: Speaker[]
  visible: boolean
}

export function SpeakersBanner({ speakers, visible }: SpeakersBannerProps) {
  const active = speakers.filter((s) => !s.hidden && !s.isHost)
  if (active.length === 0) return null
  const compact = active.length > 4

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -88, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -88, opacity: 0 }}
          transition={{ type: 'tween', duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-0 top-0 z-20 flex h-20 items-center gap-2 border-b border-white/10 bg-ink-soft/90 px-8 backdrop-blur-sm"
        >
          {active.map((speaker) => (
            <div key={speaker.id} className="flex min-w-0 flex-1 items-center gap-3">
              <SpeakerAvatar
                speaker={speaker}
                className={`shrink-0 rounded-full ${compact ? 'h-10 w-10' : 'h-12 w-12'}`}
              />
              <div className="min-w-0">
                <p className={`truncate font-semibold ${compact ? 'text-sm' : 'text-base'}`}>
                  {speaker.firstName} {speaker.lastName}
                </p>
                <p className="truncate font-mono text-xs text-paper-dim">
                  {[speaker.title, speaker.company].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
