// Petits composants de formulaire du backoffice — style sobre PC,
// cohérent avec la palette IR (cartes blanches, accent bleu).
import { useId, useState } from 'react'
import { uploadImage } from '../../../realtime/adminData'

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block font-mono text-xs tracking-wide text-control-dim">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-control-bg bg-white px-3 py-2 text-sm outline-control-accent"
      />
    </label>
  )
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block font-mono text-xs tracking-wide text-control-dim">{label}</span>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-control-bg bg-white px-3 py-2 text-sm outline-control-accent"
      />
    </label>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 py-1"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-control-accent' : 'bg-control-bg'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span className="text-sm">{label}</span>
    </button>
  )
}

export function ImageField({
  label,
  url,
  folder,
  maxDim,
  onUploaded,
}: {
  label: string
  url: string | null
  folder: 'speakers' | 'sponsors'
  maxDim: number
  onUploaded: (url: string) => void
}) {
  const id = useId()
  const [state, setState] = useState<'idle' | 'uploading' | 'error'>('idle')

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setState('uploading')
    try {
      onUploaded(await uploadImage(file, folder, maxDim))
      setState('idle')
    } catch (err) {
      console.error('[fields] upload image échoué :', err)
      setState('error')
    }
  }

  return (
    <div className="flex items-center gap-3">
      {url ? (
        <img src={url} alt="" className="h-12 w-12 rounded-lg object-cover" />
      ) : (
        <div className="h-12 w-12 rounded-lg bg-control-bg" />
      )}
      <label
        htmlFor={id}
        className="cursor-pointer rounded-lg bg-control-panel px-3 py-2 font-mono text-xs text-control-ink active:scale-95"
      >
        {state === 'uploading' ? 'Envoi…' : state === 'error' ? 'Échec — réessayer' : label}
        <input
          id={id}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
    </div>
  )
}

export function SaveButton({
  onClick,
  state,
}: {
  onClick: () => void
  state: 'idle' | 'saving' | 'saved' | 'error'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'saving'}
      className="rounded-xl bg-control-ink px-6 py-2.5 font-mono text-sm text-white active:scale-95 disabled:opacity-50"
    >
      {state === 'saving' ? 'Enregistrement…' : state === 'saved' ? 'Enregistré ✓' : 'Enregistrer'}
    </button>
  )
}
