import { LEGEND, confidenceLabel, confidenceMeaning } from '../data/master.js'

// Map the JSON's confidence keys onto the approved design's dot classes.
const CI = { confirmed: 'ok', assumed: 'warn', missing: 'grey', na: null }

// Small coloured dot (HTML .ci) with a native tooltip carrying confidence + source note.
export function ConfidenceDot({ confidence, note }) {
  const cls = CI[confidence]
  if (!cls) return null
  const title = `${confidenceLabel(confidence)} — ${confidenceMeaning(confidence)}${note ? `\n${note}` : ''}`
  return <span className={`ci ${cls}`} title={title} aria-label={title} />
}

// Confidence legend rendered as the masthead pill tags, read straight from the JSON.
export function ConfidenceTags() {
  return (
    <>
      {Object.keys(LEGEND).filter((k) => CI[k]).map((k) => (
        <span className="tag" key={k} title={confidenceMeaning(k)}>
          <span className={`d ${CI[k]}`} /> {LEGEND[k].label.replace(/^[^\sA-Za-z]+\s*/, '')}
        </span>
      ))}
    </>
  )
}
