// Vue Slides (gauche) — navigation entre les 4 modes globaux + sélection du
// contenu principal du mode dynamique + aperçu de l'état EP courant.
// La navigation slide par slide de l'INTRO arrive au Sprint 3.
import type { EventData } from '../../../realtime/eventData'
import type { Mode } from '../../../shared/types'
import type { ControlState } from '../hooks/useControlState'

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: 'attente', label: 'Attente', hint: 'Timer + speakers + sponsors' },
  { mode: 'intro', label: 'Intro', hint: 'Présentation table ronde' },
  { mode: 'dynamique', label: 'Dynamique', hint: 'Contenus + overlays live' },
  { mode: 'outro', label: 'Outro', hint: 'Remerciements + sponsors' },
]

export function SlidesView({ data, control }: { data: EventData; control: ControlState }) {
  const { screen } = control
  const currentContent = data.contents.find((c) => c.id === screen.mainContentId)

  return (
    <div className="flex flex-col gap-3">
      {/* Aperçu d'état EP */}
      <section className="rounded-2xl bg-control-ink p-4 text-white">
        <p className="mb-1 font-mono text-xs tracking-[0.2em] text-white/50 uppercase">
          État écran public
        </p>
        <p className="text-xl font-semibold">
          {MODES.find((m) => m.mode === screen.mode)?.label}
          {screen.mode === 'dynamique' && currentContent && (
            <span className="text-white/60"> — {currentContent.label}</span>
          )}
        </p>
        <p className="mt-1 font-mono text-xs text-white/50">
          {screen.overlay
            ? `Overlay actif : ${screen.overlay.type}`
            : 'Aucun overlay'}
          {' · '}
          {screen.speakersBannerVisible ? 'speakers visibles' : 'speakers masqués'}
          {' · '}
          {screen.qrVisible ? 'QR visible' : 'QR masqué'}
        </p>
      </section>

      {/* Navigation modes */}
      <section className="grid grid-cols-2 gap-3">
        {MODES.map(({ mode, label, hint }) => {
          const active = screen.mode === mode
          return (
            <button
              key={mode}
              type="button"
              onClick={() => control.setMode(mode)}
              className={`rounded-2xl p-5 text-left shadow-sm transition active:scale-[0.98] ${
                active ? 'bg-control-accent text-white' : 'bg-control-card text-control-ink'
              }`}
            >
              <p className="text-2xl font-semibold">{label}</p>
              <p
                className={`mt-1 font-mono text-xs ${active ? 'text-white/70' : 'text-control-dim'}`}
              >
                {hint}
              </p>
            </button>
          )
        })}
      </section>

      {/* Contenu principal (mode dynamique) */}
      <section className="rounded-2xl bg-control-panel p-3">
        <h2 className="mb-2 px-1 font-mono text-sm tracking-wide text-control-dim">
          Contenu principal — Dynamique
        </h2>
        <div className="flex flex-wrap gap-2">
          {data.contents.map((content) => {
            const active = screen.mainContentId === content.id
            return (
              <button
                key={content.id}
                type="button"
                onClick={() => control.setMainContent(active ? null : content.id)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition active:scale-95 ${
                  active ? 'bg-control-accent text-white' : 'bg-control-card text-control-ink'
                }`}
              >
                <span className="mr-2 font-mono text-[10px] uppercase opacity-60">
                  {content.kind.replace('embed_', '')}
                </span>
                {content.label}
              </button>
            )
          })}
          {data.contents.length === 0 && (
            <p className="px-1 py-2 text-sm text-control-dim">
              Aucun contenu — embeds à configurer dans le backoffice.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
