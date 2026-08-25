import { useEffect, useRef, useState } from 'react'
import { changeLabel, formatChangeDate } from '../../lib/b2cChanges.js'

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

// "Last updated" mark on a CHANGED value cell. Deliberately NOT the promo ⓘ:
//   • the promo ⓘ is a labelled ochre/rust chip in the COLUMN HEADER and explains
//     the advertised bundle price;
//   • this one is a small indigo dot in a BODY CELL and says when that one figure
//     moved and what it was before.
// Different place, different colour, different component — they can never be
// mistaken for one another. Hover reads it; click pins it open (touch has no
// hover), closing on click-outside, Esc, or a second click.
export default function ChangeInfo({ change }) {
  const [pinned, setPinned] = useState(false)
  const [hovering, setHovering] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!pinned) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setPinned(false) }
    const onKey = (e) => { if (e.key === 'Escape') setPinned(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [pinned])

  if (!change) return null
  const open = pinned || hovering
  const hasPrior = typeof change.from === 'number'

  return (
    <span className="chg-info" ref={ref}>
      <button
        type="button"
        className={`chg-i ${pinned ? 'on' : ''}`}
        aria-label={changeLabel(change)}
        title={changeLabel(change)}
        aria-expanded={open}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
        onClick={(e) => {
          e.stopPropagation()
          setPinned((p) => !p)
        }}
      >
        i
      </button>
      {open && (
        <span className="chg-pop" role="tooltip">
          <span className="chg-pop-head">{hasPrior ? 'Updated' : 'Added'} {formatChangeDate(change.on)}</span>
          {hasPrior && (
            <span className="chg-pop-was">
              was <b>{fmt.format(change.from)}</b>
            </span>
          )}
        </span>
      )}
    </span>
  )
}
