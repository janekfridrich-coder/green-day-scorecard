/* Green Day Scorecard: state, views (dashboard / scorecard / data) and dialogs. */

const STORE_KEY = "green-day-scorecard-v1";
const ROUND_IDS = [
  { id: "P1", label: "Practice 1", practice: true },
  { id: "P2", label: "Practice 2", practice: true },
  ...Array.from({ length: 9 }, (_, i) => ({ id: `R${i + 1}`, label: `Round ${i + 1}`, practice: false })),
];
const STATUS_TEXT = { good: "On target", warn: "Watch", bad: "Off target", none: "No target" };
const VIEWS = {
  dashboard: { title: "Dashboard", eyebrow: "Cesim Global Challenge · Universe 5" },
  scorecard: { title: "Balanced scorecard", eyebrow: "Targets from Green Day: Rules to Win" },
  pricing: { title: "Pricing", eyebrow: "Our prices vs every rival in Universe 5" },
  data: { title: "Data", eyebrow: "Stored numbers per round" },
};
const ALL_KPIS = SCORECARD.flatMap(p => p.kpis);

let state = { team: "Green Day", rounds: [] };
let selected = null;
let view = "dashboard";
const $ = s => document.querySelector(s);

/* ---------- storage ---------- */
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ }
}
/* The shared data/rounds.json wins for every round it contains; rounds only stored locally are kept. */
async function load() {
  let local = null, shared = null;
  try { const s = localStorage.getItem(STORE_KEY); if (s) local = JSON.parse(s); } catch (e) { /* ignore */ }
  try {
    const res = await fetch("data/rounds.json", { cache: "no-store" });
    if (res.ok) { const d = await res.json(); if (d && Array.isArray(d.rounds)) shared = d; }
  } catch (e) { /* opened from disk: no fetch */ }
  if (shared) {
    const ids = new Set(shared.rounds.map(r => r.id));
    state = { team: shared.team || "Green Day", rounds: [...shared.rounds, ...((local && local.rounds) || []).filter(r => !ids.has(r.id))] };
  } else if (local) state = local;
  sortRounds();
}
function sortRounds() {
  const order = Object.fromEntries(ROUND_IDS.map((r, i) => [r.id, i]));
  state.rounds.sort((a, b) => order[a.id] - order[b.id]);
}
function getRound(id, create) {
  let r = state.rounds.find(x => x.id === id);
  if (!r && create) {
    const meta = ROUND_IDS.find(x => x.id === id);
    r = { id, label: meta.label, practice: meta.practice, team: state.team, kpi: {}, teams: {}, rivalPrices: {} };
    state.rounds.push(r); sortRounds();
  }
  return r;
}
/* Real rounds compare with the previous real round; practice rounds with the previous practice round. */
const prevOf = r => {
  const same = state.rounds.filter(x => !!x.practice === !!r.practice);
  const i = same.indexOf(r);
  return i > 0 ? same[i - 1] : null;
};
function chartRounds() {
  const showPractice = $("#show-practice").checked || state.rounds.every(r => r.practice);
  return state.rounds.filter(r => showPractice || !r.practice);
}
const series = key => chartRounds().map(r => { const v = derive(r, prevOf(r))[key]; return v == null ? null : v; });

/* ---------- shared bits ---------- */
function statusTag(s, missing) {
  return `<span class="status ${missing ? "none" : s}"><span class="ic"></span>${missing ? "No data" : STATUS_TEXT[s]}</span>`;
}
function deltaBadge(v, p, kind, lowerIsBetter) {
  if (v == null || p == null) return `<span class="delta-note">First round</span>`;
  const diff = v - p;
  if (Math.abs(diff) < 1e-9) return `<span class="delta">■ No change</span>`;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const txt = kind === "pct" ? `${Math.abs(diff).toFixed(1)} pts`
    : kind === "bn" ? `$${(Math.abs(diff) / 1e6).toFixed(1)}bn`
    : kind === "usd2" ? `$${Math.abs(diff).toFixed(2)}` : Math.abs(diff).toFixed(2);
  return `<span class="delta ${good ? "up" : "down"}">${diff > 0 ? "▲" : "▼"} ${txt}</span>`;
}

