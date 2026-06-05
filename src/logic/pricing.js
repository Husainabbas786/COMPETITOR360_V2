// ---------------------------------------------------------------------------
// B2C pricing engine — pure, data-injected (createPricingEngine(master)).
// No numbers are hardcoded; everything is read from the master object.
//
// Model (documented for the user, kept honest about placeholders):
//   • The BASE package (Licence + Registration + Shared Desk) RENEWS each year
//     and is subject to each zone's multi-year logic.
//   • Visa-side items, cards and status change are Year-1 one-time costs
//     (the residence visa is valid ~2 yrs, so it is NOT re-charged — the
//     flagship Year-2 assumption).
//   • Bundled zones (RAKEZ, Ajman) charge visas via a single "visa bundle
//     increment" per visa, not the itemised rows.
//
// Verified: default toggles (Licence + Desk) reproduce master.b2c.base;
//           a 1-visa config reproduces master.b2c.all_in. (see scripts/selfcheck.mjs)
// ---------------------------------------------------------------------------

// Classify a component by its name (structural, not numeric). Unknown names
// fall back to a safe one-time toggle so new rows never break the UI.
export function classify(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('licence')) return { id: 'licence', group: 'base', alwaysOn: true }
  if (n.includes('registration')) return { id: 'registration', group: 'base', alwaysOn: true, hidden: true }
  if (n.includes('shared desk') || n.includes('co-working')) return { id: 'desk', group: 'base', defaultOn: true }
  if (n.includes('establishment')) return { id: 'estcard', group: 'onetime' }
  if (n.includes('visa allocation')) return { id: 'alloc', group: 'visa', hasQty: true }
  if (n.includes('residence visa')) return { id: 'residence', group: 'visa', hasQty: true }
  if (n.includes('medical')) return { id: 'medical', group: 'visa', hasQty: true }
  if (n.includes('emirates id')) return { id: 'eid', group: 'visa', hasQty: true }
  if (n.includes('status change')) return { id: 'status', group: 'onetime' }
  if (n.includes('bundle increment')) return { id: 'bundle', group: 'bundle', hidden: true }
  return { id: 'c_' + n.replace(/[^a-z0-9]+/g, '_'), group: 'onetime' }
}

// Parse "2yr 10% / 3yr+ 15%" -> [{minYears:2,pct:0.10},{minYears:3,pct:0.15}]
export function parseDiscountSchedule(text) {
  const out = []
  if (!text) return out
  const re = /(\d+)\s*yr\+?\s*(\d+)\s*%/gi
  let m
  while ((m = re.exec(text))) out.push({ minYears: +m[1], pct: +m[2] / 100 })
  out.sort((a, b) => a.minYears - b.minYears)
  return out
}
function discountForYears(schedule, years) {
  let d = 0
  for (const tier of schedule) if (years >= tier.minYears) d = tier.pct
  return d
}

const CONF_RANK = { confirmed: 1, assumed: 2, missing: 3, na: 0 }
function worst(a, b) { return (CONF_RANK[b] || 0) > (CONF_RANK[a] || 0) ? b : a }

