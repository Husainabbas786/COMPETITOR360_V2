# Competitor 360 — Build Spec & Master Data
A free-zone pricing & commission comparison tool. Benchmarks **Meydan** (baseline) against **IFZA, RAKEZ, Ajman, DWTC**. Every free zone sells the same trade licence, so the only real differentiators are **price (B2C)** and **commission (B2B)**.

## Architecture
- **Master data** → `Competitor360_Master.xlsx` (human-editable) + `master-data.json` (tool reads this). All figures flagged by confidence.
- **Tool** → React front-end, two views (B2C pricing, B2B commission), interactive filters, reads master-data.json.
- **AI layer** → backend endpoint that calls the OpenAI API to generate a dynamic inference statement on each filter change, fed the master + current filter state. NOT in the master — separate layer.
- **Aesthetic** → editorial / refined: warm off-white background, deep ink text, one accent, Meydan highlighted in teal. Clean, lots of whitespace. (Reference dashboard to follow.)

## Confidence legend
✅ confirmed (official source) · 🟡 assumed/estimated — placeholder, overwrite when real data lands · ⬜ missing

## Philosophy
Only two tables matter — B2C pricing and B2B commission. Everything else is extra. Assume placeholders for gaps now; swap real data in later without touching the tool.

## B2C PRICING (AED, VAT-incl, components for one investor visa)
| Component | Meydan | IFZA | RAKEZ | Ajman | DWTC |
|---|---|---|---|---|---|
| Licence (0-visa, 3 activities) | 12,125 ✅ | 12,900 🟡 (contact says 11,900) | 6,010 ✅ | 4,888 ✅ | 12,000 🟡 |
| Registration / admin | incl | incl | incl | incl | 500 🟡 |
| Shared desk / co-working | 375 ✅ | incl 🟡 | incl ✅ | incl ✅ (lease) | incl ⬜ |
| Establishment card | 2,000 ✅ | 2,000 ✅ | incl ✅ | incl ✅ | 2,300 🟡 |
| Visa allocation (per visa) | 1,850 ✅ | 2,000 ✅ (licence-tier step) | incl ✅ | incl ✅ | 2,000 🟡 (tier step) |
| Residence visa – investor (per visa) | 4,000 ✅ | 0 (FREE-for-life) + 1,000 title ✅ | incl ✅ | incl ✅ | 3,020 🟡 |
| Medical (per visa) | 2,000 🟡 | ~700 🟡 | incl ✅ (+40 alloc) | incl ✅ | ⬜ |
| Emirates ID (per visa) | 750 🟡 | ~400 🟡 | incl ✅ (+30 delivery) | incl ✅ | ⬜ |
| Status change (inside UAE) | 1,500 ✅ | 1,600 ✅ | incl ✅ | incl ✅ | 0 ⬜ |
| Visa bundle increment (bundled zones) | — | — | 8,000 ✅ | 5,912 ✅ | — |
| **BASE = Licence + Shared Desk (0 visa)** | **12,500** | **12,900** | **6,010** | **4,888** | **12,500** |
| **ALL-IN = 1 investor visa, Year 1** | **24,600** | **20,600** | **14,010** | **10,800** | **19,820** |

Notes: BASE = licence + registration + desk (formula). ALL-IN = sum of components (formula). Meydan ALL-IN = 24,100 if customer takes the bundled Medical+EID Assistance (2,250) instead of itemised (2,750). RAKEZ/Ajman bundle everything into the visa increment.

## MULTI-YEAR & YEAR-2
- Multi-year discount: Meydan 2yr 10% / 3yr+ 15% 🟡 · IFZA 2yr 15% / 3yr 20% / 5yr 30% ✅ · RAKEZ explicit non-linear table — Biz One: 1y 14,010 / 2y 26,620 / 3y 37,830 / 4y 50,440 / 5y 59,560 / 6y 67,260 / 10y 105,100 ✅ · Ajman annual model, no multi-year ✅ · DWTC ⬜
- Year-2 cost (1-visa): Meydan ~14,700 🟡 · IFZA ~17,100 🟡 · RAKEZ 14,010 ✅ · Ajman 9,900 ✅ · DWTC ⬜
- KEY: Year-2 powers the flagship inference "Year-1 Meydan costly, Year-2 Meydan cheaper." It rests on the assumption that the visa is NOT re-charged in Year 2 (residence visas valid ~2 yrs). CONFIRM with Jai — this is the lever.

## B2B COMMISSION
| Item | Meydan | IFZA | RAKEZ | Ajman | DWTC |
|---|---|---|---|---|---|
| Model | 5 tiers (quarterly), CP picks one-time OR recurring | Plan A (%) or Plan B (one-time) | Flat | Tiered (yearly companies) | Flat |
| Commission BASE (% applies to) | Full package 🟡 | Standard licence price ✅ | Licence only 🟡 | All-inclusive package ✅ | Unknown 🟡 |
| Base amount (1-visa) | 12,500 🟡 | 14,900 ✅ | 6,010 🟡 | 10,800 ✅ | 14,000 🟡 |
| One-time (entry → top) | 30 → 50% ✅ | 40% (Plan B) ✅ | 50% ✅ | 35 → 55% (52% cap on 1-visa) ✅ | 20% ✅ |
| Recurring (entry → top) | 20 → 50% new / 40% renew ✅ | 20–25% 🟡 | ⬜ | 35% flat ✅ | ⬜ |
| **Take-home (entry, 1-visa, one-time) = rate × base** | **3,750** | 5,960 | **3,005** | 3,780 | 2,800 |

Full tier ladders (for the orange ceiling markers):
- Meydan (quarterly new sales): Bronze 0-20 → 30%/20% · Silver 21-30 → 35%/25% · Gold 31-75 → 40%/30% · Platinum 76-120 → 40%/40% · Platinum+ 121+ → 50% / (50% new, 40% renew)
- Ajman (yearly companies): ≤10 → 35% · ≤20 → 40% · ≤30 → 45% · ≤350 → 50% · 350+ → 55% (capped 52% on 1-visa) · renewal 35% flat
- IFZA: Plan A 20–25% · Plan B 40% one-time, no slab, no renewal
- RAKEZ: flat 50% · DWTC: flat 20%

KEY INSIGHT: Meydan's 30% (3,750) beats RAKEZ's 50% (3,005) in real dirhams — a lower rate on a bigger base wins. Take-home = rate × base; the base differs per zone, so the headline % alone misleads.

## TOOL REQUIREMENTS
**B2C view:** default "Licence + Shared Desk" for all zones; component multi-select with quantities (licence + number of years; visa allocation, immigration card, medical, Emirates ID, the visa — each with qty); all zones reprice live; Meydan baseline selector (expandable to DSO/Shams/SPC later); chart view + table view; sources shown.
**B2B view:** commission % comparison; one-time vs recurring bifurcation filter; full tier ladder with orange ceiling markers; take-home AED = rate × base.
**AI layer (backend):** a statement that rewrites itself on every filter change. Examples: "licence-only → RAKEZ/Ajman cheapest"; the Year-2 flip; "who's cheapest right now (with offers)"; B2B → who pays what %, and the real take-home ranking. Fed the full master + current filters as context.

## GAPS TO SWAP IN (from Akshay)
Commission bases (Meydan, RAKEZ, DWTC) · multi-year (Meydan, DWTC) · RAKEZ one-time vs recurring · IFZA 20-vs-25% & 11,900-vs-12,900 · Meydan & IFZA medical/EID real cost · DWTC desk/medical/EID/status/renewal · live offers (all zones) · Year-2 visa-recharge logic.