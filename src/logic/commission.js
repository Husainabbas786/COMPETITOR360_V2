// ---------------------------------------------------------------------------
// B2B commission engine — pure, data-injected. No hardcoded numbers.
//   take-home (AED) = tier rate × base amount   (the figure that matters)
// Reads the UNIFORM tier schema master.b2b.tiers: every zone is an ordered
// array entry→top of { rank, label, one_time, recurring, *_conf, note }.
// mode  : 'onetime' | 'recurring'  — which rate drives every figure.
// level : 'low' | 'mid' | 'high'   — which tier (by rank) drives take-home.
// Verified: one-time entry take-home reproduces master.b2b.take_home.
// ---------------------------------------------------------------------------

const CONF_RANK = { confirmed: 1, assumed: 2, missing: 3, na: 0 }
function worst(a, b) { return (CONF_RANK[b] || 0) > (CONF_RANK[a] || 0) ? b : a }

const LEVELS = ['low', 'mid', 'high']
const rateOf = (t, mode) => (mode === 'recurring' ? t.recurring : t.one_time)
const confOf = (t, mode) => (mode === 'recurring' ? t.recurring_conf : t.one_time_conf)

export function createCommissionEngine(master) {
  const zones = master.meta.zones
  const rows = master.b2b.rows
  const tiersByZone = master.b2b.tiers || {}
  const cell = (key, zone) => rows?.[key]?.[zone] || { kind: 'missing', numeric: 0, display: '', confidence: 'missing', note: null }
  const tiersOf = (zone) => tiersByZone[zone] || []

  // Take-home of a single tier for a mode (null when that rate isn't disclosed).
  function tierTakeHome(tier, mode, baseNumeric) {
    if (!tier) return null
    const r = rateOf(tier, mode)
    return r == null ? null : r * baseNumeric
  }

  // Entry-tier view (used by the rate-ladder bars + inference): rate = rank 1,
  // ceiling = rank N. Kept shape-compatible with the previous engine.
  function compute(zone, mode) {
    const ts = tiersOf(zone)
    const entry = ts[0] || null
    const top = ts[ts.length - 1] || null
    const base = cell('base_amount', zone)
    const rate = entry ? rateOf(entry, mode) : null
    const rateTop = top ? rateOf(top, mode) : null
    const hasRate = rate != null
    const rateConf = entry ? confOf(entry, mode) : 'missing'
    const takeHome = hasRate ? rate * base.numeric : null
    return {
      zone, mode, base, model: cell('model', zone), baseApplies: cell('base_applies', zone),
      entry, top, rate, rateTop, hasRate, rateConf, takeHome,
      confidence: hasRate ? worst(rateConf, base.confidence) : rateConf,
    }
  }

  function computeAll(mode) {
    const out = {}
    for (const z of zones) out[z] = compute(z, mode)
    return out
  }

  function ranked(mode) {
    return Object.values(computeAll(mode)).sort((a, b) => sortByTakeHome(a, b))
  }

  function topRate(mode) {
    return Object.values(computeAll(mode)).filter((r) => r.hasRate).sort((a, b) => b.rate - a.rate)[0] || null
  }

  // ---- Tier-by-commitment-level -------------------------------------------
  function tierIndexForLevel(zone, level) {
    const n = tiersOf(zone).length
    if (n <= 1) return 0
    if (level === 'low') return 0
    if (level === 'high') return n - 1
    return Math.floor((n - 1) / 2) // mid
  }
  function tierAtLevel(zone, level) { return tiersOf(zone)[tierIndexForLevel(zone, level)] || null }

  // Full card view for a zone at a commitment level + commission mode, including
  // the entry→top take-home RANGE (so the spread shows without moving the control).
  function computeLevel(zone, mode, level) {
    const ts = tiersOf(zone)
    const base = cell('base_amount', zone)
    const t = tierAtLevel(zone, level)
    const rate = t ? rateOf(t, mode) : null
    const hasRate = rate != null
    const rateConf = t ? confOf(t, mode) : 'missing'
    const takeHome = hasRate ? rate * base.numeric : null

    const entryTH = tierTakeHome(ts[0], mode, base.numeric)
    const topTH = tierTakeHome(ts[ts.length - 1], mode, base.numeric)
    const flat = !(entryTH != null && topTH != null && entryTH !== topTH)

    return {
      zone, mode, level, tier: t, base,
      model: cell('model', zone), baseApplies: cell('base_applies', zone),
      rate, hasRate, rateConf, takeHome,
      confidence: hasRate ? worst(rateConf, base.confidence) : rateConf,
      range: { entry: entryTH, top: topTH, flat },
    }
  }

  function rankedByLevel(mode, level) {
    return zones.map((z) => computeLevel(z, mode, level)).sort((a, b) => sortByTakeHome(a, b))
  }

  function sortByTakeHome(a, b) {
    if (a.takeHome == null && b.takeHome == null) return 0
    if (a.takeHome == null) return 1
    if (b.takeHome == null) return -1
    return b.takeHome - a.takeHome
  }

  return {
    zones, levels: LEVELS, tiersOf,
    compute, computeAll, ranked, topRate,
    tierIndexForLevel, tierAtLevel, computeLevel, rankedByLevel,
  }
}
