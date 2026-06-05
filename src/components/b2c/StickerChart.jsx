import { CURRENCY, aed } from '../../data/master.js'
import { pricing } from '../../logic/engines.js'
import { ConfidenceDot } from '../Confidence.jsx'

const CUR = CURRENCY.replace(/\s*\(.*\)/, '')

// Live version of the approved design's "sticker vs hidden" horizontal bars.
//   sticker = the headline price a zone advertises:
//             bundled zones (visa lives in the bundle increment) -> the full package;
//             unbundled zones -> the licence (scaled by the current multi-year factor).
//   hidden  = total - sticker = "cost added on top before you can operate".
// Everything recomputes from the engine on every toggle / quantity / duration change.
export default function StickerChart({ state, results }) {
  const licenceComp = pricing.byId('licence')

  const rows = pricing.zones.map((zone) => {
    const r = results[zone]
    const bundled = r.bundled
    const total = r.total
    // multi-year factor applied to the recurring base, so sticker tracks duration.
    const factor = r.baseSum > 0 ? (r.multiYear?.value ?? r.baseSum) / r.baseSum : 1
    const licenceCell = licenceComp?.zones?.[zone]
    const licenceNum = (licenceCell?.numeric || 0) * factor
    const sticker = bundled ? total : Math.min(licenceNum, total)
    const hidden = Math.max(0, total - sticker)
    return {
      zone, bundled, total, sticker, hidden,
      stickerConf: bundled ? r.confidence : (licenceCell?.confidence || 'missing'),
      totalConf: r.confidence,
      us: zone === 'Meydan',
      tagline: `${zone === 'Meydan' ? 'us · ' : ''}${bundled ? 'bundled' : 'unbundled'}`,
    }
  })

  // Editorial ordering: cheapest at top, most-expensive (the punchline) at the bottom.
  rows.sort((a, b) => a.total - b.total)
  const max = Math.max(1, ...rows.map((r) => r.total))

  return (
    <div className="panel bars-panel">
      <div className="basket-note">
        <span className="pill">BASKET</span>
        Your current configuration, all-in. Solid = advertised sticker; hatched orange = cost added on top
        before you can operate. Bundled zones hide little; unbundled zones stack the extras. All figures {CUR}.
      </div>

      {rows.map((r) => {
        const sw = (r.sticker / max) * 100
        const hw = (r.hidden / max) * 100
        return (
          <div className="bar-row" key={r.zone}>
            <div className={`zone-name ${r.us ? 'us' : ''}`}>
              {r.zone}<span className="tagline">{r.tagline}</span>
            </div>
            <div className="track">
              <div className={`fill-sticker ${r.us ? 'us' : ''}`} style={{ width: `${sw}%` }}>
                <span className="tick-label">{aed(r.sticker)} sticker</span>
              </div>
              {r.hidden > 0 && (
                <div className="fill-hidden" style={{ left: `${sw}%`, width: `${hw}%` }} />
              )}
            </div>
            <div className="allin">
              <div className={`v ${r.us ? 'us' : ''}`}>{aed(r.total)}<ConfidenceDot confidence={r.totalConf} /></div>
              <div className="l">all-in</div>
              {r.hidden > 0 && <div className="gap-flag">+{aed(r.hidden)} hidden</div>}
            </div>
          </div>
        )
      })}

      <div className="legend">
        <span><span className="sw solid" /> Advertised sticker price</span>
        <span><span className="sw us" /> Meydan sticker</span>
        <span><span className="sw hatch" /> Cost added on top before you can operate</span>
      </div>
    </div>
  )
}
