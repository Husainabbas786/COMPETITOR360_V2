import { CURRENCY, aed, DATA } from '../../data/master.js'
import { commission } from '../../logic/engines.js'
import { ConfidenceDot } from '../Confidence.jsx'

const CUR = CURRENCY.replace(/\s*\(.*\)/, '')
const asPct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)

// Cards ranked by take-home at the selected commitment LEVEL + commission mode.
// The dirham figure leads; each card also shows its entry→top take-home range.
export default function CommissionCards({ mode, level }) {
  const ranked = commission.rankedByLevel(mode, level)
  const renewalRow = DATA.b2b?.rows?.renewal || {}
  let rank = 0

  return (
    <div className="comm-grid">
      {ranked.map((r) => {
        const hasData = r.takeHome != null
        if (hasData) rank += 1
        const us = r.zone === 'Meydan'
        const renewal = renewalRow[r.zone]
        const { entry, top, flat } = r.range
        const rangeText = entry == null
          ? '—'
          : flat
            ? `${CUR} ${aed(entry)} at every level`
            : `${CUR} ${aed(entry)} → ${CUR} ${aed(top)}`
        return (
          <div className={`ccard ${us ? 'us' : ''} ${hasData ? '' : 'nodata'}`} key={r.zone}>
            <h3>{r.zone}<span className="rank">{hasData ? `#${rank} take-home` : 'no data'}</span></h3>
            <div className="model">{r.model?.display || '—'}</div>

            <div className="rate-big">
              {hasData
                ? <><span className="cur">{CUR}</span>{aed(r.takeHome)}</>
                : <span style={{ fontSize: 18 }}>not disclosed</span>}
              <ConfidenceDot confidence={r.confidence} note={hasData ? null : r.tier?.note} />
            </div>
            <div className="rate-cap">
              {hasData ? `${asPct(r.rate)} of ${CUR} ${aed(r.base.numeric)}` : '—'} · {mode === 'onetime' ? 'one-time' : 'recurring'}
            </div>

            <div className="crow"><span>This level ({level})</span><b>{r.tier?.label || '—'}</b></div>
            <div className="crow"><span>Range (entry→top)</span><b>{rangeText}</b></div>
            <div className="crow"><span>Renewal</span><b>{renewal?.kind === 'pct' ? asPct(renewal.numeric) : (renewal?.display || '—')}</b></div>

            <div className="note">
              Commission base: {r.baseApplies?.display || '—'}.
              <ConfidenceDot confidence={r.baseApplies?.confidence} note={r.baseApplies?.note} />
              {' '}Take-home = rate × base — the figure that actually lands.
            </div>
          </div>
        )
      })}
    </div>
  )
}
