import { useEffect, useRef, useState } from 'react'

// Lightweight per-cell annotation (Pass 6). Hover a value cell to read its note;
// a subtle ochre corner marker flags cells that already carry one. Hovering an
// empty cell shows a faint "+" affordance; clicking either opens a small inline
// input — Enter or blur saves, Esc cancels, empty clears. The note text is owned
// by B2CView (schema.b2c_notes) via setNote; this component is purely the
// hover/edit affordance and never touches any figure. The marker is invisible
// when no note exists, so the default table is unchanged.
export default function CellNote({ cellKey, note, setNote, children }) {
  const [hovering, setHovering] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const committedRef = useRef(false)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const startEdit = () => {
    setDraft(note || '')
    committedRef.current = false
    setEditing(true)
  }

  // Save once (Enter, or blur after Enter, fire together — guard the double).
  const commit = () => {
    if (committedRef.current) return
    committedRef.current = true
    setNote(cellKey, draft)
    setEditing(false)
    setHovering(false)
  }

  const cancel = () => {
    committedRef.current = true
    setEditing(false)
    setHovering(false)
  }

  const showMarker = (hovering || !!note) && !editing

  return (
    <span
      className={`cell-note ${note ? 'has-note' : ''}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {children}

      {showMarker && (
        <button
          type="button"
          className={`note-marker ${note ? 'on' : ''}`}
          title={note ? 'Edit note' : 'Add note'}
          aria-label={note ? 'Edit note' : 'Add note'}
          onClick={startEdit}
        >
          {note ? '' : '+'}
        </button>
      )}

      {note && hovering && !editing && <span className="note-pop note-read">{note}</span>}

      {editing && (
        <span className="note-pop note-edit">
          <input
            ref={inputRef}
            className="note-input"
            type="text"
            value={draft}
            placeholder="Add note…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                cancel()
              }
            }}
            onBlur={commit}
          />
        </span>
      )}
    </span>
  )
}
