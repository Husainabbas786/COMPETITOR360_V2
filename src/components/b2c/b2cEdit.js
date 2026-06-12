// ---------------------------------------------------------------------------
// Edit-panel helpers: immutable schema updates, the editable-field model, and
// JSON export. Pure data — no rendering, no compute. The panel edits the schema
// state held in B2CView; the engine recomputes from it.
// ---------------------------------------------------------------------------

// Immutable deep set: returns a NEW object/array, cloning only along `path`.
// Never mutates the input (siblings are shared by reference).
export function setIn(obj, path, value) {
  if (path.length === 0) return value
  const [head, ...rest] = path
  const clone = Array.isArray(obj) ? obj.slice() : { ...obj }
  clone[head] = setIn(obj[head], rest, value)
  return clone
}

// Component kinds that carry no editable fee.
const SKIP_KINDS = new Set(['na', 'baked_in_licence'])
const visaTag = (n) => `${n}v`
const visaSub = (n) => `${n} visa${n === 1 ? '' : 's'}`

// Number inputs for one itemised component (Y1 / Y2 / tiered / free_allowance).
function componentFigureInputs(comp, base) {
  const inputs = []
  if (comp.kind === 'tiered_by_visa' && comp.y1_by_visa) {
    for (const k of Object.keys(comp.y1_by_visa).sort((a, b) => +a - +b)) {
      inputs.push({ label: visaTag(k), path: [...base, 'y1_by_visa', k], value: comp.y1_by_visa[k] })
    }
  } else {
    if (comp.y1 && typeof comp.y1.fee === 'number') inputs.push({ label: 'Y1', path: [...base, 'y1', 'fee'], value: comp.y1.fee })
    if (comp.y2 && typeof comp.y2.fee === 'number') inputs.push({ label: 'Y2', path: [...base, 'y2', 'fee'], value: comp.y2.fee })
  }
  if (typeof comp.free_allowance === 'number') inputs.push({ label: 'Free', path: [...base, 'free_allowance'], value: comp.free_allowance })
  return inputs
}

// Editable percentage rules for a zone's multi_year block, or null if it has no
// percentage rule (RAKEZ explicit_table / Ajman none). Percentages are stored as
// fractions (0.15); the panel renders them as % and writes the fraction back.
function buildDiscountFields(zone, zi, labelOf) {
  const my = zone.multi_year
  if (!my) return null
  const base = ['zones', zi, 'multi_year']
  const appliesTo = (my.applies_to || []).map(labelOf)

  // Meydan: one flat % across all its terms.
  if (my.type === 'flat_discount' && typeof my.discount_pct === 'number') {
    const terms = my.terms || []
    const label = terms.length ? `${terms.join('/')}yr` : 'All terms'
    return { appliesTo, fields: [{ kind: 'percent', label, path: [...base, 'discount_pct'], value: my.discount_pct }] }
  }

  // IFZA: one % per committed term, keyed "2y" / "3y" / "5y".
  if (my.type === 'tiered_discount' && my.discounts) {
    const terms = my.terms || Object.keys(my.discounts).map((k) => parseInt(k, 10))
    const fields = terms
      .filter((t) => my.discounts[`${t}y`] != null)
      .map((t) => ({ kind: 'percent', label: `${t}yr`, path: [...base, 'discounts', `${t}y`], value: my.discounts[`${t}y`] }))
    if (fields.length) return { appliesTo, fields }
  }

  return null
}

