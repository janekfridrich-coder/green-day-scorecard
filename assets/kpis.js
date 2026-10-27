/* KPI definitions, targets and derived values for the Green Day dashboard.
   Targets follow "Green Day: Rules to Win" (practice-round analysis, 27 Oct 2026). */

const AREAS = ["USA", "China", "Europe"];
const TECHS = ["Combustion", "Hybrid", "Electric", "Hydrogen"];

/* Raw fields stored per round. Money is in k USD, as Cesim reports it. */
const RAW_FIELDS = [
  { key: "tsr", label: "Cumulative TSR p.a., %", group: "Ratios" },
  { key: "sharePrice", label: "Share price, USD", group: "Ratios" },
  { key: "eps", label: "EPS, USD", group: "Ratios" },
  { key: "ebitdaPct", label: "EBITDA margin, %", group: "Ratios" },
  { key: "roce", label: "ROCE, %", group: "Ratios" },
  { key: "equityRatio", label: "Equity ratio, %", group: "Ratios" },
  { key: "esg", label: "ESG reputation (1-5)", group: "Ratios" },
  { key: "shares", label: "Shares outstanding, k", group: "Ratios" },
  { key: "revenue", label: "Sales revenue, k USD", group: "Financial statements" },
  { key: "profit", label: "Profit for the round, k USD", group: "Financial statements" },
  { key: "cash", label: "Cash, k USD", group: "Financial statements" },
  { key: "ltDebt", label: "Long-term debt, k USD", group: "Financial statements" },
  { key: "stDebt", label: "Short-term debt (unplanned), k USD", group: "Financial statements" },
  { key: "inventoryValue", label: "Inventory, k USD", group: "Financial statements" },
  { key: "dividends", label: "Dividends paid, k USD", group: "Finance decision" },
  ...AREAS.map(a => ({ key: `share${a}`, label: `Market share ${a}, %`, group: "Market reports" })),
  ...AREAS.flatMap(a => ["Combustion", "Hybrid"].flatMap(t => [
    { key: `price_${a}_${t}`, label: `${a} ${t} price (local)`, group: "Market reports" },
    { key: `feat_${a}_${t}`, label: `${a} ${t} features`, group: "Market reports" },
    { key: `sold_${a}_${t}`, label: `${a} ${t} sold, k units`, group: "Market reports" },
    { key: `dem_${a}_${t}`, label: `${a} ${t} demand, k units`, group: "Market reports" },
  ])),
  { key: "capUSA", label: "Capacity used USA, %", group: "Production report" },
  { key: "capChina", label: "Capacity used China, %", group: "Production report" },
  { key: "invUnits", label: "Ending inventory, k units", group: "Production report" },
  { key: "rdHybridPct", label: "R&D person-days to hybrid, %", group: "R&D decision" },
  { key: "rdEfficiency", label: "R&D efficiency multiplier", group: "HR report" },
  { key: "turnover", label: "Staff turnover, %", group: "HR report" },
];

const n = v => (typeof v === "number" && isFinite(v) ? v : null);

