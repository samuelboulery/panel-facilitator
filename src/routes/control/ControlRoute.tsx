// Architecture : Interface de Régie / Animateur (IR) — tablette-first.
// Protégée par PIN de session (PRD Q9). Session conservée en sessionStorage
// pour survivre à un refresh pendant le live (V1 mono-opérateur).
// Squelette Sprint 0 — les 3 vues slideables arrivent au Sprint 2.
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { z } from 'zod'
import { controlAuth, type ControlSession } from '../../realtime/mutations'
import { PinGate } from './PinGate'

const SESSION_KEY = 'panel-facilitator:control-session'

// Validation à la frontière sessionStorage — donnée non fiable (règle projet).
const storedSessionSchema = z.object({
  slug: z.string().min(1),
  pin: z.string().regex(/^\d{4,8}$/),
  eventId: z.string().uuid(),
})

export default function ControlRoute() {
  const { slug } = useParams<{ slug: string }>()
  const [session, setSession] = useState<ControlSession | null>(null)
  const [restoring, setRestoring] = useState(true)

  // Restauration de session après refresh (le PIN reste vérifié côté serveur
  // à chaque mutation — un PIN périmé échouera proprement).
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw && slug) {
      try {
        const saved = storedSessionSchema.parse(JSON.parse(raw))
        if (saved.slug === slug) {
          setSession(saved)
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY)
      }
    }
    setRestoring(false)
  }, [slug])

  const handlePin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!slug) return false
      const result = await controlAuth(slug, pin)
      if (!result) return false
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(result))
      setSession(result)
      return true
    },
    [slug],
  )

  if (restoring) return null
  if (!session) return <PinGate onSubmit={handlePin} />

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100">
      {/* Sprint 2 : vues slideables Slides | Gestion | Notes + barre d'état */}
      <p className="font-mono text-slate-500">IR connectée — {session.slug}</p>
    </div>
  )
}
