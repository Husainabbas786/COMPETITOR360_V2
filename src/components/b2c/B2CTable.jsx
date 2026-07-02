import { CURRENCY } from '../../lib/b2cEngine.js'
import { COPY } from './copy.js'
import AnimatedNumber from './AnimatedNumber.jsx'
import CellNote from './B2CCellNote.jsx'

const CUR = CURRENCY.replace(/\s*\(.*\)/, '') // "AED"

// ---- cell renderers --------------------------------------------------------
function Cell({ line, available }) {
  if (!available || !line || line.dash) return <span className="c-dash">{COPY.cell.dash}</span>
  // Limited-time promo discount: a negative one-time reduction on the setup all-in
  // (only the promo overlay column carries it). Rendered distinct so the Year-1 total
  // visibly nets down to the discounted figure.
  if (line.discount) return <AnimatedNumber value={line.amount} className="c-discount" />
  if (line.free) return <span className="c-free">{COPY.cell.free}</span>
  if (line.included) return <span className="c-incl">{COPY.cell.included}</span>
  if (line.allIn) return <AnimatedNumber value={line.amount} className="c-allin" />
  if (typeof line.amount === 'number' && line.amount > 0) {
    // Assumed estimates (e.g. IFZA medical/EID — unconfirmed) carry a subtle amber
    // underline beneath the number, the financial-model "this is an assumption" mark.
    const assumed = line.confidence === 'assumed'
    return (
      <span className="c-fee">
        <AnimatedNumber value={line.amount} className={assumed ? 'is-assumed' : ''} />
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
        {activities.max && activities.max !== activities.count ? `–${activities.max}` : ''}
      </span>
      <small className="c-act-t" title={activities.type}>
        {activities.type}
      </small>
    </span>
  )
}

// Generic vs-baseline delta: `getVal(col)` selects which total to compare
// (Year-1 all-in, or the 2-year Y1+Y2 sum), `base` is the same figure for Meydan.
function Delta({ col, getVal, base }) {
  if (col.isBaseline) return <span className="d-base">{COPY.table.baselineTag}</span>
  if (!col.available || col.result == null) return <span className="c-dash">{COPY.cell.dash}</span>
  const d = getVal(col) - base
  if (d === 0) return <span className="d-zero">±0</span>
  const cheaper = d < 0
  return (
    <span className={cheaper ? 'd-neg' : 'd-pos'}>
      <span className="d-arrow">{cheaper ? '▼' : '▲'}</span>
      <AnimatedNumber value={Math.abs(d)} />
    </span>
  )
}

// A body/total cell that respects unavailable packages (greyed/disabled cell,
// no dashes — the slot is kept).
function BodyCells({ bodyCols, render }) {
  return bodyCols.map((bc, i) => {
    if (!bc.col.available) {
      return <td key={i} className={`grid-cell na-col ${bc.shade}`} aria-hidden="true" />
    }
    return (
      <td key={i} className={`grid-cell ${bc.col.isBaseline ? 'us' : ''} ${bc.shade}`}>
        {render(bc.col)}
      </td>
    )
  })
}

// Pure renderer. Receives the column model + the (stateful) component registry
// from B2CView so the read-out shares the same data and row labels reflect live
// edits. Zones are hidden/shown via the Show Zones filter upstream (in
// buildColumns), so every group that reaches here is a visible one.
export default function B2CTable({ state, cols, groups, registry, notes = {}, setNote }) {
  // Flat column list for body/total rows.
  // Subtle alternating zone banding: every column carries its zone's parity
  // (group index) so all package sub-columns within a zone share one shade. The
  // band is purely visual — see `.z-alt` in styles.css.
  const shadeOf = (gi) => (gi % 2 === 1 ? 'z-alt' : '')
  const bodyCols = []
  groups.forEach((g, gi) => {
    for (const c of g.cols) bodyCols.push({ col: c, shade: shadeOf(gi) })
  })

  // Fixed registry rows, minus rows every column treats as a separate noted line
  // (health insurance), minus rows hidden via the edit panel. Hiding is visual
  // only — totals are computed in the engine and are unaffected.
  const avail = cols.filter((c) => c.available)
  const rows = registry.filter((reg) => !reg.hidden && !avail.every((c) => c.byKey[reg.key]?.noted))
  // If a promo (LIMITED) overlay column is in view, append its "Limited-time discount"
  // line as a synthetic row just before the Year-1 total (dash for every other column),
  // so the discount is explicit and Year-1 all-in visibly nets to the discounted figure.
  const hasPromo = avail.some((c) => c.byKey?.promo_discount)
  const compRows = hasPromo ? [...rows, { key: 'promo_discount', label: COPY.table.promoDiscount }] : rows

  // Baseline (Meydan) figures the vs-Meydan rows compare against. The 2-year
  // total is the plain Year-1 + Year-2 sum (col.twoYear) — same definition for
  // every zone, so a zone's 2-year total = its Year-1 + its Year-2 and the deltas
  // reconcile.
  const baseYear1 = cols[0].result?.year1 ?? 0
  const baseTwoYear = cols[0].twoYear ?? 0
  // The baseline is always the first column (buildColumns puts the chosen base
  // zone leftmost), so the vs-delta rows label themselves from it.
  const baseZoneName = cols[0]?.zone

  // The "2-year total" row is driven by the Licence Term control. At 1yr it shows
  // the plain Year-1 + Year-2 annual-renewal sum (col.twoYear); at 2/3/5yr it
  // shows the committed-term total the engine already computes for that term
  // (col.result.total, keyed by state.years). The vs-Meydan delta below it uses
  // the SAME basis for every column so the comparison stays apples-to-apples.
  const committed = state.years >= 2
  const totalOf = (col) => (committed ? col.result.total : col.twoYear)
  const baseTotalRow = committed ? cols[0].result?.total ?? 0 : baseTwoYear
  const totalLabel = committed ? COPY.table.committedTotal(state.years) : COPY.table.twoYearTotal

  return (
    <div className="b2c-grid-wrap">
      <table className="b2c-grid">
        <thead>
          <tr className="zone-row">
            <th className="corner" rowSpan={2}>
              {COPY.table.componentHeader}
            </th>
            {groups.map((g, gi) => (
              <th key={g.zone} colSpan={g.cols.length} className={`zone-h ${g.isBaseline ? 'us' : ''} ${shadeOf(gi)}`}>
                <span className="zone-h-inner">
                  <span className="zone-name-wrap">
                    <span className="zone-name">{g.zone}</span>
                    {g.isBaseline && <span className="zone-base">{COPY.table.baselineTag}</span>}
                  </span>
                </span>
              </th>
            ))}
          </tr>
          <tr className="pkg-row">
            {groups
              .flatMap((g) => g.cols.map((c) => ({ c, shade: shadeOf(groups.indexOf(g)) })))
              .map(({ c, shade }, i) => (
                <th key={i} className={`pkg-h ${c.isBaseline ? 'us' : ''} ${c.limited ? 'limited' : ''} ${!c.available ? 'na' : ''} ${shade}`} title={c.promoTitle || undefined}>
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
          {compRows.map((reg) => (
            <tr key={reg.key} className={`comp-row ${reg.key === 'promo_discount' ? 'promo-discount-row' : ''}`}>
              <th className="row-label" scope="row">
                {reg.label}
              </th>
              <BodyCells
                bodyCols={bodyCols}
                render={(col) => {
                  if (reg.key === 'activities')
                    return <ActivitiesCell activities={col.activities} available={col.available} />
                  const cell = <Cell line={col.byKey[reg.key]} available={col.available} />
                  // Hover-notes ride only on rendered component value cells (not greyed
                  // slots or the computed totals/delta rows). Key by stable colId.
                  if (!col.available || !setNote) return cell
                  const cellKey = `${col.colId}::${reg.key}`
                  return (
                    <CellNote cellKey={cellKey} note={notes[cellKey]} setNote={setNote}>
                      {cell}
                    </CellNote>
                  )
                }}
              />
            </tr>
          ))}

          {/* (a) Year-1 all-in, then (b) its vs-Meydan delta — the Year-1 story. */}
          <tr className="t-year1">
            <th className="row-label" scope="row">
              {COPY.table.year1Total}
            </th>
            <BodyCells
              bodyCols={bodyCols}
              render={(col) => (col.available ? <AnimatedNumber value={col.result.year1} className="t-num" /> : <span className="c-dash">{COPY.cell.dash}</span>)}
            />
          </tr>

          <tr className="t-delta">
            <th className="row-label" scope="row">
              {COPY.table.vsBaseline(baseZoneName)}
            </th>
            <BodyCells bodyCols={bodyCols} render={(col) => <Delta col={col} getVal={(c) => c.result.year1} base={baseYear1} />} />
          </tr>

          {/* (c) Renewal / Year-2. */}
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

          {/* (d) 2-year / committed total (term-driven), then (e) its vs-Meydan delta. */}
          <tr className="t-grand">
            <th className="row-label" scope="row">
              {totalLabel}
            </th>
            <BodyCells
              bodyCols={bodyCols}
              render={(col) => (col.available ? <AnimatedNumber value={totalOf(col)} className="g-num" /> : <span className="c-dash">{COPY.cell.dash}</span>)}
            />
          </tr>

          <tr className="t-delta">
            <th className="row-label" scope="row">
              {COPY.table.vsBaseline(baseZoneName)}
            </th>
            <BodyCells bodyCols={bodyCols} render={(col) => <Delta col={col} getVal={totalOf} base={baseTotalRow} />} />
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
          {COPY.legend.deltaCheaper(baseZoneName)}
        </span>
        <span className="gl-item">
          <span className="d-arrow d-pos">▲</span>
          {COPY.legend.deltaPricier(baseZoneName)}
        </span>
        <span className="gl-item gl-cur">All figures {CUR}</span>
      </div>
    </div>
  )
}