/* Values that are computed from raw fields. */
function derive(round, prev) {
  const r = { ...(round.kpi || {}) };
  if (n(r.dividends) != null && n(r.shares)) r.dps = r.dividends / r.shares;
  if (n(r.dividends) != null && n(r.profit) && r.profit > 0) r.payoutPct = (r.dividends / r.profit) * 100;

  let sold = 0, dem = 0, any = false;
  AREAS.forEach(a => TECHS.forEach(t => {
    if (n(r[`sold_${a}_${t}`]) != null && n(r[`dem_${a}_${t}`]) != null) {
      sold += r[`sold_${a}_${t}`]; dem += r[`dem_${a}_${t}`]; any = true;
    }
  }));
  if (any && dem > 0) r.serviceLevel = (sold / dem) * 100;
  if (any) r.totalSold = sold;

  AREAS.forEach(a => {
    const s = n(r[`sold_${a}_Hybrid`]), d = n(r[`dem_${a}_Hybrid`]);
    if (s != null && d) r[`hyService${a}`] = (s / d) * 100;
  });

  if (n(r.hybridFeatures) == null) {
    const f = AREAS.map(a => n(r[`feat_${a}_Hybrid`])).filter(v => v != null);
    if (f.length) r.hybridFeatures = Math.max(...f);
  }
  if (n(r.invUnits) != null && n(r.totalSold)) r.inventoryPct = (r.invUnits / r.totalSold) * 100;

  /* Hybrid price premium vs the average rival price, averaged over areas. */
  const prem = [];
  AREAS.forEach(a => {
    const ours = n(r[`price_${a}_Hybrid`]);
    const rivals = Object.values((round.rivalPrices || {})[a] || {}).filter(v => n(v) && v > 0);
    if (ours && rivals.length) prem.push((ours / (rivals.reduce((x, y) => x + y, 0) / rivals.length) - 1) * 100);
  });
  if (prem.length) r.hyPremium = prem.reduce((x, y) => x + y, 0) / prem.length;

  if (round.teams) {
    const sorted = Object.entries(round.teams).filter(([, t]) => n(t.tsr) != null).sort((x, y) => y[1].tsr - x[1].tsr);
    const i = sorted.findIndex(([name]) => name === round.team);
    if (i >= 0) { r.rank = i + 1; r.teamsCount = sorted.length; }
  }
  if (prev) r._prev = derive(prev, null);
  return r;
}

/* Balanced scorecard. target: min/warn, max/warn, range/warnRange, rising, or info. */
const SCORECARD = [
  {
    id: "financial", title: "Financial", question: "Do shareholders win?",
    kpis: [
      { key: "tsr", label: "Cumulative TSR p.a.", fmt: "pct", target: { min: 40, warn: 25 }, text: "≥ 40%, rank 1" },
      { key: "eps", label: "EPS", fmt: "usd2", target: { rising: true }, text: "Up every round" },
      { key: "ebitdaPct", label: "EBITDA margin", fmt: "pct", target: { min: 22, warn: 17 }, text: "≥ 22% (winners 22-27%)" },
      { key: "roce", label: "ROCE", fmt: "pct", target: { min: 30, warn: 20 }, text: "≥ 30%" },
      { key: "equityRatio", label: "Equity ratio", fmt: "pct", target: { range: [45, 60], warnRange: [40, 70] }, text: "45-60%" },
      { key: "stDebt", label: "Short-term debt", fmt: "bn", target: { max: 0, warn: 1000000 }, text: "0, always" },
      { key: "dps", label: "Dividend per share", fmt: "usd2", target: { range: [0.8, 1.0], warnRange: [0.4, 1.4] }, text: "Steady 0.8-1.0, ≤ profit" },
    ],
  },
  {
    id: "customer", title: "Customer & market", question: "Do customers pay us a premium?",
    kpis: [
      { key: "hyPremium", label: "Hybrid price vs rivals", fmt: "signedPct", target: { min: 0, warn: -8 }, text: "At or above market" },
      { key: "hybridFeatures", label: "Hybrid features", fmt: "int", target: { min: 4, warn: 3 }, text: "≥ 4 (winners 4-5)" },
      { key: "hyServiceEurope", label: "Europe hybrid served", fmt: "pct", target: { min: 95, warn: 80 }, text: "≥ 95% of demand" },
      { key: "serviceLevel", label: "Service level, all cars", fmt: "pct", target: { min: 97, warn: 90 }, text: "≥ 97%" },
      { key: "shareEurope", label: "Market share Europe", fmt: "pct", target: { min: 25, warn: 20 }, text: "≥ 25%" },
      { key: "esg", label: "ESG reputation", fmt: "x2", target: { min: 3.2, warn: 3.0 }, text: "≥ 3.2 before Sustainability focus" },
    ],
  },
  {
    id: "process", title: "Internal process", question: "Do we make the right cars in the right place?",
    kpis: [
      { key: "inventoryPct", label: "Ending inventory", fmt: "pct", target: { max: 3, warn: 8 }, text: "≤ 3% of cars sold" },
      { key: "capChina", label: "China capacity used", fmt: "pct", target: { range: [85, 92], warnRange: [75, 97] }, text: "85-92%" },
      { key: "capUSA", label: "USA capacity used", fmt: "pct", target: { info: true }, text: "Info only: cheapest source wins" },
      { key: "hyServiceChina", label: "China hybrid served", fmt: "pct", target: { min: 95, warn: 80 }, text: "≥ 95%" },
      { key: "hyServiceUSA", label: "USA hybrid served", fmt: "pct", target: { min: 95, warn: 80 }, text: "≥ 95%" },
    ],
  },
  {
    id: "learning", title: "Learning & growth", question: "Are we building the next edge?",
    kpis: [
      { key: "rdHybridPct", label: "R&D to hybrid", fmt: "pct", target: { min: 100, warn: 80 }, text: "100% until the R5 gate" },
      { key: "rdEfficiency", label: "R&D efficiency", fmt: "x2", target: { min: 1.05, warn: 1.0 }, text: "≥ 1.05" },
      { key: "turnover", label: "Staff turnover", fmt: "pct", target: { max: 5, warn: 7 }, text: "≤ 5%" },
    ],
  },
];