/* ---------- render ---------- */
function render() {
  const has = state.rounds.length > 0;
  $("#empty").hidden = has;
  $(".round-bar").hidden = !has;
  document.querySelectorAll(".view").forEach(v => { v.hidden = !has || v.id !== `view-${view}`; });
  document.querySelectorAll(".nav a").forEach(a => a.classList.toggle("active", a.dataset.view === view));
  $("#view-title").textContent = VIEWS[view].title;
  $("#view-eyebrow").textContent = VIEWS[view].eyebrow;
  if (!has) { $("#round-chips").innerHTML = ""; return; }
  if (!selected || !getRound(selected)) {
    const real = state.rounds.filter(r => !r.practice);
    selected = (real.length ? real : state.rounds).slice(-1)[0].id;
  }
  const round = getRound(selected);
  const d = derive(round, prevOf(round));

  $("#round-chips").innerHTML = state.rounds.map(r =>
    `<button class="chip${r.practice ? " practice" : ""}" role="tab" aria-selected="${r.id === selected}" data-id="${r.id}">${r.label}</button>`).join("");
  $("#round-chips").querySelectorAll(".chip").forEach(b => b.onclick = () => { selected = b.dataset.id; render(); });

  if (view === "dashboard") { renderHero(d); renderStrip(d); renderRules(d); renderCharts(round, d); }
  if (view === "scorecard") renderScorecard(d);
  if (view === "pricing") renderPricing(round);
  if (view === "data") renderTable();
}

/* ---------- pricing ---------- */
const money = v => (v == null ? "–" : Math.round(v).toLocaleString("en-US"));
const signed = v => (v == null ? "–" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);

function premiumBar(p) {
  if (p == null) return "";
  const w = Math.min(Math.abs(p) / 0.2, 1) * 50;
  return `<div class="pbar"><span class="pbar-mid"></span><span class="pbar-fill ${p >= 0 ? "pos" : "neg"}" style="${p >= 0 ? "left:50%" : `left:${50 - w}%`};width:${w}%"></span></div>`;
}

