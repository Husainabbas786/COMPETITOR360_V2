import { useMemo, useState } from 'react'
import B2CControls from './B2CControls.jsx'
import B2CTable from './B2CTable.jsx'
import B2CInsights from './B2CInsights.jsx'
import SourcesPanel from '../SourcesPanel.jsx'
import { COPY } from './copy.js'
import { buildColumns, buildGroups, buildInsights } from './b2cModel.js'

// Rebuilt B2C view. The two-column grid holds ONLY the control rail and the
// table, so the sticky rail releases exactly at the table's end. Everything else
// (foot-note, read-out, sources & verify) sits full-width below the grid.
export default function B2CView({ state, setState }) {
  const cols = useMemo(() => buildColumns(state), [state])
  const groups = useMemo(() => buildGroups(cols), [cols])
  const [collapsed, setCollapsed] = useState({})
  const toggle = (zone) => setCollapsed((c) => ({ ...c, [zone]: !c[zone] }))
  const insights = buildInsights(groups, collapsed)

  return (
    <>
      <div className="b2c-layout">
        <B2CControls state={state} setState={setState} />
        <div className="b2c-main">
          <B2CTable state={state} cols={cols} groups={groups} collapsed={collapsed} toggle={toggle} />
        </div>
      </div>

      <div className="b2c-below">
        <p className="foot-note">{COPY.note}</p>
        <B2CInsights insights={insights} />
        <SourcesPanel filter="b2c" />
      </div>
    </>
  )
}
