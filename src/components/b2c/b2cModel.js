// ---------------------------------------------------------------------------
// B2C view model — column building + the data-computed read-out (no LLM).
// Shared by B2CView (which owns the data) so the table and the read-out render
// from one source. Reads only through the compute engine; no figures here.
// ---------------------------------------------------------------------------
import { CURRENCY, ZONE_ORDER } from '../../lib/b2cEngine.js'
import { COPY } from './copy.js'

const CUR = CURRENCY.replace(/\s*\(.*\)/, '') // "AED"
const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export const money = (n) => `${CUR} ${fmt.format(Math.round(n))}`

const visaLabel = (n) => `${n} visa${n === 1 ? '' : 's'}`
const indexLines = (lines) => Object.fromEntries((lines || []).map((l) => [l.key, l]))

// Surface each component's Year-1 confidence tag (from the schema) onto its line,
// so the table can mark unconfirmed estimates (e.g. IFZA's medical / EID) with the
// assumed-value underline. Display metadata only — no figure or total is touched.
function withConfidence(byKey, components) {
  if (!components) return byKey
  for (const key of Object.keys(byKey)) {
    const conf = components[key]?.y1?.confidence
    if (conf) byKey[key] = { ...byKey[key], confidence: conf }
  }
  return byKey
}

// Gray-out threshold: a package column is unavailable when the selected visa
// count exceeds the package's editable max_visas. null/undefined = no ceiling.
// Defaults equal each package's own visas, so this never changes default output.
const exceedsMaxVisas = (pkg, V) => !!pkg && typeof pkg.max_visas === 'number' && V > pkg.max_visas

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

function itemisedColumn(engine, zone, sel, isBaseline) {
  const { visas: V, years, statusChange, medicalCount, eidCount } = sel
  const z = engine.getZone(zone)
  const result = engine.computeCost({ zone, visas: V, years, statusChange, medicalCount, eidCount })
  const pkg = pickItemisedPackage(z, V)
  return {
    zone,
    isBaseline,
    // Stable per-column id for cell notes — the zone name (one column per itemised
    // zone), deliberately independent of visa count / term / base zone.
    colId: zone,
    pkgName: pkg?.name || zone,
    sub: visaLabel(V),
    result,
    twoYear: twoYearOf(result),
    byKey: withConfidence(indexLines(result.lines), z.components),
    activities: z.activities,
    limited: false,
    available: !exceedsMaxVisas(pkg, V),
  }
}

function bundledColumn(engine, zone, pkg, years, V, limited = false, isBaseline = false) {
  if (!pkg) {
    // No package at this visa count (e.g. RAKEZ beyond 8 visas) — greyed slot.
    return { zone, isBaseline: false, pkgName: '—', sub: visaLabel(V), result: null, twoYear: null, byKey: {}, activities: null, limited, available: false }
  }
  const result = engine.computeCost({ zone, packageId: pkg.package_id, years })
  return {
    zone,
    isBaseline,
    // Stable per-column id for cell notes — the package_id (a bundled zone can
    // have two columns, e.g. RAKEZ Biz One + Biz Saver), so each is distinct.
    colId: pkg.package_id,
    pkgName: pkg.name,
    sub: visaLabel(pkg.visas),
    result,
    twoYear: twoYearOf(result),
    byKey: indexLines(result.lines),
    activities: pkg.activities || engine.getZone(zone).activities,
    limited,
    available: !exceedsMaxVisas(pkg, V),
  }
}

// Header tooltip for a promo (LIMITED) column: the ADVERTISED bundle prices, which
// are NOT the operating all-in — they stop before the visa is issued. They live only
// here, never as a column figure, so the grid can never run the bundle-trap.
function advertisedTitle(promo) {
  const rows = (promo.packages || [])
    .filter((p) => p.visas >= 1)
    .map((p) => `${p.visas} visa ${p.price_was.toLocaleString('en-US')} → ${p.price_now.toLocaleString('en-US')}`)
    .join('  ·  ')
  return `Advertised bundle — excludes the actual visa issuance, medical/EID and status change, so it is NOT the operating all-in: ${rows}. The column shows the true discounted all-in.`
}

