/* Small hand-rolled SVG charts: a line chart with crosshair tooltip, sparklines and sold-vs-demand bars. */

const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
let gradientId = 0;

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const step0 = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

function tooltip() {
  let t = document.getElementById("viz-tooltip");
  if (!t) { t = document.createElement("div"); t.id = "viz-tooltip"; t.className = "tooltip"; document.body.appendChild(t); }
  return t;
}

/* series: [{ name, values (null = gap), color, emphasis }] */
function lineChart(host, { labels, series, yFmt = v => v, zeroLine = false, height = 230 }) {
  host.innerHTML = "";
  const all = series.flatMap(s => s.values).filter(v => v != null);
  if (!all.length) { host.innerHTML = `<p class="empty">No data yet. Import a round to fill this chart.</p>`; return; }
  const W = Math.max(host.clientWidth || 520, 260), H = height;
  const labelAll = series.length <= 6;
  const m = { t: 14, r: labelAll || series.some(s => s.emphasis) ? 108 : 16, b: 28, l: 46 };
  let lo = Math.min(...all), hi = Math.max(...all);
  if (zeroLine) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const ticks = niceTicks(lo, hi);
  lo = ticks[0]; hi = ticks[ticks.length - 1];
  const x = i => m.l + (labels.length === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (labels.length - 1));
  const y = v => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: H, role: "img" });
  const defs = svgEl("defs");
  svg.appendChild(defs);
  ticks.forEach(t => {
    svg.appendChild(svgEl("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 && zeroLine ? "axis" : "grid" }));
    const tx = svgEl("text", { x: m.l - 10, y: y(t) + 4, "text-anchor": "end", class: "tick" });
    tx.textContent = yFmt(t); svg.appendChild(tx);
  });
  labels.forEach((l, i) => {
    const tx = svgEl("text", { x: x(i), y: H - 8, "text-anchor": "middle", class: "tick" });
    tx.textContent = l; svg.appendChild(tx);
  });

  const ends = [];
  [...series].sort((a, b) => (a.emphasis ? 1 : 0) - (b.emphasis ? 1 : 0)).forEach(s => {
    const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)]));
    let d = "", pen = false;
    pts.forEach(p => { if (!p) { pen = false; return; } d += `${pen ? "L" : "M"}${p[0]},${p[1]}`; pen = true; });
    const valid = pts.filter(Boolean);
    if (s.emphasis && valid.length > 1) {
      const id = `g${++gradientId}`;
      const g = svgEl("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 });
      g.appendChild(svgEl("stop", { offset: "0%", "stop-color": s.color, "stop-opacity": 0.28 }));
      g.appendChild(svgEl("stop", { offset: "100%", "stop-color": s.color, "stop-opacity": 0 }));
      defs.appendChild(g);
      const base = y(zeroLine ? 0 : lo);
      const area = `M${valid[0][0]},${base}` + valid.map(p => `L${p[0]},${p[1]}`).join("") + `L${valid[valid.length - 1][0]},${base}Z`;
      svg.appendChild(svgEl("path", { d: area, fill: `url(#${id})` }));
    }
    svg.appendChild(svgEl("path", { d, fill: "none", stroke: s.color, "stroke-width": s.emphasis ? 3 : 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    s.values.forEach((v, i) => {
      if (v != null) svg.appendChild(svgEl("circle", { cx: x(i), cy: y(v), r: s.emphasis ? 5 : 4, fill: s.color, stroke: "var(--panel)", "stroke-width": 2 }));
    });
    const li = s.values.map((v, i) => (v == null ? -1 : i)).filter(i => i >= 0).pop();
    if (li != null && li >= 0 && (s.emphasis || labelAll)) ends.push({ name: s.name, y: y(s.values[li]), x: x(li), strong: s.emphasis });
  });
  ends.sort((a, b) => a.y - b.y).forEach((e, i, arr) => { if (i && e.y - arr[i - 1].y < 14) e.y = arr[i - 1].y + 14; });
  ends.forEach(e => {
    const tx = svgEl("text", { x: e.x + 11, y: e.y + 4, class: e.strong ? "end-label strong" : "end-label" });
    tx.textContent = e.name; svg.appendChild(tx);
  });

  const cross = svgEl("line", { y1: m.t, y2: H - m.b, class: "crosshair", visibility: "hidden" });
  svg.appendChild(cross);
  const hit = svgEl("rect", { x: m.l - 10, y: 0, width: W - m.l - m.r + 20, height: H, fill: "transparent" });
  svg.appendChild(hit);
  const tip = tooltip();
  const show = ev => {
    const pt = svg.getBoundingClientRect();
    const px = ((ev.clientX - pt.left) / pt.width) * W;
    let i = 0, best = Infinity;
    labels.forEach((_, k) => { const dd = Math.abs(x(k) - px); if (dd < best) { best = dd; i = k; } });
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
    const rows = series.filter(s => s.values[i] != null).sort((a, b) => b.values[i] - a.values[i])
      .map(s => `<div class="tip-row"><span class="swatch" style="background:${s.color}"></span><span>${s.name}</span><b>${yFmt(s.values[i])}</b></div>`).join("");
    tip.innerHTML = `<div class="tip-title">${labels[i]}</div>${rows || "<div>No data</div>"}`;
    tip.style.display = "block";
    const tw = tip.offsetWidth;
    tip.style.left = Math.min(ev.clientX + 14, window.innerWidth - tw - 8) + "px";
    tip.style.top = ev.clientY + window.scrollY + 14 + "px";
  };
  hit.addEventListener("mousemove", show);
  hit.addEventListener("mouseleave", () => { tip.style.display = "none"; cross.setAttribute("visibility", "hidden"); });
  host.appendChild(svg);
}

/* Inline sparkline as an SVG string. */
function sparkline(values, color = "var(--series-1)", w = 96, h = 30) {
  const pts = values.map((v, i) => [i, v]).filter(p => p[1] != null);
  if (pts.length < 2) return `<svg class="spark" width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const vs = pts.map(p => p[1]);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (lo === hi) { lo -= 1; hi += 1; }
  const X = i => 3 + (i * (w - 6)) / Math.max(values.length - 1, 1);
  const Y = v => 3 + (1 - (v - lo) / (hi - lo)) * (h - 6);
  const line = pts.map((p, k) => `${k ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
  const area = `${line}L${X(pts[pts.length - 1][0]).toFixed(1)},${h}L${X(pts[0][0]).toFixed(1)},${h}Z`;
  const last = pts[pts.length - 1];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">` +
    `<path class="sa" d="${area}" fill="${color}" opacity="0.12"/><path class="sl" d="${line}" stroke="${color}"/>` +
    `<circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="3" fill="${color}"/></svg>`;
}

/* rows: [{ label, sold, demand }] */
function fillBars(host, rows) {
  host.innerHTML = "";
  const valid = rows.filter(r => r.demand != null && r.sold != null);
  if (!valid.length) { host.innerHTML = `<p class="empty">No market report imported for this round yet.</p>`; return; }
  valid.forEach(r => {
    const pct = r.demand ? (r.sold / r.demand) * 100 : 100;
    const st = pct >= 95 ? "good" : pct >= 80 ? "warn" : "bad";
    const lost = r.demand - r.sold;
    const row = document.createElement("div");
    row.className = "fill-row";
    row.innerHTML = `
      <div class="fill-top"><span class="fill-label">${r.label}</span><span class="fill-value"><b>${Math.round(r.sold)}k</b> sold of ${Math.round(r.demand)}k</span></div>
      <div class="fill-track"><div class="fill-bar ${st}" style="width:${r.demand ? Math.min(100, pct) : 0}%"></div></div>
      <div class="fill-foot"><span class="status ${st}"><span class="ic"></span>${pct.toFixed(0)}% served</span><span class="muted">${lost > 0.5 ? Math.round(lost) + "k cars lost" : "No cars lost"}</span></div>`;
    host.appendChild(row);
  });
}

function statusIcon() { return ""; }