function renderPricing(round) {
  const rows = pricingRows(round);
  $("#price-sub").textContent = `${round.label}. Premium = our price against the rivals' average in the same market. Suggested = proposal for the next round.`;
  if (!rows.length) {
    $("#price-summary").innerHTML = `<tbody><tr><td class="empty">No market report for ${round.label} yet. Import the round's XLS export to compare prices.</td></tr></tbody>`;
    $("#price-areas").innerHTML = "";
    return;
  }
  $("#price-summary").innerHTML = `
    <thead><tr><th>Market</th><th>Our price</th><th>Rivals avg</th><th>Premium</th><th>Price rank</th><th>Features</th><th>Served</th><th>Suggested</th><th>Why</th></tr></thead>
    <tbody>${rows.map(r => {
      const st = r.served >= 0.98 ? "good" : r.served >= 0.8 ? "warn" : "bad";
      return `<tr>
        <td><b>${r.area}</b> ${r.tech.toLowerCase()}<span class="cur">${r.currency}</span></td>
        <td class="num"><b>${money(r.us.price)}</b></td>
        <td class="num">${money(r.avg)}</td>
        <td class="num"><div class="prem"><span class="${r.premium > 0 ? "up" : r.premium < 0 ? "down" : ""}">${signed(r.premium)}</span>${premiumBar(r.premium)}</div></td>
        <td class="num">${r.rank} of ${r.all.length}</td>
        <td class="num">${r.us.features ?? "–"} vs ${r.avgFeat != null ? r.avgFeat.toFixed(1) : "–"}</td>
        <td><span class="status ${st}"><span class="ic"></span>${Math.round(r.served * 100)}%</span></td>
        <td class="num suggest">${money(r.target)}<span class="chg ${r.change > 0 ? "up" : r.change < 0 ? "down" : ""}">${signed(r.change)}</span></td>
        <td class="why">${r.why}</td></tr>`;
    }).join("")}</tbody>`;

  $("#price-top2").innerHTML = `
    <thead><tr><th>Market</th><th>Our price</th><th>Best two rivals</th><th>Their avg</th><th>Us vs them</th><th>Features</th><th>Sold (k), us / them</th></tr></thead>
    <tbody>${rows.map(r => {
      const ourSold = r.us.sales || 0, theirSold = r.top2.length ? r.top2Sales / r.top2.length : null;
      const soldGap = theirSold ? ourSold / theirSold - 1 : null;
      return `<tr>
        <td><b>${r.area}</b> ${r.tech.toLowerCase()}<span class="cur">${r.currency}</span></td>
        <td class="num"><b>${money(r.us.price)}</b></td>
        <td class="names">${r.top2.map(t => `<div class="rival"><span>${t.name}</span><span class="muted">${money(t.price)} · ${t.features ?? "–"} feat. · ${Math.round(t.sales || 0)}k sold</span></div>`).join("") || "–"}</td>
        <td class="num">${money(r.top2Avg)}</td>
        <td class="num"><div class="prem"><span class="${r.premiumTop2 > 0 ? "up" : r.premiumTop2 < 0 ? "down" : ""}">${signed(r.premiumTop2)}</span>${premiumBar(r.premiumTop2)}</div></td>
        <td class="num">${r.us.features ?? "–"} vs ${r.top2Feat != null ? r.top2Feat.toFixed(1) : "–"}</td>
        <td class="num">${Math.round(ourSold)} / ${theirSold != null ? Math.round(theirSold) : "–"} <span class="${soldGap > 0 ? "up" : soldGap < 0 ? "down" : ""}">${signed(soldGap)}</span></td></tr>`;
    }).join("")}</tbody>`;

  $("#price-areas").innerHTML = AREAS.map(a => {
    const techRows = rows.filter(r => r.area === a);
    if (!techRows.length) return "";
    return `<article class="panel">
      <div class="panel-head"><div><h2>${a}</h2><p class="muted">Prices in ${CURRENCY[a]}. Sorted from most expensive.</p></div></div>
      ${techRows.map(r => `
        <h3 class="tech-h">${r.tech}<span class="muted"> · rivals ${money(r.min)}–${money(r.max)}, average ${money(r.avg)} · best two average ${money(r.top2Avg)}</span></h3>
        <div class="table-wrap"><table class="price-table compact">
          <thead><tr><th>Team</th><th>Price</th><th>vs us</th><th>vs rivals avg</th><th>vs best two</th><th>Features</th><th>Focus</th><th>Sold / demand (k)</th><th>Served</th></tr></thead>
          <tbody>${r.all.map(t => {
            const ours = t.name === round.team;
            const vsUs = ours ? null : t.price / r.us.price - 1;
            const served = t.demand ? t.sales / t.demand : null;
            const st = served == null ? "none" : served >= 0.98 ? "good" : served >= 0.8 ? "warn" : "bad";
            return `<tr class="${ours ? "ours" : ""}">
              <td>${ours ? "<b>" + t.name + "</b>" : t.name}${r.top2.some(x => x.name === t.name) ? ' <span class="top2">Top 2</span>' : ""}</td>
              <td class="num"><b>${money(t.price)}</b></td>
              <td class="num ${vsUs > 0 ? "up" : vsUs < 0 ? "down" : ""}">${ours ? "—" : signed(vsUs)}</td>
              <td class="num">${r.avg ? signed(t.price / r.avg - 1) : "–"}</td>
              <td class="num">${r.top2Avg ? signed(t.price / r.top2Avg - 1) : "–"}</td>
              <td class="num">${t.features ?? "–"}</td>
              <td>${t.focus || "–"}</td>
              <td class="num">${t.sales != null ? Math.round(t.sales) : "–"} / ${t.demand != null ? Math.round(t.demand) : "–"}</td>
              <td>${served == null ? "–" : `<span class="status ${st}"><span class="ic"></span>${Math.round(served * 100)}%</span>`}</td></tr>`;
          }).join("")}</tbody></table></div>
        <div class="suggest-line">Suggested for next round: <b>${money(r.target)} ${r.currency}</b> <span class="${r.change > 0 ? "up" : r.change < 0 ? "down" : ""}">(${signed(r.change)})</span> — ${r.why}.</div>`).join("")}
    </article>`;
  }).join("");
}