// A limited-time promo becomes a SECOND overlay column for an itemised zone (the
// RAKEZ Biz-Saver pattern): the SAME standard component build-up, minus a ONE-TIME
// bundle discount (price_was − price_now from the promo data), surfaced as an explicit
// "Limited-time discount" line so the Year-1 all-in nets to the honest discounted
// figure. It NEVER carries the advertised bundle price (that hides the visa/medical/
// status costs) — those sit only in the header tooltip. Greys out past the promo's
// visa range (max 2), exactly like Biz Saver past 1 visa.
function promoOverlayColumn(base, z, V) {
  const promo = z.promo
  const promoTitle = advertisedTitle(promo)
  const pkg = (promo.packages || []).find((p) => p.visas === V)
  const shell = {
    zone: base.zone, isBaseline: false, colId: 'dsbh_promo',
    pkgName: 'Business Setup (LIMITED)', sub: visaLabel(V),
    activities: base.activities, limited: true, promoTitle, promo,
  }
  if (!pkg || !base.result) return { ...shell, result: null, twoYear: null, byKey: {}, available: false }

  const saving = pkg.price_was - pkg.price_now
  const result = {
    ...base.result,
    year1: base.result.year1 - saving, // promo discounts SETUP (Year-1) only
    year2: base.result.year2, // renewal is NOT discounted by a setup promo
    total: base.result.total != null ? base.result.total - saving : base.result.total,
    multiYear: base.result.multiYear != null ? base.result.multiYear - saving : base.result.multiYear,
  }
  return {
    ...shell,
    result,
    twoYear: twoYearOf(result),
    byKey: { ...base.byKey, promo_discount: { key: 'promo_discount', label: 'Limited-time discount', discount: true, amount: -saving } },
    available: true,
  }
}

// Columns for a single zone at the selected visa count. Most zones yield one
// column; RAKEZ adds its limited Biz Saver as a second column when one exists at
// that count, and an itemised zone with an active promo adds a LIMITED overlay
// column. The `isBaseline` flag rides on the zone's PRIMARY column only, so the
// base figure is read from the right one.
function zoneColumns(engine, zone, sel, isBaseline) {
  const { visas: V, years } = sel
  // Itemised zones (Meydan, IFZA, SPC, SHAMS, and any future one) route by MODEL,
  // not by name — so adding an itemised zone to the schema "just works". RAKEZ and
  // Ajman stay explicit because their bundled column selection is zone-specific.
  const z = engine.getZone(zone)
  if (z && (z.model === 'itemised' || z.model === 'itemised_tiered')) {
    const base = itemisedColumn(engine, zone, sel, isBaseline)
    if (z.promo?.active) return [base, promoOverlayColumn(base, z, V)]
    return [base]
  }

  if (zone === 'RAKEZ') {
    const rakez = engine.getZone('RAKEZ')
    const bizPkg = rakez.packages.find((p) => p.package_id.startsWith('rakez_biz') && p.visas === V)
    const saverPkg = rakez.packages.find((p) => p.package_id.startsWith('rakez_saver') && p.visas === V)
    const out = [bundledColumn(engine, 'RAKEZ', bizPkg, years, V, false, isBaseline)]
    if (saverPkg) out.push(bundledColumn(engine, 'RAKEZ', saverPkg, years, V, true)) // Saver never the baseline
    return out
  }

  if (zone === 'Ajman') {
    const ajman = engine.getZone('Ajman')
    return [bundledColumn(engine, 'Ajman', ajman.packages.find((p) => p.visas === V), years, V, false, isBaseline)]
  }

  return []
}

// All columns for the table. `baseZone` (default Meydan) is rendered LEFTMOST and
// carries the baseline flag, so cols[0] is always the comparison base and the
// table's positional delta logic re-points automatically. `shownZones` (default
// all) filters which zones render; the base zone is always kept (the baseline can
// never be hidden). With the defaults this reproduces the original column set and
// order exactly.
export function buildColumns(engine, sel, baseZone = 'Meydan', shownZones = null) {
  const visible = (z) => z === baseZone || !shownZones || shownZones.includes(z)
  const rest = ZONE_ORDER.filter((z) => z !== baseZone && visible(z))
  const order = [baseZone, ...rest]
  return order.flatMap((z) => zoneColumns(engine, z, sel, z === baseZone))
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
// One primary (non-limited, available) column per visible zone. Zones are already
// filtered to the visible set upstream (Show Zones → buildColumns), so groups here
// are exactly the shown zones. Two-year totals are Y1+Y2 — same definition for all.
export function buildInsights(groups, baseZone = 'Meydan') {
  const cols = groups
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

  // The baseline's standing in the field — re-points to whichever zone is the base
  // so the read-out speaks from the same reference as the vs-delta rows.
  const mi = by2y.findIndex((c) => c.zone === baseZone)
  if (mi === 0) out.push(COPY.insights.baseLeads(baseZone))
  else if (mi > 0) out.push(COPY.insights.baseRank(baseZone, ordinal(mi + 1), numWord(by2y.length)))

  return out
}
