import { useMemo, useState } from 'react'
import { COPY } from './copy.js'
import { buildEditModel } from './b2cEdit.js'

// Live numeric editor. Reads the current schema state, emits immutable edits via
// onEdit(path, value). Grouped per zone, collapsible; the table stays visible
// (this is a side drawer) so every edit previews live.
export default function B2CEditPanel({ schema, onEdit, onDownload, onReset, onClose }) {
  const model = useMemo(() => buildEditModel(schema), [schema])
  // Bundled zones (many packages) start collapsed; itemised zones start open.
  const [open, setOpen] = useState({ RAKEZ: false, Ajman: false })
  const isOpen = (zone) => open[zone] !== false
  const toggleZone = (zone) => setOpen((o) => ({ ...o, [zone]: o[zone] === false }))

  return (
    <aside className="edit-drawer" aria-label={COPY.edit.title}>
      <div className="edit-head">
        <h3>{COPY.edit.title}</h3>
        <button type="button" className="edit-close" onClick={onClose} aria-label={COPY.edit.close} title={COPY.edit.close}>
          ×
        </button>
      </div>
      <p className="edit-hint">{COPY.edit.hint}</p>

      <div className="edit-body">
        {model.map((section) => (
          <section className="edit-zone" key={section.zone}>
            <button type="button" className="edit-zone-head" onClick={() => toggleZone(section.zone)} aria-expanded={isOpen(section.zone)}>
              <span className="edit-zone-name">{section.zone}</span>
              <span className="edit-zone-meta">
                {section.model === 'bundled' ? 'bundled' : 'itemised'}
                <span className="edit-chev">{isOpen(section.zone) ? '−' : '+'}</span>
              </span>
            </button>

            {isOpen(section.zone) && (
              <div className="edit-zone-body">
                {section.rows.map((row) => (
                  <div className="edit-row" key={row.key}>
                    <span className="edit-row-label">
                      {row.label}
                      {row.sub && <small>{row.sub}</small>}
                    </span>
                    <div className="edit-inputs">
                      {row.inputs.map((inp) => (
                        <label className="edit-field" key={inp.label}>
                          <span className="edit-field-label">{inp.label}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={inp.value}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => onEdit(inp.path, e.target.value === '' ? 0 : Number(e.target.value))}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="edit-foot">
        <button type="button" className="edit-reset" onClick={onReset}>
          {COPY.edit.reset}
        </button>
        <button type="button" className="edit-download" onClick={onDownload}>
          {COPY.edit.download}
        </button>
      </div>
    </aside>
  )
}
