// ---------------------------------------------------------------------------
// B2C cost engine — pure, data-injected via createB2CCompute(schema).
//
// Single source of truth: src/data/master-schema.json (consolidated schema v2).
// NO prices are hardcoded here — every figure is read from the schema. Only
// STRUCTURAL rules live in code (which component recurs yearly vs. on the visa
// cycle, how multi-year discounts apply, bundled vs. itemised dispatch). Those
// rules are transcribed from each zone's compute_note / multi_year block.
//
// Zone models:
//   • itemised / itemised_tiered (Meydan, IFZA) — total builds from per-component
//     fees off the fixed component_registry.
//   • bundled (RAKEZ, Ajman) — the package tier price IS the all-in for that visa
//     count; every visa component renders "Included".
//
// Years: 'y1' (new) and 'y2' (renewal / Year-2) fees are distinct in the schema.
// A residence visa is valid ~2 yrs, so visa-side items are charged on a 2-year
// cycle (ceil(years/2) times), never re-charged in the off year.
// ---------------------------------------------------------------------------

export function createB2CCompute(schema) {
  const zonesArr = schema.zones
  const registry = schema.component_registry

  const getZone = (name) => zonesArr.find((z) => z.zone === name)

  const getPackage = (zone, { packageId, visas } = {}) => {
    const pkgs = zone.packages || []
    if (packageId) return pkgs.find((p) => p.package_id === packageId)
    if (visas != null) {
      return pkgs.find((p) => p.visas === visas) || pkgs.find((p) => p.max_visas === visas)
    }
    return pkgs[0]
  }

  // Fee for a component in a given year. Returns 0 when the year-block, the fee,
  // or the component itself is absent (one-time / visa-cycle items have no y2).
  const feeOf = (comp, year) => {
    const f = comp && comp[year] && comp[year].fee
    return typeof f === 'number' ? f : 0
  }

  // IFZA licence is tiered by visa count; the tier step IS the baked-in visa
  // allocation (+2,000/visa). y2 is held at the y1 price ("held for 4 yrs").
  // For a visa count outside the published table, extrapolate from the table's
  // own base + step so nothing is hardcoded.
  const ifzaLicence = (comp, V) => {
    const tbl = comp && comp.y1_by_visa
    if (!tbl) return 0
    if (tbl[String(V)] != null) return tbl[String(V)]
    const keys = Object.keys(tbl).map(Number).sort((a, b) => a - b)
    const base = tbl[String(keys[0])]
    const step = tbl[String(keys[1])] - tbl[String(keys[0])]
    return base + step * V
  }

  // free_allowance can be redeclared on the y2 block (e.g. IFZA 1st-free persists).
  const freeAllowance = (comp, year) => {
    if (year === 'y2' && comp.y2 && comp.y2.free_allowance != null) return comp.y2.free_allowance
    return comp.free_allowance != null ? comp.free_allowance : 0
  }

  // ---- ITEMISED: charge one component for visa count V in a given year -------
  // Returns { amount, ...meta } where meta drives the eventual cell rendering
  // (included / dash / qty / unit). `excluded` items (health insurance) are kept
  // as a noted line but left OUT of the core all-in total.
  function chargeComponent(comp, V, year, opts, count = V) {
    if (!comp) return { amount: 0, dash: true }
    if (comp.noted_separate) return { amount: 0, excluded: true, noted: true }

    switch (comp.kind) {
      case 'na':
        return { amount: 0, dash: true }

      case 'baked_in_licence':
        // Applicable, but its cost is already inside the licence tier — show as
        // "Included", never a charge (don't double-count).
        return { amount: 0, included: true }

      case 'flat': {
        const fee = feeOf(comp, year)
        return { amount: fee, qty: 1, unit: fee, included: comp.included === true }
      }

      case 'tiered_by_visa': {
        const fee = ifzaLicence(comp, V) // y2 held at y1
        return { amount: fee, qty: 1, unit: fee }
      }

      case 'per_company_if_visa': {
        if (V < 1) return { amount: 0, dash: true }
        const fee = feeOf(comp, year)
        return { amount: fee, qty: 1, unit: fee }
      }

      case 'per_visa': {
        // `count` is the chargeable quantity — defaults to the visa count, but
        // medical / Emirates ID carry their own independent steppers.
        const fee = feeOf(comp, year)
        const fa = freeAllowance(comp, year)
        const chargeable = Math.max(0, count - fa)
        if (fee === 0) return { amount: 0, qty: chargeable, unit: 0, included: true }
        if (count < 1) return { amount: 0, dash: true }
        // free_allowance fully covers the selected count → "Free" (e.g. IFZA 1st).
        if (chargeable === 0 && fa > 0) return { amount: 0, qty: 0, unit: fee, free: true }
        return { amount: chargeable * fee, qty: chargeable, unit: fee }
      }

      case 'situational': {
        // Status change: default ON, counted once, only meaningful when a visa
        // is actually issued (it is an inside-UAE applicant step).
        if (!opts.statusChange || V < 1) return { amount: 0, dash: true }
        const fee = feeOf(comp, year)
        return { amount: fee, qty: 1, unit: fee }
      }

      default:
        return { amount: feeOf(comp, year), qty: 1 }
    }
  }

  // Single-year itemised total (year = 'y1' | 'y2'). Iterates the FIXED registry
  // so every component row is present (dash where not applicable).
  function itemisedYear(zone, V, year, opts) {
    const comps = zone.components
    const counts = opts.counts || {}
    const lines = []
    let total = 0
    for (const reg of registry) {
      // Per-component quantity: medical / Emirates ID can diverge from V.
      const count = counts[reg.key] != null ? counts[reg.key] : V
      const r = chargeComponent(comps[reg.key], V, year, opts, count)
      if (!r.excluded) total += r.amount
      lines.push({ key: reg.key, label: reg.label, ...r })
    }
    return { zone: zone.zone, model: 'itemised', year, V, total, lines }
  }

  // ---- ITEMISED multi-year ---------------------------------------------------
  // Meydan: (licence + visa_allocation·V)·years·0.85  (15% discount group)
  //       + (establishment_card[V≥1] + shared_desk)·years        (full, yearly)
  //       + (residence + medical + EID, per visa)·ceil(years/2)   (visa cycle)
  //       + status_change once.
  // For years = 1 the discount factor is 1, so it reduces exactly to Year-1.
  function meydanMultiYear(zone, V, years, opts) {
    const c = zone.components
    const my = zone.multi_year
    const factor = years >= 2 ? 1 - my.discount_pct : 1
    const cycles = Math.ceil(years / 2)

    // 15% discount group: licence recurs every year; visa allocation is
    // validity-2 (renews on the 2-year visa cycle, not annually).
    const licence = feeOf(c.licence, 'y1') * years * factor
    const alloc =
      feeOf(c.visa_allocation, 'y1') *
      Math.max(0, V - freeAllowance(c.visa_allocation, 'y1')) *
      cycles *
      factor
    const discounted = licence + alloc

    // Establishment card is validity-2 (like the visa/allocation): charged on the
    // 2-year cycle, never re-charged in the off year. Desk recurs every year.
    const card = V >= 1 ? feeOf(c.establishment_card, 'y1') * cycles : 0
    const desk = feeOf(c.shared_desk, 'y1') * years
    const yearly = card + desk

    const mCount = opts.counts?.medical ?? V
    const eCount = opts.counts?.emirates_id ?? V
    const residence =
      feeOf(c.residence_visa_fee, 'y1') * Math.max(0, V - freeAllowance(c.residence_visa_fee, 'y1'))
    const visaCycle =
      (residence + feeOf(c.medical, 'y1') * mCount + feeOf(c.emirates_id, 'y1') * eCount) * cycles

    const status = opts.statusChange && V >= 1 ? feeOf(c.status_change, 'y1') : 0

    return {
      total: discounted + yearly + visaCycle + status,
      parts: { discounted, yearly, visaCycle, status },
    }
  }

  // IFZA discount for a committed term, read from multi_year.discounts ("2y" etc).
  // Falls back to the largest published term ≤ years (no 4y tier exists).
  function ifzaDiscount(my, years) {
    if (years < 2 || !my || !my.discounts) return 0
    if (my.discounts[years + 'y'] != null) return my.discounts[years + 'y']
    const terms = Object.keys(my.discounts)
      .map((k) => parseInt(k, 10))
      .sort((a, b) => a - b)
    let d = 0
    for (const t of terms) if (years >= t) d = my.discounts[t + 'y']
    return d
  }

  // IFZA: licence·years·(1 − termDiscount); visa free-for-life (1st free persists);
  // establishment card renewed every year (y1 then y2 renewal); residence/investor/
  // medical/EID on the 2-year visa cycle; status once. years = 1 reduces to Year-1.
  function ifzaMultiYear(zone, V, years, opts) {
    const c = zone.components
    const cycles = Math.ceil(years / 2)
    const disc = ifzaDiscount(zone.multi_year, years)

    const licence = ifzaLicence(c.licence, V) * years * (1 - disc)

    const card =
      V >= 1 ? feeOf(c.establishment_card, 'y1') + feeOf(c.establishment_card, 'y2') * (years - 1) : 0

    const mCount = opts.counts?.medical ?? V
    const eCount = opts.counts?.emirates_id ?? V
    const residence =
      feeOf(c.residence_visa_fee, 'y1') * Math.max(0, V - freeAllowance(c.residence_visa_fee, 'y1'))
    const visaCycle =
      (residence +
        feeOf(c.investor_addon, 'y1') * V +
        feeOf(c.medical, 'y1') * mCount +
        feeOf(c.emirates_id, 'y1') * eCount) *
      cycles

    const status = opts.statusChange && V >= 1 ? feeOf(c.status_change, 'y1') : 0

    return { total: licence + card + visaCycle + status, parts: { licence, card, visaCycle, status } }
  }

  // SPC / SHAMS (Sharjah itemised). Their committed-term STRUCTURE differs from both
  // Meydan and IFZA, so they need their own builder: licence / shared_desk / e_channel
  // / visa_allocation are ANNUAL (charged every year — y1, then y2 renewal), while
  // establishment_card / residence / medical / emirates_id are VALIDITY-2 (charged
  // once per 2-year cycle), and status_change is one-time. The multi-year discount
  // applies to the licence only: "incremental" = per_year_pct x (years-1); "none" = 0.
  function sharjahMultiYear(zone, V, years, opts) {
    const c = zone.components
    const my = zone.multi_year || {}
    const cycles = Math.ceil(years / 2)
    const disc = my.type === 'incremental' ? (my.per_year_pct || 0) * (years - 1) : 0

    // annual item over the term: y1 for the first year, y2 (renewal) for the rest.
    const annual = (comp) => feeOf(comp, 'y1') + feeOf(comp, 'y2') * (years - 1)
    // validity-2 item: y1 rate, once per 2-year cycle.
    const cyclic = (comp) => feeOf(comp, 'y1') * cycles
    // Recharge cadence read from the data: a y2 fee > 0 means the item renews EVERY
    // year (annual); y2 = 0 means it's validity-2 (once per 2-yr cycle). This is why
    // the establishment card differs — DSBH recharges it yearly (y2 2,200), SPC/SHAMS
    // don't (y2 0) — while residence/medical/EID are validity-2 (y2 0) for all three.
    const byCadence = (comp) => (feeOf(comp, 'y2') > 0 ? annual(comp) : cyclic(comp))

    const licence = annual(c.licence) * (1 - disc)
    const desk = annual(c.shared_desk)
    const echannel = V >= 1 ? annual(c.e_channel) : 0
    const alloc = annual(c.visa_allocation) * Math.max(0, V - freeAllowance(c.visa_allocation, 'y1'))

    const card = V >= 1 ? byCadence(c.establishment_card) : 0
    const mCount = opts.counts?.medical ?? V
    const eCount = opts.counts?.emirates_id ?? V
    const residence = cyclic(c.residence_visa_fee) * Math.max(0, V - freeAllowance(c.residence_visa_fee, 'y1'))
    const visaCyclic = residence + cyclic(c.medical) * mCount + cyclic(c.emirates_id) * eCount

    const status = opts.statusChange && V >= 1 ? feeOf(c.status_change, 'y1') : 0

    return {
      total: licence + desk + echannel + alloc + card + visaCyclic + status,
      parts: { licence, annualExtras: desk + echannel + alloc, card, visaCyclic, status },
    }
  }

  // Route the committed-term (2/3/5yr) builder by multi_year.type so each zone uses
  // its own structure. Meydan (flat_discount) and IFZA (tiered_discount) keep their
  // existing functions byte-for-byte; only the Sharjah zones get the new path.
  function itemisedMultiYear(zone, V, years, opts) {
    if (years <= 1) return { total: itemisedYear(zone, V, 'y1', opts).total }
    const type = zone.multi_year?.type
    if (type === 'tiered_discount') return ifzaMultiYear(zone, V, years, opts)
    if (type === 'incremental' || type === 'none') return sharjahMultiYear(zone, V, years, opts)
    return meydanMultiYear(zone, V, years, opts) // flat_discount (Meydan) + default
  }

  // ---- BUNDLED ---------------------------------------------------------------
  // Every component row renders "Included"; licence row carries the all-in price.
  function bundledLines(zone, year1Price) {
    return registry.map((reg) => {
      if (reg.key === 'licence') return { key: 'licence', label: reg.label, amount: year1Price, allIn: true }
      if (reg.key === 'health_insurance') return { key: reg.key, label: reg.label, amount: 0, noted: true, dash: true }
      return { key: reg.key, label: reg.label, amount: 0, included: true }
    })
  }

  // RAKEZ: explicit per-term table. Committed term price = tier_price[`${years}y`].
  // Annual renewal = same as 1yr, so pay-as-you-go = tier_price.1y × years.
  function rakezCost(zone, pkg, years) {
    const tp = pkg.tier_price || {}
    const annual = tp['1y']
    const termPrice = tp[years + 'y'] != null ? tp[years + 'y'] : null
    const annualRenewalSum = annual != null ? annual * years : null
    const total = termPrice != null ? termPrice : annualRenewalSum
    return {
      zone: zone.zone,
      model: 'bundled',
      package: pkg.package_id,
      visas: pkg.visas,
      years,
      total,
      year1: annual,
      year2: annual, // renewal = same as 1yr (annual)
      termPrice,
      annualRenewalSum,
      lines: bundledLines(zone, annual),
    }
  }

  // Ajman: annual model. Year 1 = tier_price_new, every renewal = tier_price_renewal.
  // Multi-year = new + renewal·(years − 1). No multi-year discount.
  function ajmanCost(zone, pkg, years) {
    const newP = pkg.tier_price_new
    const renew = pkg.tier_price_renewal
    return {
      zone: zone.zone,
      model: 'bundled',
      package: pkg.package_id,
      visas: pkg.visas,
      years,
      total: newP + renew * (years - 1),
      year1: newP,
      year2: renew, // Year-2+ uses the (lower) renewal price
      renewal: renew,
      lines: bundledLines(zone, newP),
    }
  }

  // ---- Public dispatcher -----------------------------------------------------
  // computeCost({ zone, visas, years, packageId, statusChange })
  //   itemised zones → driven by visa count V
  //   bundled zones  → driven by package (packageId, or matched on visas)
  function computeCost({
    zone,
    packageId,
    visas,
    years = 1,
    statusChange = true,
    medicalCount,
    eidCount,
  } = {}) {
    const z = getZone(zone)
    if (!z) throw new Error(`Unknown zone: ${zone}`)
    const yrs = Math.max(1, years | 0 || 1)

    if (z.model === 'bundled') {
      // Bundled zones include medical & EID in the package price — counts don't
      // apply here.
      const pkg = getPackage(z, { packageId, visas })
      if (!pkg) throw new Error(`No ${zone} package for ${packageId || 'visas=' + visas}`)
      return z.zone === 'RAKEZ' ? rakezCost(z, pkg, yrs) : ajmanCost(z, pkg, yrs)
    }

    // itemised / itemised_tiered
    const V = visas != null ? visas : 0
    // Medical / Emirates ID default to the visa count when not supplied, so
    // unspecified calls (and every sanity check) behave exactly as before.
    const counts = {
      medical: medicalCount != null ? medicalCount : V,
      emirates_id: eidCount != null ? eidCount : V,
    }
    const opts = { statusChange, counts }
    const y1 = itemisedYear(z, V, 'y1', opts)
    const y2 = itemisedYear(z, V, 'y2', opts)
    const multi = itemisedMultiYear(z, V, yrs, opts)
    return {
      zone: z.zone,
      model: 'itemised',
      visas: V,
      medicalCount: counts.medical,
      eidCount: counts.emirates_id,
      years: yrs,
      total: yrs === 1 ? y1.total : multi.total,
      year1: y1.total,
      year2: y2.total,
      multiYear: multi.total,
      lines: y1.lines,
    }
  }

  // ---- Sanity check ----------------------------------------------------------
  // Verifies the engine against the known totals before any UI is built.
  // Every expected number is asserted against schema-derived output (no figure
  // is re-typed from the schema into the assertion side beyond the targets the
  // stakeholders confirmed).
  function sanityCheck(logger = console) {
    const cases = []
    const check = (label, got, want) => {
      const ok = got != null && Math.round(got) === Math.round(want)
      cases.push({ label, got, want, ok })
      logger.log(`${ok ? '✓' : '✗'} ${label}: got ${got == null ? '—' : Math.round(got)} want ${want}`)
    }

    const meydan1 = computeCost({ zone: 'Meydan', visas: 1, years: 1 })
    const meydan1y2 = computeCost({ zone: 'Meydan', visas: 1, years: 2 })
    const meydan0 = computeCost({ zone: 'Meydan', visas: 0, years: 1 })
    const ifza1 = computeCost({ zone: 'IFZA', visas: 1, years: 1 })
    const rakez1y = computeCost({ zone: 'RAKEZ', packageId: 'rakez_biz1', years: 1 })
    const rakez2y = computeCost({ zone: 'RAKEZ', packageId: 'rakez_biz1', years: 2 })
    const ajman1y = computeCost({ zone: 'Ajman', packageId: 'ajman_1v', years: 1 })
    const ajman2y = computeCost({ zone: 'Ajman', packageId: 'ajman_1v', years: 2 })

    logger.log('— Meydan (itemised) —')
    check('Meydan 1 visa Y1 (status ON)', meydan1.year1, 24600)
    check('Meydan 1 visa Y2 (card 2,200 + alloc 1,850, annual; visa/med/EID validity-2)', meydan1.year2, 16550)
    check('Meydan 1 visa 2-year annual sum (Y1 + Y2)', meydan1.year1 + meydan1.year2, 41150)
    check('Meydan 0 visa Y1', meydan0.year1, 12500)
    check('Meydan 0 visa Y2 (no card/alloc — visa-gated, unchanged)', meydan0.year2, 12500)
    check('Meydan 1 visa 1-year multi-year (= Y1)', meydan1.multiYear, 24600)
    check('Meydan 1 visa 2-year committed multi-year (15% licence+alloc discount)', meydan1y2.multiYear, 33185)

    logger.log('— IFZA (itemised, medical 700 / EID 400 assumed) —')
    check('IFZA 1 visa Y1 (status ON)', ifza1.year1, 20600)

    logger.log('— SPC / SHAMS (itemised Sharjah zones, additive) —')
    const spc0 = computeCost({ zone: 'SPC', visas: 0, years: 1 })
    const spc1 = computeCost({ zone: 'SPC', visas: 1, years: 1 })
    const shams0 = computeCost({ zone: 'SHAMS', visas: 0, years: 1 })
    const shams1 = computeCost({ zone: 'SHAMS', visas: 1, years: 1 })
    check('SPC 0 visa Y1 (licence 6,500 + desk 375)', spc0.year1, 6875)
    check('SPC 0 visa Y2 (unchanged — visa-gated items off)', spc0.year2, 6875)
    check('SPC 1 visa Y1 (all-in, status ON)', spc1.year1, 14990)
    check('SPC 1 visa Y2 (card/e-channel renewal recur; visa/med/EID/CoS validity-2)', spc1.year2, 10315)
    check('SPC 1 visa 2-year annual sum (Y1 + Y2)', spc1.year1 + spc1.year2, 25305)
    check('SHAMS 0 visa Y1', shams0.year1, 6875)
    check('SHAMS 1 visa Y1 (medical 375 vs SPC 365)', shams1.year1, 15000)
    check('SHAMS 1 visa Y2', shams1.year2, 10315)
    check('SHAMS 1 visa 2-year annual sum (Y1 + Y2)', shams1.year1 + shams1.year2, 25315)
    // Committed-term (Sharjah structure): licence/desk/e-channel/allocation annual,
    // card/residence/medical/EID validity-2, status once. SPC 1%-incremental licence
    // discount; SHAMS no discount (= straight annual buildout).
    const spc2y = computeCost({ zone: 'SPC', visas: 1, years: 2 })
    const spc3y = computeCost({ zone: 'SPC', visas: 1, years: 3 })
    const shams2y = computeCost({ zone: 'SHAMS', visas: 1, years: 2 })
    check('SPC 1 visa 2yr committed (1% licence discount)', spc2y.total, 25175)
    check('SPC 1 visa 3yr committed (2% licence discount)', spc3y.total, 38765)
    check('SHAMS 1 visa 2yr committed (no discount published)', shams2y.total, 25315)

    logger.log('— DSBH (itemised Dubai zone; promo is flagged secondary, never the all-in) —')
    const dsbh0 = computeCost({ zone: 'DSBH', visas: 0, years: 1 })
    const dsbh1 = computeCost({ zone: 'DSBH', visas: 1, years: 1 })
    check('DSBH 0 visa base (licence 12,125 + flexi 375)', dsbh0.year1, 12500)
    check('DSBH 1 visa all-in inside UAE (EID bundled in medical → Included)', dsbh1.year1, 24118)
    check('DSBH 1 visa Y2 (card 2,200 + alloc 1,850 annual; visa/med/EID validity-2)', dsbh1.year2, 16550)
    // DSBH LIMITED overlay column = standard all-in − the ONE-TIME promo bundle saving
    // (price_was − price_now). Renders in the grid as a second column; the engine's
    // Year-1 figure is what the view model discounts, so we verify the arithmetic here.
    const dsbhZone = zonesArr.find((z) => z.zone === 'DSBH')
    const promoPkgs = dsbhZone?.promo?.packages || []
    const savingOf = (v) => { const p = promoPkgs.find((x) => x.visas === v); return p ? p.price_was - p.price_now : 0 }
    const stdAllIn = (v) => Math.round(computeCost({ zone: 'DSBH', visas: v, years: 1 }).year1)
    check('DSBH LIMITED 0 visa all-in (std − promo saving; = advertised at 0v, nothing excluded)', stdAllIn(0) - savingOf(0), 11375)
    check('DSBH LIMITED 1 visa all-in (std 24,118 − 2,375)', stdAllIn(1) - savingOf(1), 21743)
    check('DSBH LIMITED 2 visa all-in (std 32,236 − 2,825)', stdAllIn(2) - savingOf(2), 29411)
    check('DSBH LIMITED Y2 (promo does NOT discount renewal)', Math.round(computeCost({ zone: 'DSBH', visas: 1, years: 1 }).year2), 16550)
    // Trap guard: for 1+ visas the ADVERTISED bundle price (which hides visa/medical/
    // status) must NEVER equal a rendered column all-in — standard OR LIMITED. (0-visa
    // is exempt: with no visa nothing is excluded, so it legitimately equals.)
    const trapHits = promoPkgs
      .filter((p) => p.visas >= 1)
      .filter((p) => p.price_now === stdAllIn(p.visas) || p.price_now === stdAllIn(p.visas) - savingOf(p.visas)).length
    check('DSBH advertised bundle (v≥1) never equals a column all-in (bundle-trap guard)', trapHits, 0)
    // DSBH has no multi-year discount (type "none") + recharges its est card yearly,
    // so the committed 2yr total must equal the straight annual sum (Y1 + Y2).
    const dsbh2y = computeCost({ zone: 'DSBH', visas: 1, years: 2 })
    check('DSBH 1 visa 2yr committed (= annual sum; no discount, est card annual)', dsbh2y.total, dsbh1.year1 + dsbh1.year2)

    logger.log('— Medical / EID independent counts (Meydan, 1 visa) —')
    const meydanMed2 = computeCost({ zone: 'Meydan', visas: 1, years: 1, medicalCount: 2 })
    const meydanEid0 = computeCost({ zone: 'Meydan', visas: 1, years: 1, eidCount: 0 })
    check('+1 medical (2×2,000) → 24,600 + 2,000', meydanMed2.year1, 26600)
    check('0 Emirates ID (−750) → 24,600 − 750', meydanEid0.year1, 23850)

    logger.log('— RAKEZ (bundled) —')
    check('RAKEZ Biz One Y1', rakez1y.total, 14010)
    check('RAKEZ Biz One 2-year package', rakez2y.termPrice, 26620)
    check('RAKEZ Biz One annual-renewal sum (2y)', rakez2y.annualRenewalSum, 28020)

    logger.log('— Ajman (bundled) —')
    check('Ajman 1 visa Y1 (new)', ajman1y.year1, 10800)
    check('Ajman 1 visa Y2 renewal', ajman2y.renewal, 9900)
    check('Ajman 1 visa 2-year', ajman2y.total, 20700)

    const failed = cases.filter((c) => !c.ok)
    logger.log(failed.length === 0 ? '\nALL B2C SANITY CHECKS PASSED' : `\n${failed.length} CHECK(S) FAILED`)
    return { passed: failed.length === 0, cases }
  }

  return {
    getZone,
    getPackage,
    computeCost,
    itemisedYear,
    itemisedMultiYear,
    sanityCheck,
  }
}
