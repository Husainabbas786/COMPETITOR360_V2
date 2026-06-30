import { useState } from 'react'
import { b2cDefaultState } from './lib/b2cEngine.js'
import { ConfidenceTags } from './components/Confidence.jsx'
import B2CView from './components/b2c/B2CView.jsx'
import B2BView from './components/b2b/B2BView.jsx'

const TABS = [
  { id: 'b2c', n: '01', label: 'B2C – Pricing' },
  { id: 'b2b', n: '02', label: 'B2B – Commission' },
]

export default function App() {
  const [tab, setTab] = useState('b2c')
  // Each view keeps its own filter state so switching tabs preserves it.
  const [b2cState, setB2cState] = useState(b2cDefaultState)
  const [b2bState, setB2bState] = useState({ mode: 'onetime', level: 'low' })

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="kicker"><span className="dot" /> Competitor 360</div>
        <h1>Money Map</h1>
        <p className="masthead-tagline">Commercial Benchmark</p>
        <div className="meta-row">
          <ConfidenceTags />
        </div>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} role="tab"
            aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            <span className="n">{t.n}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === 'b2c'
        ? <section className="view"><B2CView state={b2cState} setState={setB2cState} /></section>
        : <section className="view"><B2BView state={b2bState} setState={setB2bState} /></section>}
    </div>
  )
}
