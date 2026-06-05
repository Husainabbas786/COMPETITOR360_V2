import { commission } from '../../logic/engines.js'

// Build the right-side annotation from the zone's uniform tier ladder, so it
// stays correct if the data changes. Mirrors the approved design's phrasing:
//   flat        -> "Same 50% at any volume"
//   plan-based  -> "Plan A 20–25%, or 40% one-time"   (IFZA)
//   quarterly   -> "→ 50% only above 121/qtr"          (Meydan)
//   yearly      -> "→ up to 55% at 350+ cos/yr"        (Ajman)
function annotate(comp, mode) {
  if (!comp.hasRate) return `${mode === 'recurring' ? 'Recurring' : 'One-time'} commission not disclosed`
  const tiers = commission.tiersOf(comp.zone)
  const entry = tiers[0]
  const top = tiers[tiers.length - 1]
  const entryPct = Math.round(comp.rate * 100)
  const topPct = Math.round((comp.rateTop ?? comp.rate) * 100)

  // Non-tiered zone that carries BOTH plans (IFZA) — describe both.
  if (tiers.length === 1 && entry.one_time != null && entry.recurring != null) {
    const m = (entry.note || '').match(/([0-9]+\s*[–-]\s*[0-9]+%)/)
    const aLabel = m ? m[1] : `${Math.round(entry.recurring * 100)}%`
    return `Plan A ${aLabel}, or ${Math.round(entry.one_time * 100)}% one-time`
  }

  // Flat for this mode — entry equals ceiling.
  if (comp.rateTop == null || comp.rateTop === comp.rate) return `Same ${entryPct}% at any volume`

  // Tiered with a spread — name the top tier from its label.
  const label = top.label || ''
  if (/\/qtr/.test(label)) return `→ ${topPct}% only above ${label.replace(/[^0-9]/g, '')}/qtr`
  if (/cos\/yr/.test(label)) return `→ up to ${topPct}% at ${label.replace(/\s*cos\/yr.*/, '').trim()} cos/yr`
  return `→ up to ${topPct}% at top tier`
}

export default function CommissionBars({ mode }) {
  const all = commission.zones.map((z) => commission.compute(z, mode))
  // Scale every bar to the largest ceiling on screen.
  const maxTop = Math.max(0.01, ...all.map((c) => c.rateTop ?? c.rate ?? 0))
  // "best" (darkest) bar = highest-rate non-Meydan zone, like the HTML.
  const best = all.filter((c) => c.hasRate && c.zone !== 'Meydan').sort((a, b) => b.rate - a.rate)[0]?.zone

  const rows = [...all].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1))

  return (
    <div className="panel bars-panel">
      <div className="basket-note">
        <span className="pill">SCENARIO</span>
        Commission a partner earns on one <b>new</b> sale at their <b>entry</b> tier. Orange marker = the ceiling
        they could reach at top volume. Toggle switches one-time vs recurring.
      </div>

      <div className="comm-bars">
        {rows.map((c) => {
          const us = c.zone === 'Meydan'
          const entryPct = c.hasRate ? Math.round(c.rate * 100) : null
          const w = c.hasRate ? (c.rate / maxTop) * 100 : 0
          const ceilLeft = c.rateTop != null ? (c.rateTop / maxTop) * 100 : null
          const showCeil = c.rateTop != null && c.rateTop > c.rate
          const fillCls = us ? 'us' : c.zone === best ? 'best' : ''
          const valOutside = w < 16
          const tagline = (us ? 'us · ' : '') + (c.model?.display || '').toLowerCase().split(';')[0].split('(')[0].trim()
          return (
            <div className="cb-row" key={c.zone}>
              <div className={`zone-name ${us ? 'us' : ''}`}>
                {c.zone}<span className="tagline">{tagline}</span>
              </div>
              <div className="cb-track">
                <div className={`cb-fill ${c.hasRate ? fillCls : 'empty'}`} style={{ width: `${w}%` }}>
                  {c.hasRate && <span className={`cb-val ${valOutside ? 'outside' : ''}`}>{entryPct}%</span>}
                </div>
                {!c.hasRate && <span className="cb-val outside" style={{ left: 10 }}>no data</span>}
                {showCeil && <div className="cb-ceil" data-l={`${Math.round(c.rateTop * 100)}%`} style={{ left: `${ceilLeft}%` }} />}
              </div>
              <div className="cb-meta">{annotate(c, mode)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
