import { useEffect, useRef } from 'react'
import { MAX_VISAS, YEAR_OPTIONS } from '../../lib/b2cEngine.js'
import { COPY } from './copy.js'

const clamp = (v) => Math.max(0, Math.min(MAX_VISAS, v))

// Keep the sticky table-header offset (--cbar-h) equal to the control bar's ACTUAL
// rendered height, so it stays aligned no matter how many rows the bar wraps to.
// Below the 860px breakpoint the bar is static and the CSS media query drives
// --cbar-h to 0, so we yield to the stylesheet there.
function useBarHeightVar(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return
    const root = document.documentElement
    const apply = () => {
      if (window.innerWidth <= 860) root.style.removeProperty('--cbar-h')
      else root.style.setProperty('--cbar-h', `${Math.round(el.getBoundingClientRect().height)}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    window.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
      root.style.removeProperty('--cbar-h')
    }
  }, [ref])
}

// A compact -/value/+ stepper, reused for visas / medical / EID. The helper hint
// rides as a tooltip (title) so the top control bar stays one clean row.
function Stepper({ label, value, onStep, title }) {
  return (
    <div className="cbar-field" title={title}>
      <label>{label}</label>
      <div className="visa-stepper" role="group" aria-label={label}>
        <button type="button" onClick={() => onStep(-1)} disabled={value <= 0} aria-label={`decrease ${label}`}>
          −
        </button>
        <span className="visa-count num" aria-live="polite">
          {value}
        </span>
        <button type="button" onClick={() => onStep(+1)} disabled={value >= MAX_VISAS} aria-label={`increase ${label}`}>
          +
        </button>
      </div>
    </div>
  )
}

// Top control bar. State is the flat shape
// { visas, years, statusChange, medicalCount, eidCount }. Medical & EID track
// the visa count (reset to it when visas change) but can be nudged on their own.
// Laid out horizontally above the full-width table; sticky via `.b2c-controlbar`.
// The Edit-data toggle (editMode/setEditMode, owned by B2CView) rides at the far
// right of this same row rather than floating in its own bar above.
export default function B2CControls({
  state,
  setState,
  editMode,
  setEditMode,
  zones = [],
  baseZone,
  setBaseZone,
  shownZones = [],
  setShownZones,
}) {
  const toggleZone = (z) =>
    setShownZones((prev) =>
      prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z],
    )

  const setVisas = (delta) =>
    setState((s) => {
      const v = clamp(s.visas + delta)
      return { ...s, visas: v, medicalCount: v, eidCount: v }
    })

  const setCount = (key) => (delta) =>
    setState((s) => ({ ...s, [key]: clamp(s[key] + delta) }))

  const barRef = useRef(null)
  useBarHeightVar(barRef)

  return (
    <div className="b2c-controlbar" role="group" aria-label="Pricing controls" ref={barRef}>
      <Stepper
        label={COPY.controls.visasLabel}
        value={state.visas}
        onStep={setVisas}
        title={`${COPY.controls.visasHint} · 0–${MAX_VISAS}`}
      />
      <Stepper
        label={COPY.controls.medicalLabel}
        value={state.medicalCount}
        onStep={setCount('medicalCount')}
        title={COPY.controls.countTrackHint}
      />
      <Stepper
        label={COPY.controls.eidLabel}
        value={state.eidCount}
        onStep={setCount('eidCount')}
        title={COPY.controls.countTrackHint}
      />

      <div className="cbar-field">
        <label>{COPY.controls.yearsLabel}</label>
        <div className="seg wide">
          {YEAR_OPTIONS.map((y) => (
            <button key={y} className={state.years === y ? 'on' : ''} onClick={() => setState((s) => ({ ...s, years: y }))}>
              {COPY.controls.yearsUnit(y)}
            </button>
          ))}
        </div>
      </div>

      <div className="cbar-field" title={COPY.controls.baseHint}>
        <label>{COPY.controls.baseLabel}</label>
        <div className="seg wide seg-zones">
          {zones.map((z) => (
            <button key={z} className={baseZone === z ? 'on' : ''} onClick={() => setBaseZone(z)}>
              {z}
            </button>
          ))}
        </div>
      </div>

      <div className="cbar-field cbar-status">
        <label>{COPY.controls.statusLabel}</label>
        <div className={`status-toggle ${state.statusChange ? 'on' : ''}`} title={COPY.controls.statusHint}>
          <label className="tgl">
            <input
              type="checkbox"
              checked={state.statusChange}
              onChange={(e) => setState((s) => ({ ...s, statusChange: e.target.checked }))}
              aria-label={COPY.controls.statusLabel}
            />
            <span className="tgl-track" />
          </label>
          <span className="status-text">{COPY.controls.statusSub}</span>
        </div>
      </div>

      <div className="cbar-field" title={COPY.controls.filterHint}>
        <label>{COPY.controls.filterLabel}</label>
        <div className="zone-filter" role="group" aria-label={COPY.controls.filterLabel}>
          {zones.map((z) => {
            const isBase = z === baseZone
            const checked = isBase || shownZones.includes(z)
            return (
              <label
                key={z}
                className={`zfilter ${checked ? 'on' : ''} ${isBase ? 'locked' : ''}`}
                title={isBase ? COPY.controls.baseLockHint(z) : `Show / hide ${z}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isBase}
                  onChange={() => toggleZone(z)}
                />
                {z}
              </label>
            )
          })}
        </div>
      </div>

      <label className={`edit-toggle cbar-edit ${editMode ? 'on' : ''}`}>
        <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
        <span className="tgl-track" />
        {COPY.edit.toggle}
      </label>
    </div>
  )
}
