import { MAX_VISAS, YEAR_OPTIONS } from '../../lib/b2cEngine.js'
import { COPY } from './copy.js'

const clamp = (v) => Math.max(0, Math.min(MAX_VISAS, v))

// A compact -/value/+ stepper, reused for visas / medical / EID.
function Stepper({ label, value, onStep, sub }) {
  return (
    <div className="rail-field">
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
      {sub && <p className="ctl-hint">{sub}</p>}
    </div>
  )
}

// Left control rail. State is the flat shape
// { visas, years, statusChange, medicalCount, eidCount }. Medical & EID track
// the visa count (reset to it when visas change) but can be nudged on their own.
export default function B2CControls({ state, setState }) {
  const setVisas = (delta) =>
    setState((s) => {
      const v = clamp(s.visas + delta)
      return { ...s, visas: v, medicalCount: v, eidCount: v }
    })

  const setCount = (key) => (delta) =>
    setState((s) => ({ ...s, [key]: clamp(s[key] + delta) }))

  return (
    <aside className="rail b2c-rail">
      <Stepper
        label={COPY.controls.visasLabel}
        value={state.visas}
        onStep={setVisas}
        sub={`${COPY.controls.visasHint} · 0–${MAX_VISAS}`}
      />

      <div className="count-group">
        <Stepper label={COPY.controls.medicalLabel} value={state.medicalCount} onStep={setCount('medicalCount')} />
        <Stepper label={COPY.controls.eidLabel} value={state.eidCount} onStep={setCount('eidCount')} />
        <p className="ctl-hint count-group-hint">{COPY.controls.countTrackHint}</p>
      </div>

      <div className="rail-field">
        <label>{COPY.controls.yearsLabel}</label>
        <div className="seg wide">
          {YEAR_OPTIONS.map((y) => (
            <button key={y} className={state.years === y ? 'on' : ''} onClick={() => setState((s) => ({ ...s, years: y }))}>
              {COPY.controls.yearsUnit(y)}
            </button>
          ))}
        </div>
      </div>

      <div className="rail-field">
        <label>{COPY.controls.statusLabel}</label>
        <div className={`status-toggle ${state.statusChange ? 'on' : ''}`}>
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
        <p className="ctl-hint">{COPY.controls.statusHint}</p>
      </div>
    </aside>
  )
}
