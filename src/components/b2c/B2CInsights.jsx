import { COPY } from './copy.js'

// READ-OUT: declarative statements computed from the current selection. Sits
// full-width below the table (outside the sticky-rail grid).
export default function B2CInsights({ insights }) {
  return (
    <section className="insights">
      <span className="insights-eyebrow">{COPY.insights.title}</span>
      <ul className="insight-list">
        {insights.map((t, i) => (
          <li key={i} className="insight">
            <span className="insight-mark" />
            {t}
          </li>
        ))}
      </ul>
    </section>
  )
}
