import { useEffect, useMemo, useState } from 'react'
import B2CControls from './B2CControls.jsx'
import B2CTable from './B2CTable.jsx'
import B2COffers from './B2COffers.jsx'
import B2CEditPanel from './B2CEditPanel.jsx'
import { COPY } from './copy.js'
import { buildColumns, buildGroups } from './b2cModel.js'
import { setIn, downloadSchema } from './b2cEdit.js'
import { resolveChanges } from '../../lib/b2cChanges.js'
import { SCHEMA, createB2CCompute, ZONE_ORDER } from '../../lib/b2cEngine.js'

// Deep clone of pure-JSON schema (no functions/dates) — exact and serialisable.
const cloneSchema = (s) => JSON.parse(JSON.stringify(s))

// Stable empty-notes reference so the table doesn't see a new object each render.
const EMPTY_NOTES = {}

// Feature flag for the Edit-data feature (the drawer, live editing, download/reset).
// FALSE = shipped/read-only state for the shared link: the "Edit data" toggle is
// hidden and edit mode can never be entered. Flip to TRUE to restore full editing —
// no code is removed, everything below stays wired.
const EDIT_ENABLED = false

// Rebuilt B2C view. The two-column grid holds ONLY the control rail and the
// table, so the sticky rail releases exactly at the table's end. The foot-note
// sits full-width below the grid.
export default function B2CView({ state, setState }) {
  // Editable, in-memory copy of the schema. SCHEMA stays the pristine reference
  // for "Reset". The compute engine is rebuilt whenever the schema state changes,
  // so the whole table + totals recompute live from edits.
  const [schema, setSchema] = useState(() => cloneSchema(SCHEMA))
  const engine = useMemo(() => createB2CCompute(schema), [schema])

  // Comparison-selection state (display only — never changes any cost figure):
  // which zone is the baseline, and which zones are shown. Defaults reproduce the
  // original view exactly (Meydan baseline, all zones shown).
  const [baseZone, setBaseZone] = useState('Meydan')
  const [shownZones, setShownZones] = useState(() => [...ZONE_ORDER])

  const cols = useMemo(
    () => buildColumns(engine, state, baseZone, shownZones),
    [engine, state, baseZone, shownZones],
  )
  const groups = useMemo(() => buildGroups(cols), [cols])

  // Change-tracking index (path-keyed, freshness already resolved against
  // meta.changes_seen_before). Rebuilt with the schema so a live edit — or a
  // bumped seen-before date — re-lights the grid immediately. With no markers in
  // the schema the index is empty and every cell renders exactly as before.
  const changes = useMemo(() => resolveChanges(schema).index, [schema])

  // Edit mode — off by default; when off the view is exactly as before.
  const [editMode, setEditMode] = useState(false)
  const onEdit = (path, value) => setSchema((prev) => setIn(prev, path, value))
  const onReset = () => setSchema(cloneSchema(SCHEMA))
  const onDownload = () => downloadSchema(schema)

  // Per-cell hover notes — a quick annotation map folded into the schema state
  // (schema.b2c_notes), so Download/Reset cover them for free and the compute
  // engine (which never reads this key) stays unaffected. Empty text deletes the
  // entry; an empty map is dropped so the default schema is unchanged.
  const notes = schema.b2c_notes || EMPTY_NOTES
  const setNote = (cellKey, text) =>
    setSchema((prev) => {
      const next = { ...(prev.b2c_notes || {}) }
      const t = (text || '').trim()
      if (t) next[cellKey] = t
      else delete next[cellKey]
      const out = { ...prev, b2c_notes: next }
      if (Object.keys(next).length === 0) delete out.b2c_notes
      return out
    })

  // Make room for the fixed drawer so the table stays fully visible while editing.
  useEffect(() => {
    document.body.classList.toggle('b2c-editing', EDIT_ENABLED && editMode)
    return () => document.body.classList.remove('b2c-editing')
  }, [editMode])

  return (
    <>
      <B2CControls
        state={state}
        setState={setState}
        editEnabled={EDIT_ENABLED}
        editMode={editMode}
        setEditMode={setEditMode}
        zones={ZONE_ORDER}
        baseZone={baseZone}
        setBaseZone={setBaseZone}
        shownZones={shownZones}
        setShownZones={setShownZones}
      />
      {/* Marketing offers — above the grid so they frame the comparison, and a
          SIBLING of the sticky control bar (never inside it: the bar's measured
          height drives the table's sticky-header offset). Reads the stateful
          schema clone, so an edited/reset schema carries the band with it. */}
      <B2COffers offers={schema.offers} zones={ZONE_ORDER} />

      <div className="b2c-main">
        <B2CTable state={state} cols={cols} groups={groups} registry={schema.component_registry} notes={notes} setNote={setNote} changes={changes} />
      </div>

      <div className="b2c-below">
        <p className="foot-note">{COPY.note(baseZone)}</p>
      </div>

      {EDIT_ENABLED && editMode && (
        <B2CEditPanel
          schema={schema}
          onEdit={onEdit}
          onDownload={onDownload}
          onReset={onReset}
          onClose={() => setEditMode(false)}
        />
      )}
    </>
  )
}
