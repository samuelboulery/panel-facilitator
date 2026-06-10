// Avatar speaker avec fallback générique (PRD : avatar si photo manquante).
// Le fallback est typographique — initiales sur fond indigo — cohérent avec
// la direction « affiche » plutôt qu'une silhouette générique.
import { useState } from 'react'
import type { Speaker } from '../../../shared/types'

interface SpeakerAvatarProps {
  speaker: Speaker
  className?: string
}

export function SpeakerAvatar({ speaker, className = '' }: SpeakerAvatarProps) {
  const [failed, setFailed] = useState(false)
  const initials =
    `${speaker.firstName[0] ?? ''}${speaker.lastName[0] ?? ''}`.toUpperCase() || '?'

  if (!speaker.photoUrl || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-accent-soft text-paper ${className}`}
        aria-hidden
      >
        <span className="display-title text-[0.9em]">{initials}</span>
      </div>
    )
  }

  return (
    <img
      src={speaker.photoUrl}
      alt={`${speaker.firstName} ${speaker.lastName}`}
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
      draggable={false}
    />
  )
}
