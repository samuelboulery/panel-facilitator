// Écran de saisie du PIN de session — porte d'entrée de l'IR (PRD Q9).
// Tablette-first : gros pavé numérique, feedback d'erreur clair.
import { useEffect, useState } from 'react'
import { pinSchema } from '../../shared/schemas'

interface PinGateProps {
  onSubmit: (pin: string) => Promise<boolean>
}

export function PinGate({ onSubmit }: PinGateProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)

  const submit = async () => {
    const parsed = pinSchema.safeParse(pin)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setChecking(true)
    setError(null)
    try {
      const ok = await onSubmit(pin)
      if (!ok) {
        setError('PIN incorrect')
        setPin('')
        const next = attempts + 1
        setAttempts(next)
        // Frein anti brute-force : 5 échecs → verrou 30 s.
        if (next >= 5) {
          setLocked(true)
          setError('Trop de tentatives — réessayer dans 30 s')
          setTimeout(() => {
            setLocked(false)
            setAttempts(0)
            setError(null)
          }, 30_000)
        }
      }
    } catch {
      setError('Erreur de connexion — réessayer')
    } finally {
      setChecking(false)
    }
  }

  const press = (digit: string) => {
    setError(null)
    setPin((p) => (p.length < 8 ? p + digit : p))
  }

  // Saisie clavier (clavier physique tablette/poste) en plus du pavé tactile.
  useEffect(() => {
    if (checking || locked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key)
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
      else if (e.key === 'Enter') void submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-8 bg-slate-100">
      <h1 className="font-mono text-sm uppercase tracking-widest text-slate-500">
        Code de session
      </h1>

      <div className="flex h-10 items-center gap-3" aria-label="PIN saisi">
        {pin.length === 0 ? (
          <span className="text-slate-300">····</span>
        ) : (
          Array.from(pin).map((_, i) => (
            <span key={i} className="h-3 w-3 rounded-full bg-slate-800" />
          ))
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((key) => (
          <button
            key={key}
            type="button"
            disabled={checking || locked}
            onClick={() => {
              if (key === '⌫') setPin((p) => p.slice(0, -1))
              else if (key === 'OK') void submit()
              else press(key)
            }}
            className={`h-16 w-16 rounded-2xl text-xl font-semibold shadow-sm transition active:scale-95 ${
              key === 'OK'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-800'
            } disabled:opacity-50`}
          >
            {key}
          </button>
        ))}
      </div>

      <p className="h-5 text-sm text-red-600">{error ?? ''}</p>
    </div>
  )
}
