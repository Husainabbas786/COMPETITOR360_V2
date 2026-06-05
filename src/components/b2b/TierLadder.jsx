import { commission } from '../../logic/engines.js'
import { ConfidenceDot } from '../Confidence.jsx'

const pctStr = (v) => `${Math.round(v * 100)}%`

// Full tier ladders from the uniform schema (master.b2b.tiers). Orange marker on
// the ceiling (top-tier one-time rate) and any cap. One shape for every zone.
export default function TierLadders() {
  return (
    <>
      {commission.zones.map((z) => {
        const tiers = commission.tiersOf(z)
        return (
          <div className="ladder" key={z}>
            <h4>{z}</h4>
            <table>
              <thead><tr><th>Tier</th><th>One-time</th><th>Recurring</th><th>Note</th></tr></thead>
              <tbody>
                {tiers.map((t, i) => {
                  const isTop = i === tiers.length - 1 && t.one_time != null
                  const cap = /cap/i.test(t.note || '')
                  return (
                    <tr key={i}>
                      <td>{t.label}</td>
                      <td>
                        <span className="marker">
                          {(isTop || cap) && <span className="dot-orange" />}
                          <span>{t.one_time != null ? pctStr(t.one_time) : '—'}</span>
                          <ConfidenceDot confidence={t.one_time_conf} note={t.note} />
                        </span>
                        {cap && <span className="cap-badge">cap</span>}
                        {isTop && !cap && <span className="ceiling-badge">ceiling</span>}
                      </td>
                      <td>
                        {t.recurring != null
                          ? <span className="marker">{pctStr(t.recurring)}<ConfidenceDot confidence={t.recurring_conf} note={t.note} /></span>
                          : <span style={{ color: 'var(--ink-faint)' }}>not disclosed</span>}
                      </td>
                      <td style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{t.note || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </>
  )
}
