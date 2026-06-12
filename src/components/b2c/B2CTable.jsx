import { CURRENCY } from '../../lib/b2cEngine.js'
import { COPY } from './copy.js'
import AnimatedNumber from './AnimatedNumber.jsx'

const CUR = CURRENCY.replace(/\s*\(.*\)/, '') // "AED"

// ---- cell renderers --------------------------------------------------------
function Cell({ line, available }) {
  if (!available || !line || line.dash) return <span className="c-dash">{COPY.cell.dash}</span>
  if (line.free) return <span className="c-free">{COPY.cell.free}</span>
  if (line.included) return <span className="c-incl">{COPY.cell.included}</span>
  if (line.allIn) return <AnimatedNumber value={line.amount} className="c-allin" />
  if (typeof line.amount === 'number' && line.amount > 0) {
    return (
      <span className="c-fee">
        <AnimatedNumber value={line.amount} />
        {line.qty > 1 && <small className="c-qty">×{line.qty}</small>}
      </span>
    )
  }
  return <span className="c-dash">{COPY.cell.dash}</span>
}

function ActivitiesCell({ activities, available }) {
  if (!available || !activities) return <span className="c-dash">{COPY.cell.dash}</span>
  return (
    <span className="c-act">
      <span className="c-act-n num">
        {activities.count}
        {activities.max ? `–${activities.max}` : ''}
      </span>
      <small className="c-act-t" title={activities.type}>
        {activities.type}
      </small>
    </span>
  )
}

function Delta({ col, baseTotal }) {
  if (col.isBaseline) return <span className="d-base">{COPY.table.baselineTag}</span>
  if (!col.available || col.result == null) return <span className="c-dash">{COPY.cell.dash}</span>
  const d = col.result.total - baseTotal
  if (d === 0) return <span className="d-zero">±0</span>
  const cheaper = d < 0
  return (
    <span className={cheaper ? 'd-neg' : 'd-pos'}>
      <span className="d-arrow">{cheaper ? '▼' : '▲'}</span>
      <AnimatedNumber value={Math.abs(d)} />
    </span>
  )
}

// A body/total cell that respects collapsed columns (thin empty cell) and
// unavailable packages (greyed/disabled cell, no dashes — the slot is kept).
function BodyCells({ bodyCols, render }) {
  return bodyCols.map((bc, i) => {
    if (bc.collapsed) {
      return <td key={i} className={`grid-cell collapsed-cell ${bc.isBaseline ? 'us' : ''}`} aria-hidden="true" />
    }
    if (!bc.col.available) {
      return <td key={i} className="grid-cell na-col" aria-hidden="true" />
    }
    return (
      <td key={i} className={`grid-cell ${bc.col.isBaseline ? 'us' : ''}`}>
        {render(bc.col)}
      </td>
    )
  })
}

