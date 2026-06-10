// Compte à rebours vers start_at (PRD 5.2.1) — calcul client depuis l'heure
// cible (PLAN.md D8). Arrivé à zéro : reste à zéro, jamais négatif.
import { useEffect, useState } from 'react'

export interface Countdown {
  hours: number
  minutes: number
  seconds: number
  done: boolean
}

function compute(target: number): Countdown {
  const remaining = Math.max(0, target - Date.now())
  return {
    hours: Math.floor(remaining / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
    seconds: Math.floor((remaining % 60_000) / 1000),
    done: remaining === 0,
  }
}

export function useCountdown(startAt: string | null): Countdown | null {
  const target = startAt ? new Date(startAt).getTime() : null
  const [countdown, setCountdown] = useState<Countdown | null>(
    target !== null && !Number.isNaN(target) ? compute(target) : null,
  )

  useEffect(() => {
    if (target === null || Number.isNaN(target)) {
      setCountdown(null)
      return
    }
    setCountdown(compute(target))
    const id = setInterval(() => {
      const next = compute(target)
      setCountdown(next)
      if (next.done) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [target])

  return countdown
}