function renderHero(d) {
  const p = d._prev || {};
  const rank = d.rank ? `<span class="rank">#${d.rank} of ${d.teamsCount}</span>` : "";
  const cards = [
    { k: "Cumulative TSR p.a.", v: fmt(d.tsr, "pct"), extra: rank, delta: deltaBadge(d.tsr, p.tsr, "pct"), spark: sparkline(series("tsr"), "var(--good)", 120, 36), lead: true },
    { k: "Share price", v: d.sharePrice != null ? `$${d.sharePrice.toFixed(2)}` : "–", delta: deltaBadge(d.sharePrice, p.sharePrice, "usd2"), spark: sparkline(series("sharePrice")) },
    { k: "EPS", v: d.eps != null ? `$${d.eps.toFixed(2)}` : "–", delta: deltaBadge(d.eps, p.eps, "usd2"), spark: sparkline(series("eps")) },
    { k: "Profit for the round", v: d.profit != null ? `$${(d.profit / 1e6).toFixed(1)}bn` : "–", delta: deltaBadge(d.profit, p.profit, "bn"), spark: sparkline(series("profit")) },
  ];
  $("#hero").innerHTML = cards.map(c => `
    <div class="panel hero-card${c.lead ? " lead" : ""}">
      <div class="k"><span>${c.k}</span>${c.extra || ""}</div>
      <div class="v">${c.v}</div>
      <div class="meta"><div>${c.delta}</div>${c.spark}</div>
    </div>`).join("");
}

function renderStrip(d) {
  const keys = ["ebitdaPct", "roce", "equityRatio", "stDebt", "hyServiceEurope", "hybridFeatures"];
  $("#kpi-strip").innerHTML = keys.map(key => {
    const k = ALL_KPIS.find(x => x.key === key);
    const s = d[key] == null ? "none" : kpiStatus(k, d);
    return `<div class="panel mini ${s}"><div class="k">${k.label}</div><div class="v">${fmt(d[key], k.fmt)}</div><div class="t">Target ${k.text}</div></div>`;
  }).join("");
}

function renderRules(d) {
  let pass = 0, scored = 0;
  $("#rules").innerHTML = RULE_CHECKS.map(c => {
    const res = c.test(d);
    const s = res == null ? "none" : res ? "good" : "bad";
    if (res != null) { scored++; if (res) pass++; }
    const word = res == null ? "No data" : res ? "Pass" : "Fail";
    return `<li class="${s}"><span class="status ${s}"><span class="ic"></span>${word}</span><span>${c.label}</span></li>`;
  }).join("");
  $("#rules-score").innerHTML = scored ? `<b>${pass}</b> / ${scored} passed` : "No data";
}

