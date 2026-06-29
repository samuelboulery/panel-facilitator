// Section CRUD générique du backoffice : liste ordonnée + ajout + édition
// inline + suppression + réordonnancement. Chaque entité fournit son
// formulaire (renderForm) et son résumé de ligne (renderSummary).
import { useCallback, useEffect, useState } from 'react'
import {
  deleteRow,
  insertRow,
  listRows,
  updateRow,
  type AdminTable,
} from '../../../realtime/adminData'
import { notifySaved } from '../components/SavedSnackbar'

interface BaseRow {
  id: string
  sort_order: number
}

interface ListSectionProps<T extends BaseRow> {
  table: AdminTable
  eventId: string
  /** Valeurs initiales d'une nouvelle ligne (sans event_id ni sort_order). */
  emptyRow: () => Record<string, unknown>
  renderSummary: (row: T) => React.ReactNode
  /** Formulaire d'édition : draft + setter. */
  renderForm: (draft: Record<string, unknown>, set: (k: string, v: unknown) => void) => React.ReactNode
  addLabel: string
  /** Filtre de liste additionnel (ex. { kind } sur la table partagée polls). */
  filter?: Record<string, unknown>
}

export function ListSection<T extends BaseRow>({
  table,
  eventId,
  emptyRow,
  renderSummary,
  renderForm,
  addLabel,
  filter,
}: ListSectionProps<T>) {
  const [rows, setRows] = useState<T[]>([])
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filter ?? null)
  const reload = useCallback(async () => {
    setRows(await listRows<T>(table, eventId, filter))
    // filterKey capture le contenu de filter pour le hook (objet recréé à chaque render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, eventId, filterKey])

  useEffect(() => {
    void reload()
  }, [reload])

  const startEdit = (row: T) => {
    setEditing(row.id)
    setDraft({ ...(row as unknown as Record<string, unknown>) })
    setError(null)
  }

  const startNew = () => {
    setEditing('new')
    setDraft(emptyRow())
    setError(null)
  }

  const setField = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }))

  const save = async () => {
    // Clés « _ » = états d'UI (ex : _options_text) ; id/event_id/created_at =
    // gérés par le serveur — exclus avant écriture.
    const SERVER_KEYS = new Set(['id', 'event_id', 'created_at', 'updated_at'])
    const clean = Object.fromEntries(
      Object.entries(draft).filter(([k]) => !k.startsWith('_') && !SERVER_KEYS.has(k)),
    )
    try {
      if (editing === 'new') {
        const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), -1)
        await insertRow(table, { ...clean, event_id: eventId, sort_order: maxOrder + 1 })
      } else if (editing) {
        await updateRow(table, editing, clean)
      }
      setEditing(null)
      await reload()
      notifySaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteRow(table, id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const a = rows[index]
    const b = rows[target]
    try {
      await updateRow(table, a.id, { sort_order: b.sort_order })
      await updateRow(table, b.id, { sort_order: a.sort_order })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={row.id} className="rounded-xl bg-control-card p-3 shadow-control-card">
          {editing === row.id ? (
            <EditForm
              draft={draft}
              setField={setField}
              renderForm={renderForm}
              onSave={() => void save()}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button type="button" onClick={() => void move(i, -1)} disabled={i === 0} className="px-1 text-xs text-control-dim disabled:opacity-20">▲</button>
                <button type="button" onClick={() => void move(i, 1)} disabled={i === rows.length - 1} className="px-1 text-xs text-control-dim disabled:opacity-20">▼</button>
              </div>
              <div className="min-w-0 flex-1">{renderSummary(row)}</div>
              <button type="button" onClick={() => startEdit(row)} className="rounded px-2 py-1 font-mono text-xs text-control-dim active:scale-95">
                Modifier
              </button>
              <button type="button" onClick={() => void remove(row.id)} className="rounded px-2 py-1 font-mono text-xs text-red-500 active:scale-95">
                Supprimer
              </button>
            </div>
          )}
        </div>
      ))}

      {editing === 'new' ? (
        <div className="rounded-xl bg-control-card p-3 shadow-control-card">
          <EditForm
            draft={draft}
            setField={setField}
            renderForm={renderForm}
            onSave={() => void save()}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={startNew}
          className="rounded-xl border-2 border-dashed border-control-bg py-3 font-mono text-sm text-control-dim active:scale-[0.99]"
        >
          + {addLabel}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

function EditForm({
  draft,
  setField,
  renderForm,
  onSave,
  onCancel,
}: {
  draft: Record<string, unknown>
  setField: (k: string, v: unknown) => void
  renderForm: ListSectionProps<BaseRow>['renderForm']
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {renderForm(draft, setField)}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 font-mono text-sm text-control-dim active:scale-95">
          Annuler
        </button>
        <button type="button" onClick={onSave} className="rounded-lg bg-control-ink px-4 py-2 font-mono text-sm text-white active:scale-95">
          Enregistrer
        </button>
      </div>
    </div>
  )
}
