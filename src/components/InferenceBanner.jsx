import { useEffect, useState } from 'react'
import { ZONES } from '../data/master.js'

// Apply the editorial emphasis of the approved design to a plain statement:
// zone names render teal-bold (<b>), money/percent figures render in mono.
// Works on any string, so the AI narrative gets the same treatment.
const ZONE_RE = ZONES.map((z) => z.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
const TOKEN_RE = new RegExp(`(${ZONE_RE}|AED\\s?[0-9][0-9,]*|[0-9][0-9,]*%|[0-9][0-9,]{2,})`, 'g')

function renderEmphasis(text) {
  if (!text) return null
  return text.split(TOKEN_RE).map((p, i) => {
    if (!p) return null
    if (ZONES.includes(p)) return <b key={i}>{p}</b>
    if (/^(AED\s?)?[0-9]/.test(p) && /[0-9]/.test(p)) return <span className="num" key={i}>{p}</span>
    return <span key={i}>{p}</span>
  })
}

// Renders the live inference. Engine-agnostic: accepts
// `engine(view, state) => (string | {text, source}) | Promise<...>` and awaits
// it. Shows a loading state while fetching, the AI narrative when ready, and the
// local fallback (with a quiet note) when AI is unavailable.
export default function InferenceBanner({ engine, view, state, eyebrow, tag = 'AI analysis' }) {
  const [res, setRes] = useState({ text: '', source: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.resolve(engine(view, state))
      .then((r) => {
        if (!alive) return
        const norm = r && typeof r === 'object' ? r : { text: String(r || ''), source: null }
        setRes({ text: norm.text, source: norm.source })
        setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setRes({ text: 'Adjust the filters to see a live read on the numbers.', source: 'local' })
        setLoading(false)
      })
    return () => { alive = false }
  }, [engine, view, state])

  const label = res.source === 'local' ? 'Local read · AI offline' : tag

  return (
    <div className="banner" role="status" aria-live="polite">
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      <p className={`lead ${loading ? 'lead-loading' : ''}`}>
        {res.text ? renderEmphasis(res.text) : <span className="lead-skeleton">Analyzing the current scenario…</span>}
        <span className="prov">
          {loading
            ? <span className="prov-loading"><span className="prov-dot" /> Analyzing…</span>
            : `Live read · ${label}`}
        </span>
      </p>
    </div>
  )
}
