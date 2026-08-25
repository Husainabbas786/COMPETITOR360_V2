// Verifies the pure engines against the master's own headline figures.
// Run: npm run selfcheck
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createPricingEngine } from '../src/logic/pricing.js'
import { createCommissionEngine } from '../src/logic/commission.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const master = JSON.parse(readFileSync(join(root, 'master-data.json'), 'utf8'))
// The B2C grid reads a DIFFERENT file (src/data/master-schema.json). Both are
// live — this one powers B2B, the confidence legend and Sources & Verify; that
// one powers the B2C grid. They overlap on RAKEZ/Ajman bundled prices, so they
// are cross-checked below: a figure corrected in one and not the other is how
// the tool ends up contradicting itself in front of a client.
const schema = JSON.parse(readFileSync(join(root, 'src/data/master-schema.json'), 'utf8'))
const pricing = createPricingEngine(master)
const commission = createCommissionEngine(master)

let fails = 0
const eq = (label, got, want) => {
  const ok = Math.round(got) === Math.round(want)
  if (!ok) fails++
  console.log(`${ok ? '✓' : '✗'} ${label}: got ${Math.round(got)} want ${want}`)
}

// 1) Default toggles (Licence + Desk) must reproduce master.b2c.base
const def = pricing.defaultState()
const baseRes = pricing.computeAll(def)
console.log('— B2C default (Licence + Shared Desk) vs base —')
for (const z of master.meta.zones) eq(z, baseRes[z].total, master.b2c.base[z])

// 2) A 1-investor-visa config must reproduce master.b2c.all_in
const allInState = pricing.defaultState()
for (const id of ['estcard', 'alloc', 'residence', 'medical', 'eid', 'status']) allInState.toggles[id] = true
const allRes = pricing.computeAll(allInState)
console.log('— B2C all-in (1 investor visa) vs all_in —')
for (const z of master.meta.zones) eq(z, allRes[z].total, master.b2c.all_in[z])

// 3) One-time entry take-home must reproduce master.b2b.take_home
console.log('— B2B one-time take-home vs take_home —')
const th = commission.computeAll('onetime')
for (const z of master.meta.zones) eq(z, th[z].takeHome ?? NaN, master.b2b.take_home[z])

// 3b) Take-home by commitment level reads the uniform tier schema correctly
console.log('— B2B take-home by level (one-time) —')
const base = (z) => master.b2b.rows.base_amount[z].numeric
eq('Meydan low (entry 30%)', commission.computeLevel('Meydan', 'onetime', 'low').takeHome, 0.30 * base('Meydan'))
eq('Meydan mid (Gold 40%)', commission.computeLevel('Meydan', 'onetime', 'mid').takeHome, 0.40 * base('Meydan'))
eq('Meydan high (Plat+ 50%)', commission.computeLevel('Meydan', 'onetime', 'high').takeHome, 0.50 * base('Meydan'))
const rk = ['low', 'mid', 'high'].map((l) => commission.computeLevel('RAKEZ', 'onetime', l).takeHome)
console.log(`${rk.every((v) => v === rk[0]) ? '✓' : '✗'} RAKEZ flat: same take-home at every level (${rk.join('/')})`)
if (!rk.every((v) => v === rk[0])) fails++
const rakezRec = commission.computeLevel('RAKEZ', 'recurring', 'low').takeHome
console.log(`${rakezRec === null ? '✓' : '✗'} RAKEZ recurring = not disclosed (null take-home)`)
if (rakezRec !== null) fails++

// 4) Multi-year sanity: RAKEZ 2/3/5yr totals (default base) match official table − bundle... + bundle when 1 visa
console.log('— Multi-year smoke (no crash) —')
for (const y of [2, 3, 5]) {
  const s = pricing.defaultState(); s.duration = y
  const r = pricing.computeAll(s)
  console.log(`  ${y}yr base totals:`, master.meta.zones.map((z) => `${z} ${Math.round(r[z].total)}`).join(' · '))
}

// 5) Cross-file agreement — master-data.json vs src/data/master-schema.json.
// Both files are live: this one powers B2B, the confidence legend and Sources &
// Verify; the schema powers the B2C grid. They overlap on the bundled zones,
// whose tier price IS the all-in, so those figures are asserted equal here. A
// price corrected in one file and not the other is how the tool ends up
// contradicting itself in front of a client. Itemised zones build from
// components and are not comparable line-for-line, so they are not asserted.
console.log('— Cross-file: master-data.json vs master-schema.json (bundled zones) —')
const zoneOf = (name) => schema.zones.find((z) => z.zone === name)
const pkgOf = (name, id) => (zoneOf(name).packages || []).find((p) => p.package_id === id)
const rakezBiz0 = pkgOf('RAKEZ', 'rakez_biz0')
const rakezBiz1 = pkgOf('RAKEZ', 'rakez_biz1')
const ajman1v = pkgOf('Ajman', 'ajman_1v')
eq('RAKEZ base (0 visa)', master.b2c.base.RAKEZ, rakezBiz0.tier_price['1y'])
eq('RAKEZ all-in (1 visa)', master.b2c.all_in.RAKEZ, rakezBiz1.tier_price['1y'])
eq('RAKEZ B2B commission base', master.b2b.rows.base_amount.RAKEZ.numeric, rakezBiz0.tier_price['1y'])
eq('RAKEZ Year-2 (renewal = 1yr)', master.multi_year.year_2.RAKEZ.numeric, rakezBiz1.tier_price['1y'])
for (const term of Object.keys(master.multi_year.rakez_biz_one)) {
  eq(`RAKEZ Biz One ${term}`, master.multi_year.rakez_biz_one[term].numeric, rakezBiz1.tier_price[term])
}
eq('Ajman all-in (1 visa, new)', master.b2c.all_in.Ajman, ajman1v.tier_price_new)
eq('Ajman Year-2 (renewal)', master.multi_year.year_2.Ajman.numeric, ajman1v.tier_price_renewal)

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`)
process.exit(fails === 0 ? 0 : 1)
