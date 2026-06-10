// Architecture : SEUL point d'entrée vers supabase-js (frontière PLAN.md §2).
// Les routes n'importent jamais ce module directement — elles passent par
// les fonctions métier de src/realtime (screenState, mutations, presence).
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error(
    'Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes — copier .env.example vers .env.local',
  )
}

export const supabase = createClient(url, anonKey, {
  realtime: {
    // Reconnexion : backoff borné pour garantir un retour < 30 s (PRD 7.1).
    reconnectAfterMs: (tries: number) => Math.min(1000 * 2 ** tries, 10_000),
  },
})