// Pure renderer. Receives the column model + collapse state + the (stateful)
// component registry from B2CView so the read-out shares the same data and row
// labels reflect live edits.
export default function B2CTable({ state, cols, groups, collapsed, toggle, registry }) {
  // Flat column list for body/total rows: a collapsed zone becomes ONE empty
  // placeholder column (its vertical header spans both header rows).
  const bodyCols = []
  for (const g of groups) {
    if (collapsed[g.zone]) bodyCols.push({ collapsed: true, zone: g.zone, isBaseline: g.isBaseline })
    else for (const c of g.cols) bodyCols.push({ collapsed: false, col: c })
  }

  // Fixed registry rows, minus rows every column treats as a separate noted line
  // (health insurance). Row set is stable across collapse.
  const avail = cols.filter((c) => c.available)
  const rows = registry.filter((reg) => !avail.every((c) => c.byKey[reg.key]?.noted))

  const baseTotal = cols[0].result?.total ?? 0

  return (
    <div className="b2c-grid-wrap">
      <table className="b2c-grid">
        <thead>
          <tr className="zone-row">
            <th className="corner" rowSpan={2}>
              {COPY.table.componentHeader}
            </th>
            {groups.map((g) =>
              collapsed[g.zone] ? (
                <th key={g.zone} rowSpan={2} className={`zone-h zone-collapsed ${g.isBaseline ? 'us' : ''}`}>
                  <button
                    type="button"
                    className="zone-toggle"
                    onClick={() => toggle(g.zone)}
                    aria-label={COPY.table.expandLabel(g.zone)}
                    title={COPY.table.expandLabel(g.zone)}
                  >
                    +
                  </button>
                  <span className="zone-vert">{g.zone}</span>
                </th>
              ) : (
                <th key={g.zone} colSpan={g.cols.length} className={`zone-h ${g.isBaseline ? 'us' : ''}`}>
                  <span className="zone-h-inner">
                    <span className="zone-name-wrap">
                      <span className="zone-name">{g.zone}</span>
                      {g.isBaseline && <span className="zone-base">{COPY.table.baselineTag}</span>}
                    </span>
                    <button
                      type="button"
                      className="zone-toggle"
                      onClick={() => toggle(g.zone)}
                      aria-label={COPY.table.collapseLabel(g.zone)}
                      title={COPY.table.collapseLabel(g.zone)}
                    >
                      −
                    </button>
                  </span>
                </th>
              ),
            )}
          </tr>
          <tr className="pkg-row">
            {groups
              .filter((g) => !collapsed[g.zone])
              .flatMap((g) => g.cols)
              .map((c, i) => (
                <th key={i} className={`pkg-h ${c.isBaseline ? 'us' : ''} ${c.limited ? 'limited' : ''} ${!c.available ? 'na' : ''}`}>
                  {c.available ? (
                    <>
                      <span className="pkg-name">{c.pkgName}</span>
                      <span className="pkg-sub">
                        {c.sub}
                        {c.limited && <em className="pkg-badge">{COPY.saverBadge}</em>}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="pkg-name pkg-na-name">{COPY.table.naName}</span>
                      <span className="pkg-sub pkg-na-sub">{COPY.table.naSub(state.visas)}</span>
                    </>
                  )}
                </th>
              ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((reg) => (
            <tr key={reg.key} className="comp-row">
              <th className="row-label" scope="row">
                {reg.label}
              </th>
              <BodyCells
                bodyCols={bodyCols}
                render={(col) =>
                  reg.key === 'activities' ? (
                    <ActivitiesCell activities={col.activities} available={col.available} />
                  ) : (
                    <Cell line={col.byKey[reg.key]} available={col.available} />
                  )
                }
              />
            </tr>
          ))}

          <tr className="t-year1">
            <th className="row-label" scope="row">
              {COPY.table.year1Total}
            </th>
            <BodyCells
              bodyCols={bodyCols}
              render={(col) => (col.available ? <AnimatedNumber value={col.result.year1} className="t-num" /> : <span className="c-dash">{COPY.cell.dash}</span>)}
            />
          </tr>

          <tr className="t-section">
            <td colSpan={bodyCols.length + 1}>{COPY.table.renewalSection}</td>
          </tr>

          <tr className="t-year2">
            <th className="row-label" scope="row">
              {COPY.table.year2Label}
            </th>
            <BodyCells
              bodyCols={bodyCols}
              render={(col) => (col.available ? <AnimatedNumber value={col.result.year2} className="t-num-soft" /> : <span className="c-dash">{COPY.cell.dash}</span>)}
            />
          </tr>

          <tr className="t-grand">
            <th className="row-label" scope="row">
              {COPY.table.grandTotal(state.years)}
            </th>
            <BodyCells
              bodyCols={bodyCols}
              render={(col) => (col.available ? <AnimatedNumber value={col.result.total} className="g-num" /> : <span className="c-dash">{COPY.cell.dash}</span>)}
            />
          </tr>

          <tr className="t-delta">
            <th className="row-label" scope="row">
              {COPY.table.vsBaseline}
            </th>
            <BodyCells bodyCols={bodyCols} render={(col) => <Delta col={col} baseTotal={baseTotal} />} />
          </tr>
        </tbody>
      </table>

      <div className="grid-legend">
        {COPY.legend.items.map((it) => (
          <span key={it.kind} className="gl-item">
            <span className={`gl-sw gl-${it.kind}`} />
            {it.text}
          </span>
        ))}
        <span className="gl-item">
          <span className="d-arrow d-neg">▼</span>
          {COPY.legend.deltaCheaper}
        </span>
        <span className="gl-item">
          <span className="d-arrow d-pos">▲</span>
          {COPY.legend.deltaPricier}
        </span>
        <span className="gl-item gl-cur">All figures {CUR}</span>
      </div>
    </div>
  )
}
