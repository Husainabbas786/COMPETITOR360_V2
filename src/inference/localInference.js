// ===========================================================================
// INFERENCE LAYER — isolated behind a single, stable interface:
//
//     inferenceEngine(view, state) -> string | Promise<string>
//
// Right now this is LOCAL rule-based logic. Later, the OpenAI-backed engine
// will implement the SAME signature (it will be async and fetch from a backend,
// fed the master + current filter state). Swapping it in means changing one
// line in App.jsx — no other UI changes. The banner already awaits the result,
// so a Promise-returning engine drops straight in.
// ===========================================================================
import { pricing, commission } from '../logic/engines.js'
import { DATA, aed } from '../data/master.js'

function cheapestDearest(totals) {
  const entries = Object.entries(totals)
  const sorted = [...entries].sort((a, b) => a[1].total - b[1].total)
  return { cheapest: sorted[0], dearest: sorted[sorted.length - 1] }
}

function b2cStatement(state) {
  const totals = pricing.computeAll(state)
  const { cheapest, dearest } = cheapestDearest(totals)
  const baseline = state.baseline
  const cur = DATA.meta.currency.replace(/\s*\(.*\)/, '') // "AED"

  const scope = pricing.isLicenceOnly(state) ? 'Licence-only' : 'This configuration'
  let s = `${scope}: ${cheapest[0]} is cheapest at ${cur} ${aed(cheapest[1].total)}; ` +
          `${dearest[0]} is the most expensive at ${cur} ${aed(dearest[1].total)}.`

  // Delta vs baseline for context.
  const base = totals[baseline]
  if (base) {
    const others = Object.entries(totals).filter(([z]) => z !== baseline)
    const cheaperThanBase = others.filter(([, v]) => v.total < base.total)
    if (cheaperThanBase.length) {
      const best = cheaperThanBase.sort((a, b) => a[1].total - b[1].total)[0]
      s += ` Versus ${baseline}, ${best[0]} undercuts by ${cur} ${aed(base.total - best[1].total)}.`
    } else {
      s += ` ${baseline} is currently the cheapest of all zones.`
    }
  }

  // Multi-year: surface the Year-1 vs Year-2 shift using the master's Year-2 data.
  if (state.duration >= 2) {
    const y2 = DATA.multi_year?.year_2 || {}
    const m = y2[baseline]
    const others = Object.entries(y2).filter(([z, c]) => z !== baseline && c && c.kind === 'num')
    if (m && m.kind === 'num' && others.length) {
      const dearerY2 = others.filter(([, c]) => c.numeric > m.numeric)
      if (dearerY2.length) {
        const names = dearerY2.map(([z]) => z).join(', ')
        s += ` Over ${state.duration} years the picture flips: in Year-2 ${baseline} (~${cur} ${aed(m.numeric)}) ` +
             `undercuts ${names} — the multi-year lever (visa not re-charged in Year-2).`
      } else {
        s += ` Note the Year-2 shift: ${baseline} renews at ~${cur} ${aed(m.numeric)}.`
      }
    }
  }
  return s
}

function b2bStatement(state) {
  const mode = state.mode || 'onetime'
  const all = commission.computeAll(mode)
  const ranked = commission.ranked(mode)
  const topRate = commission.topRate(mode)
  const cur = DATA.meta.currency.replace(/\s*\(.*\)/, '')
  const modeLabel = mode === 'onetime' ? 'one-time' : 'recurring'

  const withRate = ranked.filter((r) => r.takeHome != null)
  if (!withRate.length) return `No ${modeLabel} commission data available yet for these zones.`

  const topTake = withRate[0]
  let s = ''
  if (topRate && topRate.zone !== topTake.zone) {
    s = `${topRate.zone} posts the highest ${modeLabel} rate (${Math.round(topRate.rate * 100)}%), ` +
        `but in real dirhams ${topTake.zone} takes home the most: ${cur} ${aed(topTake.takeHome)}.`
  } else {
    s = `${topTake.zone} leads on ${modeLabel} take-home: ${cur} ${aed(topTake.takeHome)} ` +
        `(${Math.round(topTake.rate * 100)}% of ${cur} ${aed(topTake.base.numeric)}).`
  }

  // The headline insight: lower rate on a bigger base can beat a higher rate.
  const meydan = all['Meydan']
  const upset = withRate.find((r) =>
    meydan && meydan.takeHome != null && r.zone !== 'Meydan' &&
    r.rate > meydan.rate && r.takeHome < meydan.takeHome)
  if (upset) {
    s += ` A lower rate on a bigger base wins — Meydan's ${Math.round(meydan.rate * 100)}% ` +
         `(${cur} ${aed(meydan.takeHome)}) beats ${upset.zone}'s ${Math.round(upset.rate * 100)}% ` +
         `(${cur} ${aed(upset.takeHome)}).`
  }
  return s
}

// The single interface. view: 'b2c' | 'b2b'.
export function localInference(view, state) {
  try {
    return view === 'b2b' ? b2bStatement(state) : b2cStatement(state)
  } catch (e) {
    return 'Adjust the filters to see a live read on the numbers.'
  }
}
