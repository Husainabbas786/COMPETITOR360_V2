import { useEffect, useRef, useState } from 'react'
import { CURRENCY } from '../../lib/b2cEngine.js'

const CUR = CURRENCY.replace(/\s*\(.*\)/, '') // "AED"
const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const SHORT = { DSBH: 'Dubai South' } // short display name for the promo header

// Click-to-open ⓘ on a promo (LIMITED) column header — the PRIMARY, visible/tappable
// way to read what the advertised bundle actually is (the hover tooltip stays as a
// fallback). Reads only the zone's promo object; the advertised bundle prices live
// here (and in the tooltip), never as a grid figure. Opens on click/tap; closes on
// click-outside, Esc, or the ✕. Positioned to grow leftward so it never clips at the
// right edge (a promo column is typically the rightmost zone).
export default function PromoInfo({ promo, zone, allIn, visas }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const rows = (promo?.packages || []).filter((p) => p.visas >= 1)
  const name = SHORT[zone] || zone

  return (
    <span className="promo-info" ref={ref}>
      <button
        type="button"
        className="promo-i"
        aria-label="About this limited-time offer — advertised price"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        <span className="promo-i-ico">i</span>
        advertised price
      </button>
      {open && (
        <span className="promo-pop" role="dialog">
          <button type="button" className="promo-pop-x" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
          <span className="promo-pop-head">Limited-time offer — advertised vs. real cost</span>
          <span className="promo-pop-line">{name} advertises this as a bundled setup package:</span>
          <ul className="promo-pop-rows">
            {rows.map((p) => (
              <li key={p.package_id}>
                {p.visas} visa: {fmt.format(p.price_was)} → <b>{fmt.format(p.price_now)}</b>
              </li>
            ))}
          </ul>
          <span className="promo-pop-line">
            But the advertised price stops at company setup — it excludes the residence-visa issuance,
            medical/EID and status change that a working company still pays.
          </span>
          {typeof allIn === 'number' && (
            <span className="promo-pop-real">
              This column shows the true discounted all-in — {CUR} {fmt.format(Math.round(allIn))} for a working{' '}
              {visas}-visa company.
            </span>
          )}
        </span>
      )}
    </span>
  )
}
