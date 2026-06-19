// Section Branding — palette (fond, texte, accent) + image de fond, gérées
// comme des profils nommés enregistrés en base. L'organisateur marque le
// profil actif (★) que l'EP applique (couleur de fond + image + couleur de texte).
import { useEffect, useState } from 'react'
import {
  createBrandingProfile,
  deleteBrandingProfile,
  listBrandingProfiles,
  updateAdminEvent,
  updateBrandingProfile,
  type AdminEvent,
  type BrandingProfile,
} from '../../../realtime/adminData'
import { ColorField, ImageField, SaveButton, TextField } from '../components/fields'

const DEFAULTS = {
  name: '',
  bg_color: '#000000',
  text_color: '#ffffff',
  accent_color: '#2563eb',
  bg_image_url: null as string | null,
}

export function BrandingSection({
  event,
  onSaved,
}: {
  event: AdminEvent
  onSaved: () => void
}) {
  const eventId = event.id
  const activeId = event.branding_profile_id
  const [profiles, setProfiles] = useState<BrandingProfile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULTS)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const reload = () => void listBrandingProfiles(eventId).then(setProfiles)
  useEffect(reload, [eventId])

  const set = (key: keyof typeof form) => (value: string | null) =>
    setForm((f) => ({ ...f, [key]: value }))

  // Charge un profil existant dans l'éditeur (ou repart d'un profil vierge).
  const select = (id: string | null) => {
    setSelectedId(id)
    setError(null)
    if (!id) {
      setForm(DEFAULTS)
      return
    }
    const p = profiles.find((x) => x.id === id)
    if (p) setForm({ ...p })
  }

  const save = async () => {
    if (!form.name.trim()) {
      setError('Nom du profil requis')
      return
    }
    setSaveState('saving')
    setError(null)
    try {
      const values = {
        name: form.name.trim(),
        bg_color: form.bg_color,
        text_color: form.text_color,
        accent_color: form.accent_color,
        bg_image_url: form.bg_image_url,
      }
      if (selectedId) {
        await updateBrandingProfile(selectedId, values)
      } else {
        await createBrandingProfile({ event_id: eventId, ...values })
      }
      reload()
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (err) {
      setSaveState('error')
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const remove = async (id: string) => {
    await deleteBrandingProfile(id)
    if (selectedId === id) select(null)
    reload()
    // FK on delete set null : si c'était le profil actif, l'EP repasse au défaut.
    if (activeId === id) onSaved()
  }

  // Profil appliqué sur l'EP (couleurs + image). Un seul actif par événement.
  const setActive = async (id: string) => {
    await updateAdminEvent(eventId, { branding_profile_id: id })
    onSaved()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl bg-control-panel p-4">
        <p className="mb-2 font-mono text-xs tracking-wide text-control-dim">
          Profils enregistrés — ★ = appliqué sur l'écran
        </p>
        {profiles.length === 0 && (
          <p className="text-sm text-control-dim">Aucun profil — créez-en un ci-dessous.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {profiles.map((p) => {
            const isActive = activeId === p.id
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-full py-1.5 pr-2 pl-3 text-sm transition-colors ${
                  selectedId === p.id ? 'bg-control-ink text-white' : 'bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void setActive(p.id)}
                  aria-label={isActive ? `${p.name} (actif)` : `Appliquer ${p.name}`}
                  aria-pressed={isActive}
                  className={isActive ? 'text-amber-400' : 'text-control-dim hover:text-amber-400'}
                >
                  {isActive ? '★' : '☆'}
                </button>
                <button type="button" onClick={() => select(p.id)} className="active:scale-95">
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(p.id)}
                  aria-label={`Supprimer ${p.name}`}
                  className="rounded-full px-1.5 text-control-dim hover:text-red-600"
                >
                  ×
                </button>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => select(null)}
            className="rounded-full bg-white px-4 py-1.5 font-mono text-sm text-control-accent active:scale-95"
          >
            + Nouveau profil
          </button>
        </div>
      </div>

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

      <div className="flex items-center gap-4">
        <SaveButton onClick={() => void save()} state={saveState} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
