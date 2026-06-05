// ---------------------------------------------------------------------------
// Data-reading layer — the ONLY module that knows the shape of master-data.json.
// Everything else reads through these helpers, so dropping in updated data
// (same schema) needs zero changes elsewhere. Hardcodes nothing: every figure,
// label, zone and confidence comes from the JSON.
// ---------------------------------------------------------------------------
import master from '../../master-data.json'

export const DATA = master
export const META = master.meta
export const ZONES = master.meta.zones
export const BASELINE = master.meta.baseline
export const CURRENCY = master.meta.currency
export const LEGEND = master.confidence_legend
export const SOURCES = master.sources
export const GAPS = master.assumptions_gaps

// Confidence ranking — higher = less certain. 'na' is not a data quality issue.
export const CONF_RANK = { confirmed: 1, assumed: 2, missing: 3, na: 0 }

// A safe, empty cell — used whenever the JSON is missing something so the UI
// never crashes; it simply renders with the "missing" colour.
export const EMPTY_CELL = Object.freeze({
  kind: 'missing', value: null, numeric: 0, display: '', confidence: 'missing', note: null,
})

// Worst (least certain) confidence across a set of cells, ignoring n/a.
export function worstConfidence(cells) {
  let worst = 'confirmed'
  for (const c of cells) {
    if (!c || c.confidence === 'na') continue
    if ((CONF_RANK[c.confidence] || 0) > (CONF_RANK[worst] || 0)) worst = c.confidence
  }
  return worst
}

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

// Format an AED amount. Never throws on null/NaN.
export function aed(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return fmt.format(Math.round(n))
}

// Format a percentage from a 0..1 fraction.
export function pct(fraction) {
  if (fraction == null || Number.isNaN(fraction)) return '—'
  return `${Math.round(fraction * 1000) / 10}%`.replace('.0%', '%')
}

export function confidenceLabel(key) {
  return LEGEND?.[key]?.label || key
}
export function confidenceMeaning(key) {
  return LEGEND?.[key]?.meaning || ''
}
