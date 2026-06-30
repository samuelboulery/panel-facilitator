// Section Événement — paramètres généraux, slide asso, PIN, URLs des surfaces.
// Enregistrement automatique : tout changement est sauvegardé après un court délai (debounce).
import { useEffect, useRef, useState } from 'react'
import {
  setEventPin,
  updateAdminEvent,
  type AdminEvent,
} from '../../../realtime/adminData'
import { TextArea, TextField } from '../components/fields'
import { BrandingSelector } from '../components/BrandingSelector'
import { notifySaved } from '../components/SavedSnackbar'
import { SpeakersSection, SponsorsSection } from './entitySections'

/** ISO UTC → heure locale HH:MM (le jour vient du champ Date). */
function isoToTimeInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(11, 16)
}

export function EventSection({
  event,
  onSaved,
}: {
  event: AdminEvent
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: event.title,
    subtitle: event.subtitle ?? '',
    edition: event.edition ?? '',
    event_date: event.event_date ?? '',
    // input time = heure LOCALE HH:MM ; combinée au jour (event_date) pour reconstruire start_at UTC.
    start_at: event.start_at ? isoToTimeInput(event.start_at) : '',
    closing_message: event.closing_message ?? '',
    sponsor_scroll_speed: String(event.sponsor_scroll_speed),
    asso_name: event.asso_content?.name ?? '',
    asso_description: event.asso_content?.description ?? '',
  })
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof typeof form) => (value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    // PIN poussé uniquement s'il est complet (4 à 8 chiffres) — pas de PIN à moitié saisi.
    const pinValid = /^\d{4,8}$/.test(pin)
    if (pin && !pinValid) {
      setError('PIN : 4 à 8 chiffres.')
      return
    }
    setError(null)
    try {
      await updateAdminEvent(event.id, {
        title: form.title,
        subtitle: form.subtitle || null,
        edition: form.edition || null,
        event_date: form.event_date || null,
        // start_at = jour (event_date) + heure locale ; sans jour, pas de cible de timer.
        start_at:
          form.start_at && form.event_date
            ? new Date(`${form.event_date}T${form.start_at}`).toISOString()
            : null,
        closing_message: form.closing_message || null,
        // QR pointe toujours vers le formulaire questions audience.
        qr_url: `${window.location.origin}/q/${event.slug}`,
        sponsor_scroll_speed: Number(form.sponsor_scroll_speed) || 30,
        asso_slide_enabled: !!form.asso_name.trim(),
        asso_content: form.asso_name
          ? { name: form.asso_name, description: form.asso_description || undefined }
          : null,
      })
      if (pinValid) {
        await setEventPin(event.id, pin)
        setPin('')
      }
      onSaved()
      notifySaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  // Enregistrement auto : debounce 600 ms après le dernier changement, sauf au montage.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const t = setTimeout(() => void save(), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, pin])

  const base = window.location.origin
  const urls = [
    { label: 'Écran public', url: `${base}/screen/${event.slug}?k=${event.screen_token}` },
    { label: 'Régie / animateur', url: `${base}/control/${event.slug}` },
    { label: 'Questions audience (QR code)', url: `${base}/q/${event.slug}` },
  ]

  return (
    <div className="flex flex-col gap-4 min-[1200px]:flex-row">
      <div className="flex flex-2 flex-col gap-6 rounded-2xl bg-control-panel p-5 min-w-0">
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Titre" value={form.title} onChange={set('title')} />
          <TextField label="Sous-titre" value={form.subtitle} onChange={set('subtitle')} />
          <div className="col-span-2">
            <TextField label="Édition" value={form.edition} onChange={set('edition')} />
          </div>
          <TextField label="Date" type="date" value={form.event_date} onChange={set('event_date')} />
          <TextField
            label="Heure de début (timer attente)"
            type="time"
            value={form.start_at}
            onChange={set('start_at')}
          />
        </div>

        <BrandingSelector event={event} onChanged={onSaved} />

        <TextArea
          label="Message de clôture (outro)"
          value={form.closing_message}
          onChange={set('closing_message')}
        />
        <div className="rounded-xl bg-control-panel p-4">
          <p className="mb-3 font-mono text-xs tracking-wide text-control-dim">
            Association — slide affichée en début d'intro si un nom est renseigné
          </p>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Nom de l'asso" value={form.asso_name} onChange={set('asso_name')} />
            <TextField
              label="Description courte"
              value={form.asso_description}
              onChange={set('asso_description')}
              disabled={!form.asso_name.trim()}
            />
          </div>
        </div>

        <div className="rounded-xl bg-control-panel p-4">
          <TextField
            label="Nouveau PIN de session IR (vide = inchangé)"
            value={pin}
            onChange={setPin}
            placeholder="4 à 8 chiffres"
          />
        </div>

        <div className="rounded-xl bg-control-panel p-4">
          <p className="mb-2 font-mono text-xs tracking-wide text-control-dim">URLs des surfaces</p>
          {urls.map(({ label, url }) => (
            <div key={label} className="flex items-center justify-between gap-3 py-1">
              <span className="shrink-0 text-sm text-control-dim">{label}</span>
              <code className="truncate font-mono text-xs">{url}</code>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(url)}
                className="shrink-0 rounded bg-white px-2 py-1 font-mono text-xs active:scale-95"
              >
                Copier
              </button>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex flex-3 flex-col gap-6 rounded-2xl bg-control-panel p-5 min-w-0">
        <div>
          <h2 className="mb-3 font-mono text-xs tracking-[0.25em] text-control-dim uppercase">Speakers</h2>
          <SpeakersSection eventId={event.id} />
        </div>

        <div className="border-t border-control-bg pt-6">
          <h2 className="mb-3 font-mono text-xs tracking-[0.25em] text-control-dim uppercase">Sponsors</h2>
          <div className="mb-4 max-w-[240px]">
            <TextField
              label="Vitesse bandeau (s/cycle)"
              type="number"
              value={form.sponsor_scroll_speed}
              onChange={set('sponsor_scroll_speed')}
            />
          </div>
          <SponsorsSection eventId={event.id} />
        </div>
      </div>
    </div>
  )
}
