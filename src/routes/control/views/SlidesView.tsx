// Vue Slides (gauche) — navigation entre les 4 modes globaux, navigation
// slide par slide de l'INTRO (asso → titre → animateur → speakers → grille),
// sélection du contenu principal du mode dynamique, aperçu de l'état EP.
import type { EventData } from '../../../realtime/eventData'
import type { ControlSession } from '../../../realtime/mutations'
import { setSpeakerHidden } from '../../../realtime/mutations'
import { buildIntroSlides, clampIntroIndex } from '../../../shared/introSlides'
import type { Mode } from '../../../shared/types'
import type { ControlState } from '../hooks/useControlState'

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: 'attente', label: 'Attente', hint: 'Timer + speakers + sponsors' },
  { mode: 'intro', label: 'Intro', hint: 'Présentation table ronde' },
  { mode: 'dynamique', label: 'Dynamique', hint: 'Contenus + overlays live' },
  { mode: 'outro', label: 'Outro', hint: 'Remerciements + sponsors' },
]

export function SlidesView({
  data,
  control,
  session,
}: {
  data: EventData
  control: ControlState
  session: ControlSession
}) {
  const { screen } = control
  const currentContent = data.contents.find((c) => c.id === screen.mainContentId)
  const introSlides = buildIntroSlides(data.event, data.speakers)
  const introIndex = clampIntroIndex(screen.introSlideIndex, introSlides.length)

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

      {/* Navigation intro slide par slide (mode intro) */}
      {screen.mode === 'intro' && (
        <section className="rounded-2xl bg-control-panel p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="font-mono text-sm tracking-wide text-control-dim">
              Slides intro — {introIndex + 1}/{introSlides.length}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={introIndex === 0}
                onClick={() => control.setIntroSlide(introIndex - 1)}
                className="rounded-xl bg-control-card px-5 py-2 text-lg font-semibold shadow-sm active:scale-95 disabled:opacity-30"
              >
                ←
              </button>
              <button
                type="button"
                disabled={introIndex >= introSlides.length - 1}
                onClick={() => control.setIntroSlide(introIndex + 1)}
                className="rounded-xl bg-control-ink px-5 py-2 text-lg font-semibold text-white shadow-sm active:scale-95 disabled:opacity-30"
              >
                →
              </button>
            </div>
          </div>
          <ol className="flex flex-col gap-1.5">
            {introSlides.map((slide, i) => (
              <li
                key={`${slide.kind}-${slide.speaker?.id ?? i}`}
                className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm ${
                  i === introIndex
                    ? 'bg-control-accent text-white'
                    : 'bg-control-card text-control-ink'
                }`}
              >
                <button
                  type="button"
                  className="flex-1 text-left font-medium"
                  onClick={() => control.setIntroSlide(i)}
                >
                  <span className="mr-2 font-mono text-[10px] uppercase opacity-60">
                    {slide.kind}
                  </span>
                  {slide.label}
                </button>
                {slide.kind === 'speaker' && slide.speaker && (
                  <button
                    type="button"
                    onClick={() =>
                      void setSpeakerHidden(session, slide.speaker!.id, true).catch(() => undefined)
                    }
                    className={`ml-3 rounded px-2 py-1 font-mono text-[11px] active:scale-95 ${
                      i === introIndex ? 'text-white/70' : 'text-control-dim'
                    }`}
                  >
                    Masquer
                  </button>
                )}
              </li>
            ))}
          </ol>
          {data.speakers.some((s) => s.hidden) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
              <span className="font-mono text-xs text-control-dim">Masqué·es :</span>
              {data.speakers
                .filter((s) => s.hidden)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void setSpeakerHidden(session, s.id, false).catch(() => undefined)}
                    className="rounded-lg bg-control-card px-2.5 py-1 font-mono text-xs text-control-dim line-through active:scale-95"
                  >
                    {s.firstName} {s.lastName}
                  </button>
                ))}
            </div>
          )}
        </section>
      )}

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
