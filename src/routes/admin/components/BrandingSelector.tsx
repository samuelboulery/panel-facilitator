// Sélecteur de branding (page Événement) : dropdown des profils enregistrés +
// bouton sticky « Créer un branding » ouvrant une modale d'édition. Choisir un
// profil dans la liste le rend actif (events.branding_profile_id) ; l'EP
// applique le profil actif. Remplace l'ancienne section Branding dédiée.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  createBrandingProfile,
  deleteBrandingProfile,
  listBrandingProfiles,
  updateAdminEvent,
  updateBrandingProfile,
  type AdminEvent,
  type BrandingProfile,
} from '../../../realtime/adminData'
import { ColorField, ImageField, TextField } from './fields'
import { notifySaved } from './SavedSnackbar'

const DEFAULTS = {
  name: '',
  bg_color: '#000000',
  text_color: '#ffffff',
  accent_color: '#2563eb',
  bg_image_url: null as string | null,
}

/** Pastille de prévisualisation des couleurs d'un profil. */
function Swatch({ profile }: { profile: { bg_color: string; accent_color: string } }) {
  return (
    <span
      className="inline-block h-5 w-5 shrink-0 rounded-full border border-control-bg"
      style={{ background: `linear-gradient(135deg, ${profile.bg_color} 50%, ${profile.accent_color} 50%)` }}
    />
  )
}

export function BrandingSelector({
  event,
  onChanged,
}: {
  event: AdminEvent
  onChanged: () => void
}) {
  const eventId = event.id
  const activeId = event.branding_profile_id
  const [profiles, setProfiles] = useState<BrandingProfile[]>([])
  const [open, setOpen] = useState(false)
  // null = fermée ; 'new' = création ; profil = édition.
  const [editing, setEditing] = useState<BrandingProfile | 'new' | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const reload = () => void listBrandingProfiles(eventId).then(setProfiles)
  useEffect(reload, [eventId])

  // Ferme le dropdown au clic extérieur.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const active = profiles.find((p) => p.id === activeId) ?? null

  const setActive = async (id: string) => {
    setOpen(false)
    await updateAdminEvent(eventId, { branding_profile_id: id })
    onChanged()
    notifySaved()
  }

  return (
    <div ref={wrapRef} className="relative">
      <span className="mb-1 block font-mono text-xs tracking-wide text-control-dim">Branding</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-control-bg bg-white px-3 py-2 text-left text-sm outline-control-accent"
      >
        <span className="flex min-w-0 items-center gap-2">
          {active ? (
            <>
              <Swatch profile={active} />
              <span className="truncate">{active.name}</span>
            </>
          ) : (
            <span className="text-control-dim">Aucun branding appliqué</span>
          )}
        </span>
        <span className="shrink-0 text-control-dim">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-control-bg bg-white shadow-lg">
          <div className="max-h-64 overflow-y-auto py-1">
            {profiles.length === 0 && (
              <p className="px-3 py-2 text-sm text-control-dim">Aucun profil enregistré.</p>
            )}
            {profiles.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-control-panel ${
                  activeId === p.id ? 'bg-control-panel' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => void setActive(p.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left active:scale-[0.99]"
                >
                  <Swatch profile={p} />
                  <span className="truncate">{p.name}</span>
                  {activeId === p.id && <span className="ml-auto text-amber-400">★</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  aria-label={`Modifier ${p.name}`}
                  className="shrink-0 rounded px-1.5 font-mono text-xs text-control-dim hover:text-control-ink"
                >
                  Modifier
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="sticky bottom-0 block w-full border-t border-control-bg bg-white px-3 py-2.5 text-left font-mono text-sm text-control-accent hover:bg-control-panel"
          >
            + Créer un branding
          </button>
        </div>
      )}

      <BrandingModal
        target={editing}
        eventId={eventId}
        isActive={editing !== null && editing !== 'new' && activeId === editing.id}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          reload()
        }}
        onDeleted={(wasActive) => {
          setEditing(null)
          reload()
          if (wasActive) onChanged()
        }}
      />
    </div>
  )
}

function BrandingModal({
  target,
  eventId,
  isActive,
  onClose,
  onSaved,
  onDeleted,
}: {
  target: BrandingProfile | 'new' | null
  eventId: string
  isActive: boolean
  onClose: () => void
  onSaved: () => void
  onDeleted: (wasActive: boolean) => void
}) {
  const [form, setForm] = useState(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Réinitialise le formulaire à chaque ouverture (création ou profil édité).
  useEffect(() => {
    if (!target) return
    setError(null)
    setForm(target === 'new' ? DEFAULTS : { ...DEFAULTS, ...target })
  }, [target])

  const set = (key: keyof typeof form) => (value: string | null) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    if (!form.name.trim()) {
      setError('Nom du profil requis')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const values = {
        name: form.name.trim(),
        bg_color: form.bg_color,
        text_color: form.text_color,
        accent_color: form.accent_color,
        bg_image_url: form.bg_image_url,
      }
      if (target && target !== 'new') {
        await updateBrandingProfile(target.id, values)
      } else {
        await createBrandingProfile({ event_id: eventId, ...values })
      }
      onSaved()
      notifySaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!target || target === 'new') return
    if (!window.confirm(`Supprimer le branding « ${target.name} » ?`)) return
    setSaving(true)
    try {
      await deleteBrandingProfile(target.id)
      onDeleted(isActive)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-control-ink/40 p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-5 font-mono text-sm tracking-wide text-control-dim">
              {target === 'new' ? 'Créer un branding' : 'Modifier le branding'}
            </p>

            <div className="flex flex-col gap-4">
              <TextField label="Nom du profil" value={form.name} onChange={set('name')} />

              <div className="grid grid-cols-3 gap-4">
                <ColorField label="Couleur de fond" value={form.bg_color} onChange={set('bg_color')} />
                <ColorField label="Couleur de texte" value={form.text_color} onChange={set('text_color')} />
                <ColorField label="Couleur d'accent" value={form.accent_color} onChange={set('accent_color')} />
              </div>

              <div>
                <span className="mb-1 block font-mono text-xs tracking-wide text-control-dim">
                  Image de fond
                </span>
                <ImageField
                  label="Choisir une image"
                  url={form.bg_image_url}
                  folder="branding"
                  maxDim={1920}
                  onUploaded={(url) => set('bg_image_url')(url)}
                />
                {form.bg_image_url && (
                  <button
                    type="button"
                    onClick={() => set('bg_image_url')(null)}
                    className="mt-2 font-mono text-xs text-control-dim hover:text-red-600"
                  >
                    Retirer l'image
                  </button>
                )}
              </div>
            </div>

            <p className="mt-3 h-5 text-sm text-red-600">{error ?? ''}</p>

            <div className="mt-4 flex items-center justify-between">
              {target !== 'new' ? (
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={saving}
                  className="font-mono text-sm text-control-dim hover:text-red-600 active:scale-95 disabled:opacity-50"
                >
                  Supprimer
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 font-mono text-sm text-control-ink active:scale-95"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="rounded-xl bg-control-ink px-6 py-2.5 font-mono text-sm text-white active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
