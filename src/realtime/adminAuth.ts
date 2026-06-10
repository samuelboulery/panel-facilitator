// Architecture : authentification du backoffice (Supabase Auth, un compte
// organisateur — PLAN.md D7). Login uniquement : la création de compte se
// fait hors application (Studio / API admin).
import { supabase } from './client'

export async function signIn(email: string, password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return !error
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/** Émet true/false selon la présence d'une session, immédiatement puis à chaque changement. */
export function watchAuth(onChange: (authenticated: boolean) => void): () => void {
  let active = true
  void supabase.auth.getSession().then(({ data }) => {
    if (active) onChange(data.session !== null)
  })
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (active) onChange(session !== null)
  })
  return () => {
    active = false
    data.subscription.unsubscribe()
  }
}
