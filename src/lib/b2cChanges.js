// ---------------------------------------------------------------------------
// B2C change tracking — the READER (mechanism only; it never changes a figure).
//
// A value that has moved carries a marker. The grid highlights the cell that
// holds that value and offers a small info affordance ("Updated 15 Jul 2026 ·
// was 6,010"). Two sources feed ONE path-keyed index, because the schema holds
// prices in two shapes:
//
//   (a) INLINE — an object leaf that already carries confidence/source can carry
//       a sibling `changed`, exactly as specified:
//         "y1": { "fee": 6000, "confidence": "confirmed",
//                 "changed": { "on": "2026-07-15", "from": 6010 } }
//       Works for component fees and for promo package objects (price_now).
//
//   (b) meta.changelog — the audit trail, and the ONLY way to mark a FLAT number.
//       RAKEZ / Ajman tier prices are bare numbers inside a map
//       ("tier_price": { "1y": 6010 }) — there is no object to hang a marker on,
//       and turning them into objects would change the engine's read path. So a
//       tier/promo price change is recorded as a changelog entry keyed to a path
//       and the UI reads it from there. The first real change (RAKEZ) is tier
//       prices, so this is the load-bearing path.
//
// PATH GRAMMAR (the contract Track A writes against — package_id, never an array
// index, so reordering packages can never silently re-point a marker):
//   components.<key>.<y1|y2>.fee
//   packages.<package_id>.tier_price.<N>y            (RAKEZ, per-term price)
//   packages.<package_id>.tier_price_new             (Ajman, Year 1)
//   packages.<package_id>.tier_price_renewal         (Ajman, renewal)
//   promo.packages.<package_id>.price_now            (limited-time offer)
// Index key is `${zone}::${path}`. If the same path is marked both inline and in
// the changelog, the inline leaf wins (it sits on the data itself).
//
// FRESHNESS: meta.changes_seen_before is a single date that clears the board.
// A marker with on <= that date renders normally — no wash, no info mark ("old
// news"). Dates are ISO (YYYY-MM-DD) and compared as STRINGS, never Date-parsed:
// string ordering on ISO dates is exact and immune to timezone offsets.
// ---------------------------------------------------------------------------

// Numeric fields a marker can sit beside on an object leaf, in priority order.
const PRICE_FIELDS = ['fee', 'price_now', 'tier_price_new', 'amount', 'value']

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export const isIsoDate = (s) => typeof s === 'string' && ISO_DATE.test(s)

// String comparison — see header. A marker is fresh (highlighted) only when it
// is strictly AFTER the seen-before date.
export const isFresh = (on, seenBefore) =>
  isIsoDate(on) && (!isIsoDate(seenBefore) || on > seenBefore)

export const changeKey = (zone, path) => `${zone}::${path}`

// Read the current value at a contract path inside a zone. Returns undefined if
// the path does not resolve — which is how a mistyped changelog path is caught.
export function valueAtPath(zone, path) {
  if (!zone || typeof path !== 'string') return undefined
  const parts = path.split('.')
  let node = zone
  for (const seg of parts) {
    if (node == null) return undefined
    // Arrays are addressed by package_id (never by index).
    node = Array.isArray(node) ? node.find((el) => el && el.package_id === seg) : node[seg]
  }
  return node
}

// Walk a zone for INLINE markers. Any object carrying a `changed` key is picked
// up wherever it sits, so a marker can ride on any priced leaf without this
// reader needing to know that leaf in advance. Array steps become package_ids.
function walkInline(zone, out) {
  const visit = (node, trail) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const el of node) {
        const id = el && el.package_id
        visit(el, id ? [...trail, id] : trail)
      }
      return
    }
    if (node.changed && typeof node.changed === 'object') {
      const field = PRICE_FIELDS.find((f) => typeof node[f] === 'number')
      out.push({
        zone: zone.zone,
        path: [...trail, field || 'value'].join('.'),
        on: node.changed.on,
        from: node.changed.from === undefined ? null : node.changed.from,
        to: field ? node[field] : null,
        current: field ? node[field] : undefined,
        origin: 'leaf',
      })
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'changed') continue
      if (v && typeof v === 'object') visit(v, [...trail, k])
    }
  }
  visit(zone, [])
}