export function createPricingEngine(master) {
  const zones = master.meta.zones
  const components = master.b2c.components.map((c) => ({ ...c, meta: classify(c.component) }))

  const get = (comp, zone) => comp.zones[zone] || { kind: 'missing', numeric: 0, display: '', confidence: 'missing', note: null }
  const byId = (id) => components.find((c) => c.meta.id === id)
  const bundleComp = byId('bundle')

  const isBundled = (zone) => !!bundleComp && get(bundleComp, zone).kind === 'num'
  const bundleAmount = (zone) => (bundleComp ? get(bundleComp, zone).numeric : 0)

  // Visa / toggleable components surfaced to the UI (registration & bundle hidden).
  const uiComponents = components.filter((c) => !c.meta.hidden)

  function defaultState() {
    const toggles = {}
    const qty = {}
    for (const c of components) {
      const m = c.meta
      if (m.group === 'base' && !m.alwaysOn) toggles[m.id] = !!m.defaultOn // desk = on
      else if (m.group === 'onetime' || m.group === 'visa') toggles[m.id] = false
      if (m.hasQty) qty[m.id] = 1
    }
    return {
      duration: 1,
      baseline: master.meta.baseline,
      subview: 'chart',
      toggles,
      qty,
    }
  }

  const isOn = (state, c) => c.meta.alwaysOn || !!state.toggles[c.meta.id]
  const qtyOf = (state, c) => (c.meta.hasQty ? Math.max(1, state.qty[c.meta.id] || 1) : 1)

  // Multi-year cost of the recurring BASE package for `years`.
  function multiYear(zone, baseSum, years) {
    if (years <= 1) return { value: baseSum, confidence: 'confirmed', basis: 'year-1' }
    const disc = master.multi_year?.discount?.[zone]
    // RAKEZ: drive duration from the explicit official price table.
    if (zone === 'RAKEZ' && master.multi_year?.rakez_biz_one) {
      const cell = master.multi_year.rakez_biz_one[years + 'y']
      if (cell && cell.kind === 'num') {
        return { value: cell.numeric - bundleAmount(zone), confidence: cell.confidence, basis: 'table' }
      }
    }
    const schedule = parseDiscountSchedule(disc?.display)
    const d = discountForYears(schedule, years)
    const conf = disc?.confidence || 'missing'
    return { value: baseSum * years * (1 - d), confidence: conf, basis: d > 0 ? `discount ${Math.round(d * 100)}%` : 'annual', discount: d }
  }

  // Full priced breakdown for one zone given the current filter state.
  function computeZone(zone, state) {
    const bundled = isBundled(zone)
    const lines = []
    let baseSum = 0
    const baseCells = []

    // Base group (licence/registration/desk)
    for (const c of components) {
      if (c.meta.group !== 'base') continue
      const cell = get(c, zone)
      if (!isOn(state, c)) continue
      baseSum += cell.numeric
      baseCells.push(cell)
      lines.push({
        id: c.meta.id, label: c.component, group: 'base',
        amount: cell.numeric, cell, included: cell.kind === 'incl', qty: 1,
      })
    }

    // Multi-year adjustment on the base package
    const my = multiYear(zone, baseSum, state.duration)
    const baseRecurring = my.value
    let total = baseRecurring
    let conf = baseCells.reduce((a, c) => worst(a, c.confidence), 'confirmed')
    if (state.duration > 1) conf = worst(conf, my.confidence)

    // One-time singles (cards, status change)
    for (const c of components) {
      if (c.meta.group !== 'onetime') continue
      const cell = get(c, zone)
      if (!isOn(state, c)) continue
      total += cell.numeric
      conf = worst(conf, cell.confidence)
      lines.push({
        id: c.meta.id, label: c.component, group: 'onetime',
        amount: cell.numeric, cell, included: cell.kind === 'incl', qty: 1,
      })
    }

    // Visa-side
    const visaComps = components.filter((c) => c.meta.group === 'visa')
    const onVisa = visaComps.filter((c) => isOn(state, c))
    if (bundled) {
      // Bundled zones: visas priced from the per-visa increment.
      const visaCount = onVisa.reduce((mx, c) => Math.max(mx, qtyOf(state, c)), 0)
      // show itemised visa rows as "included (bundled)"
      for (const c of onVisa) {
        lines.push({ id: c.meta.id, label: c.component, group: 'visa', amount: 0, cell: get(c, zone), included: true, bundled: true, qty: qtyOf(state, c) })
      }
      if (visaCount > 0 && bundleComp) {
        const bc = get(bundleComp, zone)
        total += bc.numeric * visaCount
        conf = worst(conf, bc.confidence)
        lines.push({ id: 'bundle', label: bundleComp.component, group: 'bundle', amount: bc.numeric * visaCount, unit: bc.numeric, cell: bc, qty: visaCount })
      }
    } else {
      for (const c of onVisa) {
        const cell = get(c, zone)
        const q = qtyOf(state, c)
        total += cell.numeric * q
        conf = worst(conf, cell.confidence)
        lines.push({ id: c.meta.id, label: c.component, group: 'visa', amount: cell.numeric * q, unit: cell.numeric, cell, included: cell.kind === 'incl', qty: q })
      }
    }

    return { zone, total, confidence: conf, lines, bundled, multiYear: my, baseSum }
  }

  function computeAll(state) {
    const result = {}
    for (const z of zones) result[z] = computeZone(z, state)
    return result
  }

  // Is the current config "licence-only" (no visa, no extras)?
  function isLicenceOnly(state) {
    const extras = components.some((c) => (c.meta.group === 'onetime' || c.meta.group === 'visa') && state.toggles[c.meta.id])
    return !extras
  }
  function hasAnyVisa(state) {
    return components.some((c) => c.meta.group === 'visa' && state.toggles[c.meta.id])
  }

  return {
    zones, components, uiComponents, byId,
    isBundled, bundleAmount, defaultState, computeZone, computeAll,
    multiYear, isLicenceOnly, hasAnyVisa,
    durationOptions: [1, 2, 3, 5],
  }
}
