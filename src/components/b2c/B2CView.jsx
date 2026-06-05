import { useMemo } from 'react'
import { pricing } from '../../logic/engines.js'
import ComponentPanel from './ComponentPanel.jsx'
import PricingTable from './PricingTable.jsx'
import StickerChart from './StickerChart.jsx'
import SourcesPanel from '../SourcesPanel.jsx'

export default function B2CView({ state, setState }) {
  const results = useMemo(() => pricing.computeAll(state), [state])

  return (
    <>
      {/* Slim control rail (left) + wide chart/table (right), visible together */}
      <div className="b2c-layout">
        <ComponentPanel state={state} setState={setState} />

        <div className="b2c-main">
          <div className="section-head">
            <h2>{state.subview === 'chart' ? 'Sticker vs all-in' : 'The same basket, line by line'}</h2>
          </div>

          {state.subview === 'chart'
            ? <StickerChart state={state} results={results} />
            : <PricingTable state={state} results={results} />}

          <p className="foot-note">
            Sticker = the price each zone advertises (licence for unbundled zones; the full package for bundled
            RAKEZ &amp; Ajman). Hidden = all-in − sticker — the cost stacked on before you can operate. Visa-side
            items are Year-1 one-time costs; the residence visa is valid ~2 yrs, so it is not re-charged in Year-2.
          </p>
        </div>
      </div>

      <SourcesPanel filter="b2c" />
    </>
  )
}
