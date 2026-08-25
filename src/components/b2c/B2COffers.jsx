import { useState } from 'react'
import { COPY } from './copy.js'

// "Current Offers" band — the marketing view, above the grid.
//
// An offer is NOT a price. Nothing here feeds the cost engine; the grid below
// stays the costed truth. This band answers a different question — "what is
// everyone advertising right now" — which is why it sits above the table rather
// than in a footnote nobody scrolls to.
//
// Collapsed by default, because the measurement decided it: open, the band costs
// ~300px, which on a 13" laptop (1280x800) left ZERO price rows on screen — and
// even at 1920x1080 only two. The header bar is the discoverable part: "Current
// Offers (4)" keeps the count visible at all times, so nothing is hidden — the
// count is the hook, and one click gives the detail. The table is what the tool
// is for, so the table gets the vertical budget.
//
// It is deliberately a SIBLING of the control bar, not part of it: the control bar
// is sticky and its measured height drives the table's sticky-header offset, so
// anything added inside it would push the grid header out of position.
export default function B2COffers({ offers = [], zones = [] }) {
  const [open, setOpen] = useState(false)

  const live = offers.filter((o) => o && o.active)
  if (!live.length) return null

  // Both the count and the gap line are derived, never written down: a zone added
  // to the schema shows up as an untracked gap on its own, with no code edit.
  const covered = new Set(live.map((o) => o.zone))
  const untracked = zones.filter((z) => !covered.has(z))

  return (
    <section className={`offers ${open ? 'is-open' : 'is-closed'}`} aria-labelledby="offers-h">
      <button
        type="button"
        className="offers-head"
        id="offers-h"
        aria-expanded={open}
        aria-controls="offers-body"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="offers-chev" aria-hidden="true">▾</span>
        <span className="offers-title">
          {COPY.offers.title} <span className="offers-count">({live.length})</span>
        </span>
        <span className="offers-toggle">{open ? COPY.offers.hide : COPY.offers.show}</span>
      </button>

      {open && (
        <div className="offers-body" id="offers-body">
          <ul className="offers-cards">
            {live.map((o) => (
              <li className="offer-card" key={o.zone}>
                <span className="offer-zone">{o.zone}</span>
                <span className="offer-headline">{o.headline}</span>
                <span className="offer-detail">{o.detail}</span>
                {/* Image slot for a future ad / Instagram screenshot dropped in via
                    the submission channel. Nothing renders while image is null. */}
                {o.image && (
                  <span className="offer-shot">
                    <img src={o.image} alt={`${o.zone} — ${o.headline}`} loading="lazy" />
                  </span>
                )}
                <span className="offer-foot">
                  <b>{COPY.offers.confirmed(o.date)}</b>
                  {o.source ? ` · ${o.source}` : ''}
                </span>
              </li>
            ))}
          </ul>

          {untracked.length > 0 && (
            <p className="offers-gap">
              {COPY.offers.untracked} <span>{untracked.join(' · ')}</span>
            </p>
          )}
        </div>
      )}
    </section>
  )
}
