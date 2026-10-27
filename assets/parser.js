/* Reads Cesim Global Challenge result exports (the XLS button on any Results page).
   Every sheet is scanned as rows: a header row holds the team names, heading rows
   (a label with no values) set the area / technology context, data rows are matched
   to KPIs by their label. Works with one combined export or one file per page. */

const AREA_RE = /^(usa|china|europe|global|asia)$/i;
const TECH_RE = /^(combustion|hybrid|electric|hydrogen)$/i;
/* Data labels that can appear with every value blank (e.g. a technology nobody sells). */
const EMPTY_DATA_RE = /^(selling price|promotion|number of offered features|features|marketing strategy focus|sales, k units|demand, k units)/i;
/* Top-level section titles ("Income statement, k USD, USA", "Market report, China") reset the area. */
const SECTION_RE = /(statement|report|details|indicators|, k usd)/i;

function normArea(s) {
  if (!s) return null;
  const m = s.match(/\b(USA|China|Asia|Europe|Global)\b/i);
  if (!m) return null;
  const a = m[1].toLowerCase();
  return a === "asia" ? "China" : a === "usa" ? "USA" : a[0].toUpperCase() + a.slice(1);
}

function parseNumber(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).trim().replace(/[\s  ]/g, "").replace(/%$/, "");
  if (!s || /^(n\/a|–|-)$/i.test(s)) return null;
  if (s.includes(",") && !s.includes(".")) s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  else s = s.replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null;
}

function sheetFacts(name, rows, team) {
  const facts = [];
  let cols = null, area = normArea(name), tech = null, title = name, section = name;
  const teamLc = team.trim().toLowerCase();
  for (const row of rows) {
    const cells = row.map(c => (c == null ? "" : c));
    const idx = cells.findIndex((c, i) => i > 0 && String(c).trim().toLowerCase() === teamLc);
    if (idx > 0) {
      cols = {};
      cells.forEach((c, i) => { if (i > 0 && String(c).trim() && parseNumber(c) == null) cols[i] = String(c).trim(); });
      continue;
    }
    const label = String(cells[0] || "").trim();
    if (!label) continue;
    const values = {};
    let has = false;
    if (cols) for (const [i, t] of Object.entries(cols)) {
      const v = parseNumber(cells[i]);
      if (v != null) { values[t] = v; has = true; }
    }
    if (!has) {
      if (EMPTY_DATA_RE.test(label)) continue;
      if (AREA_RE.test(label)) { area = normArea(label); tech = null; }
      else if (TECH_RE.test(label)) tech = label[0].toUpperCase() + label.slice(1).toLowerCase();
      else if (SECTION_RE.test(label) && !/k units/i.test(label)) { section = title = label; tech = null; area = normArea(label); }
      else { title = label; tech = null; const a = normArea(label); if (a) area = a; }
      continue;
    }
    facts.push({ sheet: name, section, title, area, tech, label, values });
  }
  return facts;
}

