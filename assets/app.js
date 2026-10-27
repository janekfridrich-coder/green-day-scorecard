/* Green Day Scorecard: state, rendering and dialogs. */

const STORE_KEY = "green-day-scorecard-v1";
const ROUND_IDS = [
  { id: "P1", label: "Practice 1", practice: true },
  { id: "P2", label: "Practice 2", practice: true },
  ...Array.from({ length: 9 }, (_, i) => ({ id: `R${i + 1}`, label: `Round ${i + 1}`, practice: false })),
];
const STATUS_TEXT = { good: "On target", warn: "Watch", bad: "Off target", none: "No target" };

let state = { team: "Green Day", rounds: [] };
let selected = null;
const $ = s => document.querySelector(s);

/* ---------- storage ---------- */
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ }
}
async function load() {
  try {
    const s = localStorage.getItem(STORE_KEY);
    if (s) { state = JSON.parse(s); return; }
  } catch (e) { /* ignore */ }
  try {
    const res = await fetch("data/rounds.json", { cache: "no-store" });
    if (res.ok) { const d = await res.json(); if (d && Array.isArray(d.rounds)) state = d; }
  } catch (e) { /* opened from disk: no fetch */ }
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

/* ---------- render ---------- */
function render() {
  $("#team-label").textContent = state.team;
  const has = state.rounds.length > 0;
  $("#empty").hidden = has;
  $("#content").hidden = !has;
  $(".round-bar").hidden = !has;
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

  renderTiles(d);
  renderRules(d);
  renderScorecard(d);
  renderCharts(round, d);
  renderTable();
}

function delta(v, p, kind, invert) {
  if (v == null || p == null) return `<div class="d">No earlier round</div>`;
  const diff = v - p;
  const up = invert ? diff < 0 : diff > 0;
  const cls = diff === 0 ? "" : up ? "up" : "down";
  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "■";
  const txt = kind === "pct" ? `${Math.abs(diff).toFixed(1)} pts` : kind === "bn" ? `USD ${(Math.abs(diff) / 1e6).toFixed(1)}bn` : kind === "usd2" ? `USD ${Math.abs(diff).toFixed(2)}` : Math.abs(diff).toFixed(2);
  return `<div class="d ${cls}">${arrow} ${txt} vs last round</div>`;
}

function renderTiles(d) {
  const p = d._prev || {};
  const rank = d.rank ? `Rank ${d.rank} of ${d.teamsCount} in universe` : "Rank: import the Ratios page";
  $("#tiles").innerHTML = [
    { k: "Cumulative TSR p.a.", v: fmt(d.tsr, "pct"), d: `<div class="d">${rank}</div>` },
    { k: "Share price", v: fmt(d.sharePrice, "usd2").replace("USD ", "$"), d: delta(d.sharePrice, p.sharePrice, "usd2") },
    { k: "EPS", v: fmt(d.eps, "usd2").replace("USD ", "$"), d: delta(d.eps, p.eps, "usd2") },
    { k: "Profit for the round", v: d.profit != null ? `$${(d.profit / 1e6).toFixed(1)}bn` : "–", d: delta(d.profit, p.profit, "bn") },
  ].map(t => `<div class="card tile"><div class="k">${t.k}</div><div class="v">${t.v}</div>${t.d}</div>`).join("");
}

function statusTag(s, missing) {
  return `<span class="status ${s}"><span class="ic">${statusIcon(s)}</span>${missing ? "No data" : STATUS_TEXT[s]}</span>`;
}

function renderRules(d) {
  $("#rules").innerHTML = RULE_CHECKS.map(c => {
    const res = c.test(d);
    const s = res == null ? "none" : res ? "good" : "bad";
    const word = res == null ? "No data" : res ? "Pass" : "Fail";
    return `<li><span class="status ${s}"><span class="ic">${statusIcon(s)}</span>${word}</span><span>${c.label}</span></li>`;
  }).join("");
}

function renderScorecard(d) {
  $("#bsc").innerHTML = SCORECARD.map(p => {
    const rows = p.kpis.map(k => {
      const s = kpiStatus(k, d);
      const prev = d._prev ? d._prev[k.key] : null;
      const dl = d[k.key] != null && prev != null ? `<span class="delta">${fmt(prev, k.fmt)} last round</span>` : "";
      return `<tr><td>${k.label}<span class="tgt-mobile">${k.text}</span></td><td class="val">${fmt(d[k.key], k.fmt)}${dl}</td><td class="tgt">${k.text}</td><td>${statusTag(s, d[k.key] == null)}</td></tr>`;
    }).join("");
    const scored = p.kpis.map(k => kpiStatus(k, d)).filter(s => s !== "none");
    const good = scored.filter(s => s === "good").length;
    return `<article class="card">
      <div class="persp-head"><div><h3>${p.title}</h3><p class="muted">${p.question}</p></div>
      <div class="persp-score">${scored.length ? `${good} of ${scored.length} on target` : "No data yet"}</div></div>
      <table class="kpi-table"><thead><tr><th>KPI</th><th>Value</th><th>Target</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    </article>`;
  }).join("");
}

function chartRounds() {
  const showPractice = $("#show-practice").checked || state.rounds.every(r => r.practice);
  return state.rounds.filter(r => showPractice || !r.practice);
}

function renderCharts(round, d) {
  const rounds = chartRounds();
  const labels = rounds.map(r => r.label.replace("Round ", "R").replace("Practice ", "P"));
  const ds = rounds.map(r => derive(r, prevOf(r)));
  const pctFmt = v => `${Math.round(v)}%`;

  const teamNames = [...new Set(rounds.flatMap(r => Object.keys(r.teams || {})))];
  const tsrSeries = teamNames.map(t => ({
    name: t, emphasis: t === state.team, muted: t !== state.team,
    color: t === state.team ? "var(--series-1)" : "var(--rival)",
    values: rounds.map(r => (r.teams && r.teams[t] && r.teams[t].tsr != null ? r.teams[t].tsr : null)),
  }));
  if (!tsrSeries.length) tsrSeries.push({ name: state.team, emphasis: true, color: "var(--series-1)", values: ds.map(x => x.tsr ?? null) });
  lineChart($("#chart-tsr"), { labels, series: tsrSeries, yFmt: pctFmt, zeroLine: true, height: 260 });

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
  if (typeof XLSX === "undefined") { $("#imp-result").innerHTML = `<p class="imp-note">The Excel reader did not load. Check the internet connection and reload.</p>`; return; }
  const team = $("#imp-team").value.trim() || "Green Day";
  let facts = [];
  for (const f of files) {
    try { facts = facts.concat(readWorkbook(await f.arrayBuffer(), team)); }
    catch (e) { $("#imp-result").innerHTML = `<p class="imp-note">Could not read ${f.name}: ${e.message}</p>`; return; }
  }
  const res = extract(facts, team);
  pending = { team, res };
  const labelOf = k => (RAW_FIELDS.find(f => f.key === k) || { label: k }).label;
  const missing = ["tsr", "sharePrice", "eps", "profit", "stDebt", "equityRatio", "dem_Europe_Hybrid"].filter(k => res.kpi[k] == null);
  $("#imp-result").innerHTML = res.found.length
    ? `<p class="imp-note">Found <b>${res.found.length}</b> numbers for <b>${team}</b>${Object.keys(res.teams).length ? ` and TSR for ${Object.keys(res.teams).length} teams` : ""}.
       ${missing.length ? `Still missing: ${missing.map(labelOf).join(", ")}. Import the page it lives on, or add it with Edit numbers.` : ""}</p>
       <table class="imp-table">${res.found.map(f => `<tr><td>${labelOf(f.key)}</td><td>${fmt(f.value)}</td><td>${f.source}</td></tr>`).join("")}</table>`
    : `<p class="imp-note">No numbers found for “${team}”. Check that the team name matches the column header in the export exactly.</p>`;
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

function init() {
  $("#btn-import").onclick = openImport;
  $("#btn-import-2").onclick = openImport;
  $("#btn-edit").onclick = openEdit;
  $("#btn-download").onclick = download;
  $("#btn-demo").onclick = loadDemo;
  $("#btn-demo-2").onclick = loadDemo;
  $("#btn-reset").onclick = () => {
    if (!confirm("Clear every round stored in this browser? Download data.json first if you need it.")) return;
    state = { team: state.team, rounds: [] }; selected = null; save(); render();
  };
  $("#file-json").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); if (!Array.isArray(d.rounds)) throw new Error("no rounds"); state = d; selected = null; save(); render(); }
    catch (err) { alert("That file is not a dashboard data.json."); }
  };
  $("#show-practice").onchange = render;

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
  load().then(render);
}

init();