function renderCharts(round, d) {
  const rounds = chartRounds();
  const labels = rounds.map(r => r.label.replace("Round ", "R").replace("Practice ", "P"));
  const ds = rounds.map(r => derive(r, prevOf(r)));
  const pctFmt = v => `${Math.round(v)}%`;

  const teamNames = [...new Set(rounds.flatMap(r => Object.keys(r.teams || {})))];
  const tsrSeries = teamNames.map(t => ({
    name: t, emphasis: t === state.team,
    color: t === state.team ? "var(--good)" : "var(--rival)",
    values: rounds.map(r => (r.teams && r.teams[t] && r.teams[t].tsr != null ? r.teams[t].tsr : null)),
  }));
  if (!tsrSeries.length) tsrSeries.push({ name: state.team, emphasis: true, color: "var(--good)", values: ds.map(x => x.tsr ?? null) });
  lineChart($("#chart-tsr"), { labels, series: tsrSeries, yFmt: pctFmt, zeroLine: true, height: 280 });

  lineChart($("#chart-profit"), { labels, yFmt: pctFmt, series: [
    { name: "EBITDA %", color: "var(--series-1)", values: ds.map(x => x.ebitdaPct ?? null) },
    { name: "ROCE", color: "var(--series-2)", values: ds.map(x => x.roce ?? null) },
  ] });

  const bn = v => (v == null ? null : v / 1e6);
  lineChart($("#chart-balance"), { labels, zeroLine: true, yFmt: v => `${Number.isInteger(v) ? v : v.toFixed(1)}bn`, series: [
    { name: "Cash", color: "var(--series-1)", values: ds.map(x => bn(x.cash)) },
    { name: "LT debt", color: "var(--series-2)", values: ds.map(x => bn(x.ltDebt)) },
    { name: "ST debt", color: "var(--series-3)", values: ds.map(x => bn(x.stDebt)) },
  ] });

  lineChart($("#chart-share"), { labels, yFmt: pctFmt, series: AREAS.map((a, i) => ({
    name: a, color: `var(--series-${i + 1})`, values: ds.map(x => x[`share${a}`] ?? null),
  })) });

  $("#fill-sub").textContent = `${round.label}. Europe first, always.`;
  fillBars($("#chart-fill"), ["Europe", "USA", "China"].map(a => ({ label: a, sold: d[`sold_${a}_Hybrid`], demand: d[`dem_${a}_Hybrid`] })));
}

function ring(good, total) {
  const r = 30, c = 2 * Math.PI * r, f = total ? good / total : 0;
  return `<svg class="ring" width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
    <circle class="bg" cx="38" cy="38" r="${r}" fill="none" stroke-width="8"/>
    <circle class="fg" cx="38" cy="38" r="${r}" fill="none" stroke-width="8" stroke-dasharray="${(f * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 38 38)"/>
    <text x="38" y="45" text-anchor="middle">${Math.round(f * 100)}%</text></svg>`;
}

function renderScorecard(d) {
  const persp = SCORECARD.map(p => {
    const st = p.kpis.map(k => (d[k.key] == null ? "none" : kpiStatus(k, d)));
    const scored = st.filter(s => s !== "none");
    return { p, st, good: scored.filter(s => s === "good").length, scored: scored.length };
  });
  const good = persp.reduce((a, x) => a + x.good, 0), scored = persp.reduce((a, x) => a + x.scored, 0);
  const bad = persp.reduce((a, x) => a + x.st.filter(s => s === "bad").length, 0);
  $("#bsc-summary").innerHTML = `
    <div class="panel score-card overall">${ring(good, scored)}
      <div><div class="k">KPIs on target</div><div class="v">${good}<small> / ${scored}</small></div>
      <div class="muted">${bad ? `<span class="status bad"><span class="ic"></span>${bad} off target</span>` : `<span class="status good"><span class="ic"></span>Nothing off target</span>`}</div></div>
    </div>` + persp.map(x => `
    <div class="panel score-card">
      <div class="k">${x.p.title}</div>
      <div class="v">${x.good}<small> / ${x.scored || "–"}</small></div>
      <div class="seg">${x.st.map(s => `<span class="${s}"></span>`).join("")}</div>
    </div>`).join("");

  $("#bsc").innerHTML = persp.map((x, n) => {
    const rows = x.p.kpis.map((k, i) => {
      const prev = d._prev ? d._prev[k.key] : null;
      const prevTxt = d[k.key] != null && prev != null ? `<span class="prev">${fmt(prev, k.fmt)} last round</span>` : "";
      const color = x.st[i] === "bad" ? "var(--bad)" : x.st[i] === "good" ? "var(--good)" : x.st[i] === "warn" ? "var(--warn)" : "var(--series-1)";
      return `<tr>
        <td><div class="kpi-name">${k.label}</div><span class="tgt-mobile">${k.text}</span></td>
        <td class="val">${fmt(d[k.key], k.fmt)}${prevTxt}</td>
        <td class="tgt">${k.text}</td>
        <td>${sparkline(series(k.key), color, 84, 26)}</td>
        <td>${statusTag(x.st[i], d[k.key] == null)}</td></tr>`;
    }).join("");
    return `<article class="panel persp">
      <div class="persp-head"><div><h2><span class="persp-num">${n + 1}</span>${x.p.title}</h2><p class="muted">${x.p.question}</p></div>
        <div class="pill-score">${x.scored ? `<b>${x.good}</b> / ${x.scored} on target` : "No data"}</div></div>
      <table class="kpi-table"><thead><tr><th>KPI</th><th>Actual</th><th>Target</th><th>Trend</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    </article>`;
  }).join("");
}

