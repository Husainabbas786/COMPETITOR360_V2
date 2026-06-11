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

// Walk the schema → a per-zone list of editable rows. Each row is a labelled
// component/package with one or more numeric inputs (each input knows its path).
export function buildEditModel(schema) {
  const registry = schema.component_registry || []
  const labelOf = (key) => registry.find((r) => r.key === key)?.label || key

  return schema.zones.map((zone, zi) => {
    if (zone.model === 'bundled') {
      const rows = (zone.packages || [])
        .map((pkg, pi) => {
          const inputs = []
          if (pkg.tier_price) {
            // RAKEZ: one all-in price per available licence term. Renewal = 1yr.
            for (const term of Object.keys(pkg.tier_price)) {
              inputs.push({ label: term, path: ['zones', zi, 'packages', pi, 'tier_price', term], value: pkg.tier_price[term] })
            }
          }
          // Ajman: new (Year 1) + renewal (Year 2+).
          if (typeof pkg.tier_price_new === 'number')
            inputs.push({ label: 'New', path: ['zones', zi, 'packages', pi, 'tier_price_new'], value: pkg.tier_price_new })
          if (typeof pkg.tier_price_renewal === 'number')
            inputs.push({ label: 'Renewal', path: ['zones', zi, 'packages', pi, 'tier_price_renewal'], value: pkg.tier_price_renewal })

          return { key: pkg.package_id, label: pkg.name, sub: `${pkg.visas} visa${pkg.visas === 1 ? '' : 's'}`, inputs }
        })
        .filter((r) => r.inputs.length)
      return { zone: zone.zone, model: 'bundled', rows }
    }

    // itemised / itemised_tiered
    const comps = zone.components || {}
    const rows = []
    for (const reg of registry) {
      const comp = comps[reg.key]
      if (!comp || SKIP_KINDS.has(comp.kind) || comp.noted_separate) continue
      const base = ['zones', zi, 'components', reg.key]
      const inputs = []

      if (comp.kind === 'tiered_by_visa' && comp.y1_by_visa) {
        // Tier price per visa count (the allocation is baked into the step).
        for (const k of Object.keys(comp.y1_by_visa).sort((a, b) => +a - +b)) {
          inputs.push({ label: visaTag(k), path: [...base, 'y1_by_visa', k], value: comp.y1_by_visa[k] })
        }
      } else {
        if (comp.y1 && typeof comp.y1.fee === 'number')
          inputs.push({ label: 'Y1', path: [...base, 'y1', 'fee'], value: comp.y1.fee })
        if (comp.y2 && typeof comp.y2.fee === 'number')
          inputs.push({ label: 'Y2', path: [...base, 'y2', 'fee'], value: comp.y2.fee })
      }
      if (typeof comp.free_allowance === 'number')
        inputs.push({ label: 'Free', path: [...base, 'free_allowance'], value: comp.free_allowance })

      if (inputs.length) rows.push({ key: reg.key, label: labelOf(reg.key), inputs })
    }
    return { zone: zone.zone, model: 'itemised', rows }
  })
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
