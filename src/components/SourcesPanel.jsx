import { SOURCES, GAPS } from '../data/master.js'
import { ConfidenceDot } from './Confidence.jsx'

// The approved design's shared footer: sources & freshness on the left,
// "before this goes to leadership — verify" (the gaps) on the right.
// All read from the JSON; `filter` narrows the sources to the active view.
export default function SourcesPanel({ filter, endline }) {
  const rows = filter ? SOURCES.filter((s) => s.area.toLowerCase().includes(filter)) : SOURCES

  return (
    <div className="foot">
      <div className="foot-grid">
        <div>
          <h4>Sources &amp; freshness</h4>
          {rows.map((s, i) => (
            <div className="src-item" key={i}>
              <ConfidenceDot confidence={s.confidence} note={s.note} />
              <div><b>{s.zone}</b> — {s.area}. <span className="meta">{s.source}{s.note ? ` · ${s.note}` : ''}</span></div>
            </div>
          ))}
        </div>
        <div>
          <h4>Before this goes to leadership — verify</h4>
          {GAPS.map((g, i) => (
            <div className="src-item" key={i}>
              <ConfidenceDot confidence={g.confidence} note={g.action} />
              <div><b>{g.item}</b> — {g.action}. <span className="meta">Owner: {g.owner}</span></div>
            </div>
          ))}
        </div>
      </div>
      {endline && <p className="endline">{endline}</p>}
    </div>
  )
}