function renderTable() {
  const cols = state.rounds;
  let html = `<thead><tr><th>Field</th>${cols.map(r => `<th>${r.label}</th>`).join("")}</tr></thead><tbody>`;
  let group = null;
  RAW_FIELDS.forEach(f => {
    if (!cols.some(r => r.kpi && r.kpi[f.key] != null)) return;
    if (f.group !== group) { group = f.group; html += `<tr class="group"><td colspan="${cols.length + 1}">${group}</td></tr>`; }
    html += `<tr><td>${f.label}</td>${cols.map(r => `<td>${r.kpi[f.key] != null ? fmt(r.kpi[f.key]) : "–"}</td>`).join("")}</tr>`;
  });
  $("#data-table").innerHTML = html + "</tbody>";
}

/* ---------- import dialog ---------- */
let pending = null;
function roundOptions(sel, current) {
  sel.innerHTML = ROUND_IDS.map(r => `<option value="${r.id}"${r.id === current ? " selected" : ""}>${r.label}${state.rounds.some(x => x.id === r.id) ? " (has data)" : ""}</option>`).join("");
}
function nextRoundId() {
  const real = state.rounds.filter(r => !r.practice);
  if (!real.length) return "R1";
  const last = +real.slice(-1)[0].id.slice(1);
  return `R${Math.min(9, last + 1)}`;
}
function openImport() {
  pending = null;
  roundOptions($("#imp-round"), nextRoundId());
  $("#imp-team").value = state.team;
  $("#imp-files").value = "";
  $("#imp-result").innerHTML = "";
  $("#imp-save").disabled = true;
  $("#dlg-import").showModal();
}
async function handleFiles(files) {
  if (typeof XLSX === "undefined") { $("#imp-result").innerHTML = `<p class="imp-note err">The Excel reader did not load. Check the internet connection and reload.</p>`; return; }
  const team = $("#imp-team").value.trim() || "Green Day";
  let facts = [];
  for (const f of files) {
    try { facts = facts.concat(readWorkbook(await f.arrayBuffer(), team)); }
    catch (e) { $("#imp-result").innerHTML = `<p class="imp-note err">Could not read ${f.name}: ${e.message}</p>`; return; }
  }
  const res = extract(facts, team);
  pending = { team, res };
  const labelOf = k => (RAW_FIELDS.find(f => f.key === k) || { label: k }).label;
  const missing = ["tsr", "sharePrice", "eps", "profit", "stDebt", "equityRatio", "dem_Europe_Hybrid"].filter(k => res.kpi[k] == null);
  $("#imp-result").innerHTML = res.found.length
    ? `<p class="imp-note">Found <b>${res.found.length}</b> numbers for <b>${team}</b>${Object.keys(res.teams).length ? ` and TSR for ${Object.keys(res.teams).length} teams` : ""}.
       ${missing.length ? `Still missing: ${missing.map(labelOf).join(", ")}. Add it with Edit numbers.` : ""}</p>
       <table class="imp-table">${res.found.map(f => `<tr><td>${labelOf(f.key)}</td><td>${fmt(f.value)}</td><td>${f.source}</td></tr>`).join("")}</table>`
    : `<p class="imp-note err">No numbers found for “${team}”. Check that the team name matches the column header in the export exactly.</p>`;
  $("#imp-save").disabled = !res.found.length && !Object.keys(res.teams).length;
}