// Build the merged, path-keyed change index for a schema.
// Returns { seenBefore, changelog, markers, index } — `index` is a Map keyed
// `${zone}::${path}`, and every marker carries `fresh` (post-seen-before) already
// resolved, so callers never repeat the date logic.
export function resolveChanges(schema) {
  const meta = (schema && schema.meta) || {}
  const seenBefore = meta.changes_seen_before
  const changelog = Array.isArray(meta.changelog) ? meta.changelog : []
  const zones = (schema && schema.zones) || []
  const zoneOf = (name) => zones.find((z) => z.zone === name)

  const raw = []
  for (const z of zones) walkInline(z, raw)
  for (const e of changelog) {
    raw.push({
      zone: e.zone,
      path: e.path,
      on: e.on,
      from: e.from === undefined ? null : e.from,
      to: e.to === undefined ? null : e.to,
      current: valueAtPath(zoneOf(e.zone), e.path),
      label: e.label,
      origin: 'changelog',
    })
  }

  const index = new Map()
  for (const m of raw) {
    const key = changeKey(m.zone, m.path)
    const prev = index.get(key)
    // Inline leaf wins over a changelog entry for the same path.
    if (prev && prev.origin === 'leaf' && m.origin !== 'leaf') continue
    index.set(key, { ...m, fresh: isFresh(m.on, seenBefore) })
  }

  return { seenBefore, changelog, markers: [...index.values()], index }
}

// ---- cell to path ----------------------------------------------------------
// Which schema leaf does a rendered cell show? One path resolves to ONE cell, so
// a single change lights exactly one cell and never double-marks.
//
// Not every value has a cell: an inline marker on an itemised zone's y2.fee has
// nowhere to land (component rows render the Year-1 line; Year 2 is an aggregate
// total). The changelog still records it — the audit trail stays complete even
// when the grid has nothing to light.
export const TOTAL_ROW_YEAR2 = '__year2'
export const TOTAL_ROW_TOTAL = '__total'

export function cellPath(col, rowKey, state = {}) {
  if (!col || !col.available) return null
  const bundled = col.model === 'bundled'

  // Limited-time discount row — the promo package for the selected visa count
  // (the overlay column's own colId is 'dsbh_promo', not a promo package_id).
  if (rowKey === 'promo_discount') {
    const pkg = ((col.promo && col.promo.packages) || []).find((p) => p.visas === state.visas)
    return pkg ? `promo.packages.${pkg.package_id}.price_now` : null
  }

  if (rowKey === TOTAL_ROW_YEAR2) {
    // Ajman's renewal is its own published price, so it is its own leaf. RAKEZ's
    // renewal IS the 1-year tier price — already lit on the licence row, so it is
    // deliberately not mapped here (one leaf, one cell).
    return bundled && col.zone === 'Ajman' ? `packages.${col.colId}.tier_price_renewal` : null
  }

  if (rowKey === TOTAL_ROW_TOTAL) {
    // Committed-term total: RAKEZ publishes a distinct per-term tier price.
    const years = state.years || 1
    return bundled && col.zone === 'RAKEZ' && years >= 2
      ? `packages.${col.colId}.tier_price.${years}y`
      : null
  }

  if (bundled) {
    // Bundled zones carry the all-in on the licence row; every other row reads
    // "Included" and holds no leaf of its own.
    if (rowKey !== 'licence') return null
    return col.zone === 'Ajman'
      ? `packages.${col.colId}.tier_price_new`
      : `packages.${col.colId}.tier_price.1y`
  }

  // Itemised zones: the component's Year-1 fee is what the cell renders.
  return `components.${rowKey}.y1.fee`
}

// The marker to render on a cell — null when there is none, or when it predates
// meta.changes_seen_before (cleared: no wash, no info mark).
export function cellChange(index, col, rowKey, state) {
  if (!index || !col) return null
  const path = cellPath(col, rowKey, state)
  if (!path) return null
  const m = index.get(changeKey(col.zone, path))
  return m && m.fresh ? m : null
}

// ---- display ---------------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Formatted straight off the ISO string (no Date parsing — no timezone shift).
export function formatChangeDate(on) {
  if (!isIsoDate(on)) return on || ''
  const [y, m, d] = on.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
}

const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

// "Updated 15 Jul 2026 · was 6,010" — or "Added 15 Jul 2026" when from is null
// (the value is new, so there is no prior figure to show).
export function changeLabel(marker) {
  if (!marker) return ''
  const when = formatChangeDate(marker.on)
  return typeof marker.from === 'number'
    ? `Updated ${when} · was ${num.format(marker.from)}`
    : `Added ${when}`
}
