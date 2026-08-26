import { DATA } from '../../data/master.js'
import { commission } from '../../logic/engines.js'
import CommissionBars from './CommissionBars.jsx'
import CommissionCards from './CommissionCards.jsx'
import TierLadders from './TierLadder.jsx'

const LEVEL_LABELS = { low: 'Low', mid: 'Mid', high: 'High' }

export default function B2BView({ state, setState }) {
  const mode = state.mode || 'onetime'
  const level = state.level || 'low'

  return (
    <>
      <div className="section-head">
        <h2>What a partner earns</h2>
        <div className="seg">
          <button className={mode === 'onetime' ? 'on' : ''} onClick={() => setState((s) => ({ ...s, mode: 'onetime' }))}>One-time</button>
          <button className={mode === 'recurring' ? 'on' : ''} onClick={() => setState((s) => ({ ...s, mode: 'recurring' }))}>Recurring</button>
        </div>
      </div>

      <CommissionBars mode={mode} />

      {/* Take-home section: tier-interactive by commitment level + commission type */}
      <div className="section-head" style={{ marginTop: 36 }}>
        <h2>Real take-home, by commitment</h2>
        <div className="seg" role="group" aria-label="Commitment level">
          {commission.levels.map((lv) => (
            <button key={lv} className={level === lv ? 'on' : ''}
              onClick={() => setState((s) => ({ ...s, level: lv }))}>{LEVEL_LABELS[lv]}</button>
          ))}
        </div>
      </div>
      <p className="foot-note" style={{ marginTop: 0, marginBottom: 4 }}>
        {DATA.b2b?.level_descriptions?.[level]}
      </p>
      <p className="foot-note" style={{ marginTop: 0, marginBottom: 16 }}>
        Take-home (AED) = tier rate × base amount; a higher rate on a smaller base can lose. Cards re-rank live as
        you change level or commission type. <em>{DATA.b2b?.level_note}</em>
      </p>

      <CommissionCards mode={mode} level={level} />

      <details className="block">
        <summary>How each scheme is built — full tier ladders</summary>
        <TierLadders />
      </details>
    </>
  )
}