/* ---------- edit dialog ---------- */
function openEdit() {
  const sel = $("#edit-round");
  roundOptions(sel, selected || nextRoundId());
  fillEdit(sel.value);
  sel.onchange = () => fillEdit(sel.value);
  $("#dlg-edit").showModal();
}
function fillEdit(id) {
  const r = getRound(id) || { kpi: {} };
  const groups = [...new Set(RAW_FIELDS.map(f => f.group))];
  $("#edit-fields").innerHTML = groups.map(g => `<div class="edit-group"><h4>${g}</h4><div class="edit-grid">${
    RAW_FIELDS.filter(f => f.group === g).map(f => `<label>${f.label}<input type="number" step="any" data-key="${f.key}" value="${r.kpi[f.key] ?? ""}"></label>`).join("")
  }</div></div>`).join("");
}

/* ---------- wiring ---------- */
function download() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "rounds.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function loadDemo() {
  state.rounds = state.rounds.filter(x => !x.practice).concat(JSON.parse(JSON.stringify(PRACTICE_DEMO.rounds)));
  sortRounds(); selected = null; save(); render();
}
function route() {
  const v = location.hash.replace("#", "");
  view = VIEWS[v] ? v : "dashboard";
  render();
  window.scrollTo(0, 0);
}

function init() {
  $("#btn-import").onclick = openImport;
  $("#btn-import-2").onclick = openImport;
  $("#btn-edit").onclick = openEdit;
  $("#btn-edit-2").onclick = openEdit;
  $("#btn-download").onclick = download;
  $("#btn-demo").onclick = loadDemo;
  $("#btn-demo-2").onclick = loadDemo;
  $("#btn-reset").onclick = () => {
    if (!confirm("Clear the rounds stored in this browser? The shared data/rounds.json loads again on reload.")) return;
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    location.reload();
  };
  $("#file-json").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); if (!Array.isArray(d.rounds)) throw new Error("no rounds"); state = d; sortRounds(); selected = null; save(); render(); }
    catch (err) { alert("That file is not a dashboard data.json."); }
  };
  $("#show-practice").onchange = render;
  window.addEventListener("hashchange", route);

  $("#imp-files").onchange = e => handleFiles([...e.target.files]);
  const drop = $("#drop");
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); handleFiles([...e.dataTransfer.files]); });
  $("#dlg-import").addEventListener("close", () => {
    if ($("#dlg-import").returnValue !== "save" || !pending) return;
    state.team = pending.team;
    const r = getRound($("#imp-round").value, true);
    r.team = pending.team;
    mergeImport(r, pending.res, $("#imp-overwrite").checked);
    selected = r.id; save(); render();
  });
  $("#dlg-edit").addEventListener("close", () => {
    const rv = $("#dlg-edit").returnValue, id = $("#edit-round").value;
    if (rv === "delete") {
      if (confirm("Delete this round's numbers?")) { state.rounds = state.rounds.filter(r => r.id !== id); selected = null; save(); render(); }
      return;
    }
    if (rv !== "save") return;
    const r = getRound(id, true);
    document.querySelectorAll("#edit-fields input").forEach(i => {
      const v = i.value.trim();
      if (v === "") delete r.kpi[i.dataset.key]; else r.kpi[i.dataset.key] = parseFloat(v);
    });
    selected = id; save(); render();
  });
  let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(render, 150); });
  load().then(route);
}

init();
