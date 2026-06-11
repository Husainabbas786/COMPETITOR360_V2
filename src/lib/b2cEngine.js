// Singleton B2C compute engine wired to the master schema (the new single
// source of truth for B2C). Mirrors logic/engines.js: one data source, one
// computation path. Vite imports the JSON natively.
import schema from '../data/master-schema.json'
import { createB2CCompute } from './b2cCompute.js'

// Pristine, untouched schema reference (used for "Reset to saved").
export const SCHEMA = schema
// Re-exported so the view can rebuild the engine from an edited schema clone.
export { createB2CCompute }
// Default singleton engine (pristine schema) — kept for non-edit consumers.
export const b2c = createB2CCompute(schema)

// Fixed component rows (order is meaningful — render as-is).
export const REGISTRY = schema.component_registry

// Zone order: Meydan first (baseline), then the rest as listed in the schema.
export const ZONE_ORDER = schema.meta.active_zones

export const CURRENCY = schema.meta.currency

// Stepper ceiling = the largest visa count any package supports (Ajman = 10).
// Derived from the data, never hardcoded.
export const MAX_VISAS = Math.max(
  0,
  ...schema.zones.flatMap((z) =>
    (z.packages || []).map((p) => (typeof p.max_visas === 'number' ? p.max_visas : p.visas ?? 0)),
  ),
)

export function b2cDefaultState() {
  // Medical & Emirates ID counts track the visa count by default; the steppers
  // can nudge them independently.
  return { visas: 1, years: 1, statusChange: true, medicalCount: 1, eidCount: 1 }
}

export const YEAR_OPTIONS = [1, 2, 3, 5]
