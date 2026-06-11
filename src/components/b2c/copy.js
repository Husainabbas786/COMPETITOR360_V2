// ---------------------------------------------------------------------------
// All B2C display copy in ONE place. Row labels come from the schema's
// component_registry (not here); this file holds section titles, control
// labels, legend strings and the cell-state words. Edit freely — nothing here
// is computed.
// ---------------------------------------------------------------------------
export const COPY = {
  controls: {
    visasLabel: 'Visas',
    visasHint: 'Residence visas in the package',
    medicalLabel: 'Medical',
    eidLabel: 'Emirates ID',
    countTrackHint: 'Tracks the visa count; nudge to override.',
    yearsLabel: 'Licence term',
    yearsUnit: (y) => (y === 1 ? '1 yr' : `${y} yrs`),
    statusLabel: 'Status change',
    statusSub: 'Applicant inside the UAE',
    statusHint: 'Adds the in-country status-change step to itemised zones (Meydan, IFZA). Bundled zones include it.',
  },

  table: {
    componentHeader: 'Cost component',
    baselineTag: 'baseline',
    year1Total: 'Year 1 — all-in',
    renewalSection: 'Renewal · Year 2',
    year2Label: 'Year 2 cost',
    grandTotal: (years) => (years === 1 ? 'Total · Year 1' : `Total · ${years} years`),
    vsBaseline: 'vs Meydan',
    collapseLabel: (zone) => `Collapse ${zone}`,
    expandLabel: (zone) => `Expand ${zone}`,
    naName: 'No package',
    naSub: (n) => `not available at ${n} visa${n === 1 ? '' : 's'}`,
  },

  // Insights — computed from the data, no LLM. Templates take pre-formatted
  // money strings (e.g. "AED 24,600"). Tone: formal, declarative, no hedging.
  insights: {
    title: 'Read-out',
    cheapestY1: (zone, money) => `${zone} is the lowest Year 1 outlay at ${money}.`,
    cheapest2y: (zone, money) => `Over two years, ${zone} is the lowest total at ${money}.`,
    dearest2y: (zone, money) => `Over two years, ${zone} is the highest total at ${money}.`,
    biggestDrop: (zone, from, to, delta) =>
      `${zone} shows the steepest Year 1 to Year 2 reduction — ${from} falling to ${to}, a ${delta} saving on renewal.`,
    meydanLeads: 'Meydan has the lowest two-year total in the field.',
    meydanRank: (ordinal, field) => `Meydan has the ${ordinal} two-year total of the ${field}.`,
    empty: 'Select at least one zone to generate the read-out.',
  },

  // Words used inside cells for the non-numeric states.
  cell: {
    included: 'Included',
    free: 'Free',
    dash: '—',
  },

  legend: {
    title: 'Reading the grid',
    items: [
      { kind: 'num', text: 'A fee you pay' },
      { kind: 'free', text: 'Covered by a free allowance' },
      { kind: 'incl', text: 'Bundled into the package price' },
      { kind: 'dash', text: 'Not applicable for this zone' },
    ],
    deltaCheaper: 'cheaper than Meydan',
    deltaPricier: 'dearer than Meydan',
  },

  edit: {
    toggle: 'Edit data',
    title: 'Edit data',
    hint: 'Edits preview live across the table and read-out. Download to make them permanent; nothing is saved to the browser.',
    download: 'Download updated schema',
    reset: 'Reset to saved',
    close: 'Close edit panel',
    renewalNote: '1yr = renewal',
  },

  saverBadge: 'limited',
  note:
    'Meydan is the baseline. Itemised zones (Meydan, IFZA) build from per-component fees; bundled zones (RAKEZ, Ajman) carry the all-in in the package price, so every component reads “Included”. Residence visas are valid ~2 years, so visa-side items are not re-charged in Year 2.',
}
