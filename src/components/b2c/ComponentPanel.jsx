import { pricing } from '../../logic/engines.js'
import { ZONES } from '../../data/master.js'

// Slim left rail for the B2C view: duration / baseline / view, then the basket
// components as a tight vertical list (toggle + label, with an inline quantity
// stepper on visa-side items when active). Controls sit beside the chart so a
// change shows the chart update live, no scrolling. All metadata from the engine.
export default function ComponentPanel({ state, setState }) {
  const setToggle = (id, v) => setState((s) => ({ ...s, toggles: { ...s.toggles, [id]: v } }))
  const setQty = (id, delta) =>
    setState((s) => ({ ...s, qty: { ...s.qty, [id]: Math.max(1, (s.qty[id] || 1) + delta) } }))

  return (
    <div className="rail">
      <div className="rail-field">
        <label>Licence duration</label>
        <div className="seg">
          {pricing.durationOptions.map((y) => (
            <button key={y} className={state.duration === y ? 'on' : ''}
              onClick={() => setState((s) => ({ ...s, duration: y }))}>
              {y} {y === 1 ? 'yr' : 'yrs'}
            </button>
          ))}
        </div>
      </div>

      <div className="rail-field">
        <label>Baseline</label>
        <select value={state.baseline} onChange={(e) => setState((s) => ({ ...s, baseline: e.target.value }))}>
          {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      </div>

      <div className="rail-field">
        <label>View</label>
        <div className="seg">
          <button className={state.subview === 'chart' ? 'on' : ''} onClick={() => setState((s) => ({ ...s, subview: 'chart' }))}>Chart</button>
          <button className={state.subview === 'table' ? 'on' : ''} onClick={() => setState((s) => ({ ...s, subview: 'table' }))}>Table</button>
        </div>
      </div>

      <div className="rail-field">
        <label>Basket components</label>
        <div className="opts">
          {pricing.uiComponents.map((c) => {
            const m = c.meta
            const always = m.alwaysOn
            const on = always || !!state.toggles[m.id]
            return (
              <div className={`opt ${on ? 'on' : ''} ${always ? 'locked' : ''}`} key={m.id}>
                <label className="tgl">
                  <input type="checkbox" checked={on} disabled={always}
                    onChange={(e) => setToggle(m.id, e.target.checked)} aria-label={c.component} />
                  <span className="tgl-track" />
                </label>
                <span className="opt-label">
                  {c.component}{always && <span className="opt-lock">always</span>}
                </span>
                {m.hasQty && on && (
                  <span className="stepper" role="group" aria-label={`${c.component} quantity`}>
                    <button type="button" onClick={() => setQty(m.id, -1)} aria-label="decrease">−</button>
                    <span className="qv">{state.qty[m.id] || 1}</span>
                    <button type="button" onClick={() => setQty(m.id, +1)} aria-label="increase">+</button>
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {state.duration > 1 && (
          <p className="ctl-hint">
            {state.duration}-year term: each zone's multi-year logic applies (Meydan/IFZA % discount, RAKEZ official
            price table, Ajman annual). Visa &amp; one-time fees are Year-1 only.
          </p>
        )}
      </div>
    </div>
  )
}
