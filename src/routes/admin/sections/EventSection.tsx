// Section Événement — paramètres généraux, slide asso, PIN, URLs des surfaces.
import { useState } from 'react'
import {
  setEventPin,
  updateAdminEvent,
  type AdminEvent,
} from '../../../realtime/adminData'
import { SaveButton, TextArea, TextField, Toggle } from '../components/fields'

/** ISO UTC → valeur datetime-local (heure locale de l'organisateur). */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
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
    // datetime-local attend l'heure LOCALE ; start_at est stocké en UTC.
    start_at: event.start_at ? isoToLocalInput(event.start_at) : '',
    closing_message: event.closing_message ?? '',
    qr_url: event.qr_url ?? '',
    sponsor_scroll_speed: String(event.sponsor_scroll_speed),
    asso_slide_enabled: event.asso_slide_enabled,
    asso_name: event.asso_content?.name ?? '',
    asso_description: event.asso_content?.description ?? '',
  })
  const [pin, setPin] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof typeof form) => (value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    // Blocage PRD 5.3.1 : asso activée sans contenu = refus explicite.
    if (form.asso_slide_enabled && !form.asso_name.trim()) {
      setError('Slide asso activée mais sans nom — renseigner le contenu ou désactiver.')
      return
    }
    if (pin && !/^\d{4,8}$/.test(pin)) {
      setError('PIN : 4 à 8 chiffres.')
      return
    }
    setSaveState('saving')
    setError(null)
    try {
      await updateAdminEvent(event.id, {
        title: form.title,
        subtitle: form.subtitle || null,
        edition: form.edition || null,
        event_date: form.event_date || null,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        closing_message: form.closing_message || null,
        qr_url: form.qr_url || null,
        sponsor_scroll_speed: Number(form.sponsor_scroll_speed) || 30,
        asso_slide_enabled: form.asso_slide_enabled,
        asso_content: form.asso_name
          ? { name: form.asso_name, description: form.asso_description || undefined }
          : null,
      })
      if (pin) {
        await setEventPin(event.id, pin)
        setPin('')
      }
      setSaveState('saved')
      onSaved()
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (err) {
      setSaveState('error')
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const base = window.location.origin
  const urls = [
    { label: 'Écran public', url: `${base}/screen/${event.slug}?k=${event.screen_token}` },
    { label: 'Régie / animateur', url: `${base}/control/${event.slug}` },
    { label: 'Questions audience', url: `${base}/q/${event.slug}` },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Titre" value={form.title} onChange={set('title')} />
        <TextField label="Sous-titre" value={form.subtitle} onChange={set('subtitle')} />
        <TextField label="Édition" value={form.edition} onChange={set('edition')} />
        <TextField label="Date" type="date" value={form.event_date} onChange={set('event_date')} />
        <TextField
          label="Début (timer attente)"
          type="datetime-local"
          value={form.start_at}
          onChange={set('start_at')}
        />
        <TextField
          label="Vitesse bandeau sponsors (s/cycle)"
          type="number"
          value={form.sponsor_scroll_speed}
          onChange={set('sponsor_scroll_speed')}
        />
      </div>

      <TextArea
        label="Message de clôture (outro)"
        value={form.closing_message}
        onChange={set('closing_message')}
      />
      <TextField
        label="URL de destination du QR code (laisser vide pour masquer le QR)"
        value={form.qr_url}
        onChange={set('qr_url')}
        placeholder={`${base}/q/${event.slug}`}
      />

      <div className="rounded-xl bg-control-panel p-4">
        <Toggle
          label="Slide association en début d'intro"
          checked={form.asso_slide_enabled}
          onChange={set('asso_slide_enabled')}
        />
        {form.asso_slide_enabled && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <TextField label="Nom de l'asso" value={form.asso_name} onChange={set('asso_name')} />
            <TextField
              label="Description courte"
              value={form.asso_description}
              onChange={set('asso_description')}
            />
          </div>
        )}
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

      <div className="flex items-center gap-4">
        <SaveButton onClick={() => void save()} state={saveState} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
