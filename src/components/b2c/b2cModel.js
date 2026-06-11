// ---------------------------------------------------------------------------
// B2C view model — column building + the data-computed read-out (no LLM).
// Shared by B2CView (which owns the data) so the table and the read-out render
// from one source. Reads only through the compute engine; no figures here.
// ---------------------------------------------------------------------------
import { b2c, CURRENCY } from '../../lib/b2cEngine.js'
import { COPY } from './copy.js'

const CUR = CURRENCY.replace(/\s*\(.*\)/, '') // "AED"
const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export const money = (n) => `${CUR} ${fmt.format(Math.round(n))}`

const visaLabel = (n) => `${n} visa${n === 1 ? '' : 's'}`
const indexLines = (lines) => Object.fromEntries((lines || []).map((l) => [l.key, l]))

const ORDINALS = ['', 'lowest', 'second-lowest', 'third-lowest', 'fourth-lowest', 'fifth-lowest']
const ordinal = (n) => ORDINALS[n] || `${n}th-lowest`
const NUMWORDS = ['', 'one', 'two', 'three', 'four', 'five']
const numWord = (n) => NUMWORDS[n] || String(n)

// The read-out's "two-year total" is the plain Year-1 + Year-2 annual sum — the
// SAME definition for every zone (matches the table's Year-1 and Year-2 rows, and
// Ajman's annual new+renewal). It is NOT the discounted committed-term total
// shown in the grand-total row, so the figures reconcile across zones.
const twoYearOf = (result) => (result ? result.year1 + result.year2 : null)

// ---- column model ----------------------------------------------------------
function pickItemisedPackage(z, V) {
  if (!z.packages?.length) return null
  if (z.zone === 'Meydan') return z.packages[0] // single à-la-carte structure
  const max = Math.max(...z.packages.map((p) => p.visas ?? 0))
  return z.packages.find((p) => p.visas === Math.min(V, max)) || z.packages[z.packages.length - 1]
}

function itemisedColumn(zone, sel, isBaseline) {
  const { visas: V, years, statusChange, medicalCount, eidCount } = sel
  const z = b2c.getZone(zone)
  const result = b2c.computeCost({ zone, visas: V, years, statusChange, medicalCount, eidCount })
  const pkg = pickItemisedPackage(z, V)
  return {
    zone,
    isBaseline,
    pkgName: pkg?.name || zone,
    sub: visaLabel(V),
    result,
    twoYear: twoYearOf(result),
    byKey: indexLines(result.lines),
    activities: z.activities,
    limited: false,
    available: true,
  }
}

function bundledColumn(zone, pkg, years, V, limited = false) {
  if (!pkg) {
    // No package at this visa count (e.g. RAKEZ beyond 8 visas) — greyed slot.
    return { zone, isBaseline: false, pkgName: '—', sub: visaLabel(V), result: null, twoYear: null, byKey: {}, activities: null, limited, available: false }
  }
  const result = b2c.computeCost({ zone, packageId: pkg.package_id, years })
  return {
    zone,
    isBaseline: false,
    pkgName: pkg.name,
    sub: visaLabel(pkg.visas),
    result,
    twoYear: twoYearOf(result),
    byKey: indexLines(result.lines),
    activities: pkg.activities || b2c.getZone(zone).activities,
    limited,
    available: true,
  }
}

// One column per zone for the selected visa count. RAKEZ adds its limited Biz
// Saver as a second column when one exists at that count.
export function buildColumns(sel) {
  const { visas: V, years } = sel
  const cols = [itemisedColumn('Meydan', sel, true), itemisedColumn('IFZA', sel, false)]

  const rakez = b2c.getZone('RAKEZ')
  const bizPkg = rakez.packages.find((p) => p.package_id.startsWith('rakez_biz') && p.visas === V)
  const saverPkg = rakez.packages.find((p) => p.package_id.startsWith('rakez_saver') && p.visas === V)
  cols.push(bundledColumn('RAKEZ', bizPkg, years, V))
  if (saverPkg) cols.push(bundledColumn('RAKEZ', saverPkg, years, V, true))

  const ajman = b2c.getZone('Ajman')
  cols.push(bundledColumn('Ajman', ajman.packages.find((p) => p.visas === V), years, V))

  return cols
}

// Zone-group spans (Meydan | IFZA | RAKEZ[·Saver] | Ajman).
export function buildGroups(cols) {
  const groups = []
  for (const c of cols) {
    const last = groups[groups.length - 1]
    if (last && last.zone === c.zone) last.cols.push(c)
    else groups.push({ zone: c.zone, isBaseline: c.isBaseline, cols: [c] })
  }
  return groups
}

// ---- read-out (computed from the data) -------------------------------------
// Visible (non-collapsed) zones only, one primary (non-limited, available)
// column per zone. Two-year totals are Y1+Y2 — same definition for all.
export function buildInsights(groups, collapsed) {
  const cols = groups
    .filter((g) => !collapsed[g.zone])
    .map((g) => g.cols.find((c) => c.available && !c.limited) || g.cols.find((c) => c.available))
    .filter(Boolean)
  if (!cols.length) return [COPY.insights.empty]

  const out = []
  const byY1 = [...cols].sort((a, b) => a.result.year1 - b.result.year1)
  const by2y = [...cols].sort((a, b) => a.twoYear - b.twoYear)

  out.push(COPY.insights.cheapestY1(byY1[0].zone, money(byY1[0].result.year1)))
  out.push(COPY.insights.cheapest2y(by2y[0].zone, money(by2y[0].twoYear)))
  const dear = by2y[by2y.length - 1]
  if (dear !== by2y[0]) out.push(COPY.insights.dearest2y(dear.zone, money(dear.twoYear)))

  const drop = cols
    .map((c) => ({ zone: c.zone, from: c.result.year1, to: c.result.year2, d: c.result.year1 - c.result.year2 }))
    .filter((x) => x.d > 0)
    .sort((a, b) => b.d - a.d)[0]
  if (drop) out.push(COPY.insights.biggestDrop(drop.zone, money(drop.from), money(drop.to), money(drop.d)))

  const mi = by2y.findIndex((c) => c.zone === 'Meydan')
  if (mi === 0) out.push(COPY.insights.meydanLeads)
  else if (mi > 0) out.push(COPY.insights.meydanRank(ordinal(mi + 1), numWord(by2y.length)))

  return out
}