/* The "before you copy" rules from the one-pager, checked on the latest round. */
const RULE_CHECKS = [
  { label: "Profit up on last round", test: (r) => (r._prev && n(r.profit) != null && n(r._prev.profit) != null ? r.profit > r._prev.profit : null) },
  { label: "Ending inventory ≤ 3% of cars sold", test: (r) => (n(r.inventoryPct) != null ? r.inventoryPct <= 3 : null) },
  { label: "No unplanned short-term debt", test: (r) => (n(r.stDebt) != null ? r.stDebt <= 0 : null) },
  { label: "Equity ratio 45-60%", test: (r) => (n(r.equityRatio) != null ? r.equityRatio >= 45 && r.equityRatio <= 60 : null) },
  { label: "Europe hybrid ≥ 95% served", test: (r) => (n(r.hyServiceEurope) != null ? r.hyServiceEurope >= 95 : null) },
  { label: "Dividend not above profit", test: (r) => (n(r.payoutPct) != null ? r.payoutPct <= 100 : null) },
  { label: "Hybrid priced at or above rivals", test: (r) => (n(r.hyPremium) != null ? r.hyPremium >= 0 : null) },
];

function kpiStatus(kpi, r) {
  const v = n(r[kpi.key]);
  if (v == null) return "none";
  const t = kpi.target;
  if (t.info) return "none";
  if (t.rising) {
    const p = r._prev ? n(r._prev[kpi.key]) : null;
    if (p == null) return "none";
    return v > p ? "good" : v === p ? "warn" : "bad";
  }
  if (t.range) {
    if (v >= t.range[0] && v <= t.range[1]) return "good";
    if (v >= t.warnRange[0] && v <= t.warnRange[1]) return "warn";
    return "bad";
  }
  if (t.min != null) return v >= t.min ? "good" : v >= t.warn ? "warn" : "bad";
  if (t.max != null) return v <= t.max ? "good" : v <= t.warn ? "warn" : "bad";
  return "none";
}

function fmt(v, kind) {
  if (v == null || !isFinite(v)) return "–";
  switch (kind) {
    case "pct": return v.toFixed(1) + "%";
    case "signedPct": return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
    case "usd2": return "USD " + v.toFixed(2);
    case "x2": return v.toFixed(2);
    case "int": return Math.round(v).toString();
    case "bn": return "USD " + (v / 1e6).toFixed(1) + "bn";
    case "k": return Math.round(v).toLocaleString("en-US") + "k";
    default: return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
}