// Walk the schema → { componentLabels, zones }. Each zone carries number `rows`
// (figures), zone-level `activities` text/number fields, and per-`packages` text
// (name, note, and per-package activities for bundled zones that store them).
export function buildEditModel(schema) {
  const registry = schema.component_registry || []
  const labelOf = (key) => registry.find((r) => r.key === key)?.label || key

  // Shared component display labels (the table row labels) + a per-row show/hide
  // flag. Hiding is VISUAL only — the engine computes totals from zone figures,
  // not from this registry, so hidden rows never change the headline cost.
  const componentLabels = registry.map((reg, i) => ({
    key: reg.key,
    path: ['component_registry', i, 'label'],
    value: reg.label,
    hidden: !!reg.hidden,
    hiddenPath: ['component_registry', i, 'hidden'],
  }))

  const zones = schema.zones.map((zone, zi) => {
    const rows = [] // number rows (figures)

    // ----- figures (numbers) -----
    if (zone.model === 'bundled') {
      ;(zone.packages || []).forEach((pkg, pi) => {
        const inputs = []
        if (pkg.tier_price) {
          for (const term of Object.keys(pkg.tier_price)) {
            inputs.push({ label: term, path: ['zones', zi, 'packages', pi, 'tier_price', term], value: pkg.tier_price[term] })
          }
        }
        if (typeof pkg.tier_price_new === 'number') inputs.push({ label: 'New', path: ['zones', zi, 'packages', pi, 'tier_price_new'], value: pkg.tier_price_new })
        if (typeof pkg.tier_price_renewal === 'number') inputs.push({ label: 'Renewal', path: ['zones', zi, 'packages', pi, 'tier_price_renewal'], value: pkg.tier_price_renewal })
        if (inputs.length) rows.push({ key: pkg.package_id, label: pkg.name, sub: visaSub(pkg.visas), inputs })
      })
    } else {
      const comps = zone.components || {}
      for (const reg of registry) {
        const comp = comps[reg.key]
        if (!comp || SKIP_KINDS.has(comp.kind) || comp.noted_separate) continue
        const inputs = componentFigureInputs(comp, ['zones', zi, 'components', reg.key])
        if (inputs.length) rows.push({ key: reg.key, label: labelOf(reg.key), inputs })
      }
    }

    // ----- zone-level activities (Meydan, IFZA, Ajman store it here) -----
    const activities = []
    if (zone.activities) {
      const a = zone.activities
      const ab = ['zones', zi, 'activities']
      if (typeof a.count === 'number') activities.push({ kind: 'number', label: 'Count', path: [...ab, 'count'], value: a.count })
      if (typeof a.max === 'number') activities.push({ kind: 'number', label: 'Max', path: [...ab, 'max'], value: a.max })
      if (typeof a.type === 'string') activities.push({ kind: 'textarea', label: 'Restriction / note', path: [...ab, 'type'], value: a.type })
    }

    // ----- per-package text (name, note, per-package activities for RAKEZ) -----
    const packages = []
    ;(zone.packages || []).forEach((pkg, pi) => {
      const pb = ['zones', zi, 'packages', pi]
      const fields = []
      if (typeof pkg.name === 'string') fields.push({ kind: 'text', label: 'Name', path: [...pb, 'name'], value: pkg.name })
      // Gray-out threshold: selecting more visas than this greys the column out.
      if (typeof pkg.max_visas === 'number') fields.push({ kind: 'number', label: 'Max visas (gray-out)', path: [...pb, 'max_visas'], value: pkg.max_visas })
      if (typeof pkg.note === 'string') fields.push({ kind: 'textarea', label: 'Offer / note', path: [...pb, 'note'], value: pkg.note })
      if (pkg.activities) {
        const pa = pkg.activities
        if (typeof pa.count === 'number') fields.push({ kind: 'number', label: 'Activities count', path: [...pb, 'activities', 'count'], value: pa.count })
        if (typeof pa.type === 'string') fields.push({ kind: 'textarea', label: 'Activities note', path: [...pb, 'activities', 'type'], value: pa.type })
      }
      if (fields.length) packages.push({ key: pkg.package_id, label: pkg.name || pkg.package_id, sub: visaSub(pkg.visas), fields })
    })

    // ----- multi-year percentage discount (Meydan flat / IFZA tiered) -----
    // Only the percentages are editable; which components they discount
    // (applies_to) and the term list are left as-is. RAKEZ stores per-term
    // package prices (explicit_table) and Ajman has none → no section here.
    const discount = buildDiscountFields(zone, zi, labelOf)

    return { zone: zone.zone, model: zone.model, rows, activities, packages, discount }
  })

  return { componentLabels, zones }
}

// Serialise the edited schema and download it as master-schema.json so it can
// replace the repo file (commit → push → permanent). In-memory only otherwise.
export function downloadSchema(schema, filename = 'master-schema.json') {
  const json = JSON.stringify(schema, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
