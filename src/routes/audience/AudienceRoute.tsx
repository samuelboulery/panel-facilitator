// Architecture : surface audience (mobile) — cible du QR code projeté.
// Formulaire de questions + interface de vote. Anti double-vote par
// fingerprint anonyme persisté en localStorage (PLAN.md D5).
// Squelette Sprint 0 — formulaire et vote complets au Sprint 3.
const FINGERPRINT_KEY = 'panel-facilitator:fingerprint'

export function getFingerprint(): string {
  let fp = localStorage.getItem(FINGERPRINT_KEY)
  if (!fp) {
    fp = crypto.randomUUID()
    localStorage.setItem(FINGERPRINT_KEY, fp)
  }
  return fp
}

export default function AudienceRoute() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <p className="font-mono text-slate-400">Questions du public — Sprint 3</p>
    </div>
  )
}