function readWorkbook(arrayBuffer, team) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  return wb.SheetNames.flatMap(n => sheetFacts(n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" }), team));
}

const isGlobal = f => !f.area || f.area === "Global";
const L = re => f => re.test(f.label);

/* [kpi key, predicate, also keep every team's value as] */
const RULES = [
  ["tsr", L(/cumulative total shareholder return/i), "tsr"],
  ["sharePrice", L(/share price at the end of round/i), "sharePrice"],
  ["eps", L(/earnings per share/i)],
  ["ebitdaPct", f => /\(ebitda\)/i.test(f.label) && (/%/.test(f.label) || /key financial indicators/i.test(f.title))],
  ["roce", L(/return on capital employed/i)],
  ["equityRatio", L(/^equity ratio/i)],
  ["esg", L(/^esg reputation/i)],
  ["shares", L(/shares outstanding/i)],
  ["revenue", f => /^sales revenue$/i.test(f.label) && isGlobal(f)],
  ["profit", f => /^profit for the round$/i.test(f.label) && isGlobal(f)],
  ["cash", f => /^cash and cash equivalents$/i.test(f.label) && isGlobal(f)],
  ["ltDebt", f => /^long-term debts?$/i.test(f.label) && isGlobal(f)],
  ["stDebt", f => /^short-term debts?/i.test(f.label) && isGlobal(f)],
  ["inventoryValue", f => /^inventory$/i.test(f.label) && isGlobal(f) && !/k units/i.test(f.title)],
  /* Paid dividends are a negative line in the parent company's cash flow statement. */
  ["dividends", f => /^dividends?( paid)?(, k usd)?$/i.test(f.label) && /parent company/i.test(f.section)],
  ["rdEfficiency", L(/efficiency/i)],
  ["turnover", f => /turnover/i.test(f.label) && /%/.test(f.label) && !/estimated/i.test(f.label)],
];

function extract(facts, team) {
  const kpi = {}, teams = {}, rivalPrices = {}, found = [];
  const take = (key, f) => {
    if (kpi[key] != null || f.values[team] == null) return false;
    kpi[key] = f.values[team];
    found.push({ key, value: f.values[team], source: `${f.section !== f.title ? f.section + " › " : ""}${f.title}${f.area ? " › " + f.area : ""}${f.tech ? " › " + f.tech : ""} › ${f.label}` });
    return true;
  };

  for (const [key, test, all] of RULES) {
    const f = facts.find(x => test(x) && x.values[team] != null);
    if (!f) continue;
    take(key, f);
    if (all) for (const [t, v] of Object.entries(f.values)) (teams[t] = teams[t] || {})[all] = v;
  }

  for (const a of AREAS) {
    const share = facts.find(f => f.area === a && /^total$/i.test(f.label) && /market share/i.test(f.title));
    if (share) take(`share${a}`, share);
    for (const t of ["Combustion", "Hybrid"]) {
      const inTech = f => f.area === a && f.tech === t;
      const price = facts.find(f => inTech(f) && /^selling price/i.test(f.label));
      if (price) {
        take(`price_${a}_${t}`, price);
        if (t === "Hybrid") rivalPrices[a] = Object.fromEntries(Object.entries(price.values).filter(([k, v]) => k !== team && v > 0));
      }
      const feat = facts.find(f => inTech(f) && /number of offered features/i.test(f.label));
      if (feat) take(`feat_${a}_${t}`, feat);
      const sold = facts.find(f => inTech(f) && /^sales, k units/i.test(f.label));
      if (sold) take(`sold_${a}_${t}`, sold);
      const dem = facts.find(f => inTech(f) && /^demand, k units/i.test(f.label));
      if (dem) take(`dem_${a}_${t}`, dem);
    }
  }

  for (const a of ["USA", "China"]) {
    const free = facts.find(f => f.area === a && /^free capacity/i.test(f.label) && f.values[team] != null);
    if (free && kpi[`cap${a}`] == null) {
      kpi[`cap${a}`] = 100 - free.values[team];
      found.push({ key: `cap${a}`, value: kpi[`cap${a}`], source: `${free.sheet} › ${free.title} › ${a} › 100 − Free capacity` });
    }
  }

  const inv = facts.filter(f => /^inventory, k units/i.test(f.title) && TECH_RE.test(f.label) && f.values[team] != null);
  if (inv.length) {
    kpi.invUnits = inv.reduce((s, f) => s + f.values[team], 0);
    found.push({ key: "invUnits", value: kpi.invUnits, source: `${inv[0].sheet} › Inventory, k units › sum of ${inv.length} rows` });
  }

  if (kpi.dividends != null) {
    kpi.dividends = Math.abs(kpi.dividends);
    found.forEach(f => { if (f.key === "dividends") f.value = kpi.dividends; });
  }
  return { kpi, teams, rivalPrices, found };
}

/* Merge an import into a round; later files never overwrite values already set by an earlier file. */
function mergeImport(round, result, overwrite) {
  round.kpi = round.kpi || {};
  for (const [k, v] of Object.entries(result.kpi)) if (overwrite || round.kpi[k] == null) round.kpi[k] = v;
  round.teams = round.teams || {};
  for (const [t, vals] of Object.entries(result.teams)) round.teams[t] = { ...(round.teams[t] || {}), ...vals };
  round.rivalPrices = { ...(round.rivalPrices || {}), ...result.rivalPrices };
  return round;
}
