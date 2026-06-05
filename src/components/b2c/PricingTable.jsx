import { ZONES, CURRENCY, aed, DATA } from '../../data/master.js'
import { pricing } from '../../logic/engines.js'
import { ConfidenceDot } from '../Confidence.jsx'

const CUR = CURRENCY.replace(/\s*\(.*\)/, '')
const findLine = (res, id) => res.lines.find((l) => l.id === id)
const usCls = (z) => (z === 'Meydan' ? 'us' : '')

// One basket cell, styled like the approved design (included / +extra / number).
function Cell({ line, base }) {
  if (!line) return <span style={{ color: 'var(--ink-faint)' }}>—</span>
  if (line.included) return <span className="inc">{line.bundled ? 'incl.' : 'included'}</span>
  const dot = <ConfidenceDot confidence={line.cell?.confidence} note={line.cell?.note} />
  // Base components show the plain figure; add-ons show "+X" in rust.
  if (base) return <>{aed(line.amount)}{dot}</>
  return <><span className="extra">+{aed(line.amount)}</span>{dot}</>
}

export default function PricingTable({ state, results }) {
  const active = pricing.components.filter((c) => {
    if (c.meta.group === 'bundle') return false
    return c.meta.alwaysOn || !!state.toggles[c.meta.id]
  })
  const baseComps = active.filter((c) => c.meta.group === 'base')
  const restComps = active.filter((c) => c.meta.group !== 'base')
  const anyBundle = ZONES.some((z) => findLine(results[z], 'bundle'))
  const baselineTotal = results[state.baseline]?.total ?? 0
  const year2 = DATA.multi_year?.year_2 || {}

  return (
    <div className="tbl-wrap">
      <table className="pricing">
        <thead>
          <tr>
            <th>Component</th>
            {ZONES.map((z) => <th key={z} className={`zone ${usCls(z)}`}>{z}</th>)}
          </tr>
        </thead>
        <tbody>
          {baseComps.map((c) => (
            <tr key={c.meta.id}>
              <td className="feat">{c.component}{c.meta.id === 'licence' && state.duration > 1 ? <small>× {state.duration} years</small> : null}</td>
              {ZONES.map((z) => <td key={z} className={`cell ${usCls(z)}`}><Cell line={findLine(results[z], c.meta.id)} base /></td>)}
            </tr>
          ))}

          {state.duration > 1 && (
            <tr>
              <td className="feat">Multi-year adjustment<small>{state.duration}-year term</small></td>
              {ZONES.map((z) => {
                const r = results[z]
                const adj = (r.multiYear?.value ?? r.baseSum) - r.baseSum
                return (
                  <td key={z} className={`cell ${usCls(z)}`}>
                    {adj === 0 ? <span style={{ color: 'var(--ink-faint)' }}>—</span>
                      : <><span className="extra">{adj > 0 ? '+' : ''}{aed(adj)}</span><ConfidenceDot confidence={r.multiYear?.confidence} note={`Basis: ${r.multiYear?.basis}`} /></>}
                  </td>
                )
              })}
            </tr>
          )}

          {restComps.length > 0 && <tr className="section"><td colSpan={ZONES.length + 1}>Add-ons · visa-side (Year 1)</td></tr>}
          {restComps.map((c) => (
            <tr key={c.meta.id}>
              <td className="feat">{c.component}{c.meta.hasQty && (state.qty[c.meta.id] || 1) > 1 ? <small>× {state.qty[c.meta.id]}</small> : null}</td>
              {ZONES.map((z) => <td key={z} className={`cell ${usCls(z)}`}><Cell line={findLine(results[z], c.meta.id)} /></td>)}
            </tr>
          ))}
          {anyBundle && (
            <tr>
              <td className="feat">Visa bundle increment<small>bundled zones</small></td>
              {ZONES.map((z) => {
                const l = findLine(results[z], 'bundle')
                return <td key={z} className={`cell ${usCls(z)}`}>{l
                  ? <><span className="extra">+{aed(l.amount)}</span><ConfidenceDot confidence={l.cell?.confidence} note={l.cell?.note} /></>
                  : <span style={{ color: 'var(--ink-faint)' }}>—</span>}</td>
              })}
            </tr>
          )}

          <tr className="total">
            <td className="feat">All-in · {state.duration === 1 ? 'Year 1' : `${state.duration} years`}</td>
            {ZONES.map((z) => <td key={z} className={`cell ${usCls(z)}`}>{aed(results[z].total)}</td>)}
          </tr>

          <tr className="renewal">
            <td className="feat">Renewal · Year 2<small>direction of travel</small></td>
            {ZONES.map((z) => {
              const c = year2[z]
              let txt = '—'
              if (c && c.kind === 'num') {
                const t = results[z].total
                txt = c.numeric < t * 0.97 ? `↓ ${aed(c.numeric)}` : c.numeric > t * 1.03 ? `↑ ${aed(c.numeric)}` : `≈ ${aed(c.numeric)}`
              }
              return <td key={z} className={`cell ${usCls(z)}`}>{txt}<ConfidenceDot confidence={c?.confidence} note={c?.note} /></td>
            })}
          </tr>

          <tr className="deltarow">
            <td className="feat">vs {state.baseline}</td>
            {ZONES.map((z) => {
              const d = results[z].total - baselineTotal
              const cls = z === state.baseline ? 'delta-zero' : d > 0 ? 'delta-pos' : d < 0 ? 'delta-neg' : 'delta-zero'
              return <td key={z} className={`cell ${usCls(z)} ${cls}`}>{z === state.baseline ? 'baseline' : `${d > 0 ? '+' : ''}${aed(d)}`}</td>
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
