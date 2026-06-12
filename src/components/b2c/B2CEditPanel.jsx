import { useMemo, useState } from 'react'
import { COPY } from './copy.js'
import { buildEditModel } from './b2cEdit.js'

// One editable field: number (small), text (full width), or textarea (notes).
function Field({ field, onEdit }) {
  if (field.kind === 'textarea') {
    return (
      <label className="edit-textrow">
        <span className="edit-field-label">{field.label}</span>
        <textarea className="edit-text" rows={2} value={field.value} onChange={(e) => onEdit(field.path, e.target.value)} />
      </label>
    )
  }
  if (field.kind === 'number') {
    return (
      <label className="edit-textrow edit-numrow">
        <span className="edit-field-label">{field.label}</span>
        <input
          type="number"
          className="edit-text edit-num"
          value={field.value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onEdit(field.path, e.target.value === '' ? 0 : Number(e.target.value))}
        />
      </label>
    )
  }
  if (field.kind === 'percent') {
    // Stored as a fraction (0.15); shown and edited as a percentage (15).
    const pct = field.value == null ? '' : +(field.value * 100).toFixed(2)
    return (
      <label className="edit-textrow edit-numrow">
        <span className="edit-field-label">{field.label}</span>
        <span className="edit-pct">
          <input
            type="number"
            className="edit-text edit-num"
            value={pct}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onEdit(field.path, e.target.value === '' ? 0 : Number((Number(e.target.value) / 100).toFixed(4)))}
          />
          <span className="edit-pct-sign">%</span>
        </span>
      </label>
    )
  }
  return (
    <label className="edit-textrow">
      <span className="edit-field-label">{field.label}</span>
      <input type="text" className="edit-text" value={field.value} onChange={(e) => onEdit(field.path, e.target.value)} />
    </label>
  )
}

// One component-label row: editable display label + an inline show/hide toggle.
// Hiding only drops the row from the table — totals are computed in the engine,
// so the headline cost is unchanged (see hiddenNote in the panel).
function LabelRow({ item, onEdit }) {
  const shown = !item.hidden
  return (
    <div className={`edit-labelrow ${shown ? '' : 'is-hidden'}`}>
      <input
        type="text"
        className="edit-text edit-label-input"
        value={item.value}
        onChange={(e) => onEdit(item.path, e.target.value)}
      />
      <label
        className={`edit-vis ${shown ? 'on' : 'off'}`}
        title={shown ? COPY.edit.showTitle : COPY.edit.hiddenTitle}
      >
        <input type="checkbox" checked={shown} onChange={(e) => onEdit(item.hiddenPath, !e.target.checked)} />
        <span className="edit-vis-dot" />
        {shown ? COPY.edit.showLabel : COPY.edit.hiddenLabel}
      </label>
    </div>
  )
}

// One figures row: component/package label + its inline numeric inputs.
function FigureRow({ row, onEdit }) {
  return (
    <div className="edit-row">
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
  )
}

// Live editor: numbers (Phase 1) + text (Phase 2). Grouped per zone, collapsible;
// the table stays visible (side drawer) so every edit previews live.
export default function B2CEditPanel({ schema, onEdit, onDownload, onReset, onClose }) {
  const { componentLabels, zones } = useMemo(() => buildEditModel(schema), [schema])
  // Bundled zones (many packages) start collapsed; itemised zones + labels open.
  const [open, setOpen] = useState({ RAKEZ: false, Ajman: false })
  const isOpen = (key) => open[key] !== false
  const toggle = (key) => setOpen((o) => ({ ...o, [key]: o[key] === false }))

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
        {/* Global component labels (shared row labels) */}
        <section className="edit-zone">
          <button type="button" className="edit-zone-head" onClick={() => toggle('__labels')} aria-expanded={isOpen('__labels')}>
            <span className="edit-zone-name">{COPY.edit.labelsTitle}</span>
            <span className="edit-zone-meta">
              shared
              <span className="edit-chev">{isOpen('__labels') ? '−' : '+'}</span>
            </span>
          </button>
          {isOpen('__labels') && (
            <div className="edit-zone-body">
              <p className="edit-subnote">{COPY.edit.labelsHint}</p>
              {componentLabels.map((f) => (
                <LabelRow key={f.key} item={f} onEdit={onEdit} />
              ))}
              <p className="edit-subnote edit-hiddennote">{COPY.edit.hiddenNote}</p>
            </div>
          )}
        </section>

        {/* Per-zone: figures + activities + packages/offers */}
        {zones.map((section) => (
          <section className="edit-zone" key={section.zone}>
            <button type="button" className="edit-zone-head" onClick={() => toggle(section.zone)} aria-expanded={isOpen(section.zone)}>
              <span className="edit-zone-name">{section.zone}</span>
              <span className="edit-zone-meta">
                {section.model === 'bundled' ? 'bundled' : 'itemised'}
                <span className="edit-chev">{isOpen(section.zone) ? '−' : '+'}</span>
              </span>
            </button>

            {isOpen(section.zone) && (
              <div className="edit-zone-body">
                {section.rows.length > 0 && (
                  <>
                    <div className="edit-subhead">{COPY.edit.figuresHead}</div>
                    {section.rows.map((row) => (
                      <FigureRow key={row.key} row={row} onEdit={onEdit} />
                    ))}
                  </>
                )}

                {section.discount && section.discount.fields.length > 0 && (
                  <>
                    <div className="edit-subhead">{COPY.edit.discountHead}</div>
                    <p className="edit-subnote">{COPY.edit.discountHint(section.discount.appliesTo)}</p>
                    {section.discount.fields.map((f) => (
                      <Field key={f.path.join('.')} field={f} onEdit={onEdit} />
                    ))}
                  </>
                )}

                {section.activities.length > 0 && (
                  <>
                    <div className="edit-subhead">{COPY.edit.activitiesHead}</div>
                    {section.activities.map((f) => (
                      <Field key={f.path.join('.')} field={f} onEdit={onEdit} />
                    ))}
                  </>
                )}

                {section.packages.length > 0 && (
                  <>
                    <div className="edit-subhead">{COPY.edit.packagesHead}</div>
                    {section.packages.map((pkg) => (
                      <div className="edit-pkg" key={pkg.key}>
                        <div className="edit-pkg-name">
                          {pkg.label}
                          <small>{pkg.sub}</small>
                        </div>
                        {pkg.fields.map((f) => (
                          <Field key={f.path.join('.')} field={f} onEdit={onEdit} />
                        ))}
                      </div>
                    ))}
                  </>
                )}
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
