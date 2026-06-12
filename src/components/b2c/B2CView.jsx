import { useEffect, useMemo, useState } from 'react'
import B2CControls from './B2CControls.jsx'
import B2CTable from './B2CTable.jsx'
import B2CInsights from './B2CInsights.jsx'
import B2CEditPanel from './B2CEditPanel.jsx'
import SourcesPanel from '../SourcesPanel.jsx'
import { COPY } from './copy.js'
import { buildColumns, buildGroups, buildInsights } from './b2cModel.js'
import { setIn, downloadSchema } from './b2cEdit.js'
import { SCHEMA, createB2CCompute } from '../../lib/b2cEngine.js'

// Deep clone of pure-JSON schema (no functions/dates) — exact and serialisable.
const cloneSchema = (s) => JSON.parse(JSON.stringify(s))

// Rebuilt B2C view. The two-column grid holds ONLY the control rail and the
// table, so the sticky rail releases exactly at the table's end. Everything else
// (foot-note, read-out, sources & verify) sits full-width below the grid.
export default function B2CView({ state, setState }) {
  // Editable, in-memory copy of the schema. SCHEMA stays the pristine reference
  // for "Reset". The compute engine is rebuilt whenever the schema state changes,
  // so the whole table + totals + read-out recompute live from edits.
  const [schema, setSchema] = useState(() => cloneSchema(SCHEMA))
  const engine = useMemo(() => createB2CCompute(schema), [schema])

  const cols = useMemo(() => buildColumns(engine, state), [engine, state])
  const groups = useMemo(() => buildGroups(cols), [cols])
  const [collapsed, setCollapsed] = useState({})
  const toggle = (zone) => setCollapsed((c) => ({ ...c, [zone]: !c[zone] }))
  const insights = buildInsights(groups, collapsed)

  // Edit mode — off by default; when off the view is exactly as before.
  const [editMode, setEditMode] = useState(false)
  const onEdit = (path, value) => setSchema((prev) => setIn(prev, path, value))
  const onReset = () => setSchema(cloneSchema(SCHEMA))
  const onDownload = () => downloadSchema(schema)

  // Make room for the fixed drawer so the table stays fully visible while editing.
  useEffect(() => {
    document.body.classList.toggle('b2c-editing', editMode)
    return () => document.body.classList.remove('b2c-editing')
  }, [editMode])

  return (
    <>
      <div className="b2c-toolbar">
        <label className={`edit-toggle ${editMode ? 'on' : ''}`}>
          <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
          <span className="tgl-track" />
          {COPY.edit.toggle}
        </label>
      </div>

      <div className="b2c-layout">
        <B2CControls state={state} setState={setState} />
        <div className="b2c-main">
          <B2CTable state={state} cols={cols} groups={groups} collapsed={collapsed} toggle={toggle} registry={schema.component_registry} />
        </div>
      </div>

      <div className="b2c-below">
        <p className="foot-note">{COPY.note}</p>
        <B2CInsights insights={insights} />
        <SourcesPanel filter="b2c" />
      </div>

      {editMode && (
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
