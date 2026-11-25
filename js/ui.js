/* ui.js — pembantu tampilan: format angka, tabel + CSV, unduhan, grafik SVG, penampil 3D. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SUBD = "₀₁₂₃₄₅₆₇₈₉";
const subf = (f) => String(f).replace(/\d/g, (d) => SUBD[+d]);
const SUPS = { "-": "⁻", "+": "", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const supn = (s) => String(+s).split("").map((c) => SUPS[c] ?? c).join("");
const fx = (v, d = 3) => (v == null || !isFinite(v) ? "–" : Number(v).toFixed(d));
function fe(v, d = 2) {
  if (v == null || !isFinite(v)) return "–";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e4 || a < 1e-2) { const [m, e] = v.toExponential(d - 1).split("e"); return `${m}×10${supn(e)}`; }
  return String(+v.toPrecision(d + 1));
}
const cssv = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/* ---------- tabel: satu spesifikasi untuk HTML, CSV, dan salin ---------- */
/* spec = {cols: [{h, f(row), d (desimal) | "e" (eksponen) | null (teks), html(row)?}], rows: [...] } */
function cellText(c, row, locale = "en") {
  const v = c.f(row);
  if (v == null || (typeof v === "number" && !isFinite(v))) return "";
  if (typeof v !== "number") return String(v);
  let s = c.d === "e" ? v.toExponential(3) : c.d != null ? v.toFixed(c.d) : String(v);
  if (locale === "id") s = s.replace(".", ",");
  return s;
}
function tableHTML(spec, opts = {}) {
  if (!spec.rows.length) return `<p class="empty">${opts.empty || "Belum ada data."}</p>`;
  return `<div class="scroll"><table class="${opts.cls || ""}"><thead><tr>${spec.cols.map((c) => `<th class="${c.d != null ? "r" : ""}">${c.hh || esc(c.h)}</th>`).join("")}</tr></thead><tbody>` +
    spec.rows.map((row) => `<tr class="${opts.rowCls ? opts.rowCls(row) : ""}">` + spec.cols.map((c) => {
      if (c.html) return `<td class="${c.d != null ? "r num" : ""}">${c.html(row)}</td>`;
      const v = c.f(row);
      const t = v == null || (typeof v === "number" && !isFinite(v)) ? "–" : typeof v === "number" ? (c.d === "e" ? fe(v) : c.d != null ? v.toFixed(c.d) : String(v)) : esc(v);
      return `<td class="${c.d != null ? "r num" : ""}">${t}</td>`;
    }).join("") + "</tr>").join("") + `</tbody></table></div>`;
}
function tableCSV(spec, locale = "en") {
  const sep = locale === "id" ? ";" : ",";
  const q = (s) => (/[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [spec.cols.map((c) => q(c.h)).join(sep), ...spec.rows.map((r) => spec.cols.map((c) => q(cellText(c, r, locale))).join(sep))].join("\r\n");
}
function tableTSV(spec) {
  return [spec.cols.map((c) => c.h).join("\t"), ...spec.rows.map((r) => spec.cols.map((c) => cellText(c, r)).join("\t"))].join("\n");
}

/* ---------- unduhan ---------- */
function download(name, data, mime) {
  const blob = data instanceof Blob ? data : new Blob([mime.startsWith("text/csv") ? "﻿" + data : data], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const DL = {};   // id -> fungsi pembuat unduhan, dipanggil dari tombol
let _dl = 0;
function dlButton(label, make, title = "") {
  const id = "dl" + ++_dl;
  DL[id] = make;
  return `<button class="dl" data-dl="${id}" title="${esc(title)}">${label}</button>`;
}
/* blok unduhan untuk satu tabel: CSV, CSV gaya Excel Indonesia, salin */
function tableDownloads(spec, base) {
  return dlButton("CSV", () => download(base + ".csv", tableCSV(spec, "en"), "text/csv;charset=utf-8"), "pemisah koma, desimal titik") +
    dlButton("CSV (Excel Indonesia)", () => download(base + "_id.csv", tableCSV(spec, "id"), "text/csv;charset=utf-8"), "pemisah titik koma, desimal koma") +
    dlButton("Salin", async (btn) => { try { await navigator.clipboard.writeText(tableTSV(spec)); flash(btn, "Tersalin"); } catch { flash(btn, "Gagal menyalin"); } }, "salin untuk ditempel ke Excel / LibreOffice / Word");
}
function flash(btn, t) { const o = btn.textContent; btn.textContent = t; setTimeout(() => (btn.textContent = o), 1400); }
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-dl]");
  if (b && DL[b.dataset.dl]) DL[b.dataset.dl](b);
});

/* ---------- warna grafik: variabel CSS di layar, warna tetap (tema terang) saat diunduh ---------- */
const PAL_LIT = { ink: "#15202b", muted: "#5a6877", line: "#dbe1e7", bg: "#ffffff", accent: "#2456c8", neg: "#c4402e", s3: "#1d7f48", s4: "#b07a12", soft: "#e3ebfb" };
const PAL_VAR = { ink: "var(--ink)", muted: "var(--muted)", line: "var(--line)", bg: "var(--panel)", accent: "var(--accent)", neg: "var(--lobe-neg)", s3: "var(--good)", s4: "var(--warn)", soft: "var(--accent-soft)" };
const SERIES = (p) => [p.accent, p.neg, p.s3, p.s4];
function niceTicks(lo, hi, n = 5) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const t = []; for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.001; v += step) t.push(+v.toFixed(10));
  return t;
}
const tnum = (v) => String(+v.toFixed(6));

/* Grafik batang (satu atau beberapa seri). labels: kategori; series: [{name, values}] */
function barChart({ labels, series, ylab, p = PAL_VAR, width = 680, height = 340, title = "" }) {
  const ml = 64, mr = 16, mt = title ? 46 : 22, mb = 70 + (series.length > 1 ? 22 : 0);
  const all = series.flatMap((s) => s.values).filter((v) => v != null && isFinite(v));
  if (!all.length) return `<p class="empty">Belum ada nilai untuk digambar.</p>`;
  const lo0 = Math.min(0, ...all), hi0 = Math.max(0, ...all), pad = (hi0 - lo0) * 0.1;   // ruang untuk label nilai
  const ticks = niceTicks(lo0 < 0 ? lo0 - pad : 0, hi0 > 0 ? hi0 + pad : 0, 5);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const Y = (v) => mt + (1 - (v - lo) / (hi - lo)) * (height - mt - mb);
  const gw = (width - ml - mr) / labels.length, bw = Math.min(46, (gw * 0.7) / series.length);
  const col = SERIES(p);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(title || ylab)}" font-family="IBM Plex Sans, Arial, sans-serif"><rect width="${width}" height="${height}" fill="${p.bg}"/>`;
  if (title) s += `<text x="${ml}" y="20" font-size="14" font-weight="600" fill="${p.ink}">${esc(title)}</text>`;
  ticks.forEach((v) => { s += `<line x1="${ml}" x2="${width - mr}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? p.muted : p.line}" stroke-width="1"/><text x="${ml - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="${p.muted}">${tnum(v)}</text>`; });
  s += `<text x="14" y="${(mt + height - mb) / 2}" text-anchor="middle" font-size="12" fill="${p.muted}" transform="rotate(-90 14 ${(mt + height - mb) / 2})">${esc(ylab)}</text>`;
  labels.forEach((lab, i) => {
    const gx = ml + i * gw + gw / 2;
    series.forEach((se, k) => {
      const v = se.values[i];
      if (v == null || !isFinite(v)) return;
      const x = gx - (series.length * bw) / 2 + k * bw;
      const y0 = Y(0), y1 = Y(v);
      s += `<rect x="${x + 1}" y="${Math.min(y0, y1)}" width="${bw - 2}" height="${Math.max(1, Math.abs(y1 - y0))}" fill="${col[k % col.length]}" rx="2"/>`;
      if (labels.length * series.length <= 24) s += `<text x="${x + bw / 2}" y="${v >= 0 ? y1 - 4 : y1 + 12}" text-anchor="middle" font-size="10" fill="${p.ink}">${Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)}</text>`;
    });
    s += `<text x="${gx}" y="${height - mb + 16}" text-anchor="end" font-size="11" fill="${p.ink}" transform="rotate(-30 ${gx} ${height - mb + 16})">${esc(subf(lab))}</text>`;
  });
  if (series.length > 1) {
    let lx = ml;
    series.forEach((se, k) => { s += `<rect x="${lx}" y="${height - 16}" width="12" height="12" fill="${col[k % col.length]}" rx="2"/><text x="${lx + 17}" y="${height - 6}" font-size="11" fill="${p.ink}">${esc(se.name)}</text>`; lx += 30 + se.name.length * 7; });
  }
  return s + `</svg>`;
}

/* Diagram tingkat energi HOMO/LUMO: untuk tiap sistem dua kolom (klaster, kompleks). */
function levelDiagram({ items, p = PAL_VAR, title = "" }) {
  // items: [{label, a: {HOMO, LUMO, name}, b: {HOMO, LUMO, name}}]
  const colW = 128, ml = 58, mt = title ? 38 : 18, mb = 64;
  const width = ml + items.length * colW + 12, height = 380;
  const all = items.flatMap((it) => [it.a, it.b].flatMap((o) => [o?.HOMO, o?.LUMO])).filter((v) => v != null);
  if (!all.length) return `<p class="empty">Belum ada data orbital.</p>`;
  const ticks = niceTicks(Math.min(...all) - 0.5, Math.max(...all) + 0.5, 6);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const Y = (v) => mt + (1 - (v - lo) / (hi - lo)) * (height - mt - mb);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Diagram HOMO LUMO" font-family="IBM Plex Sans, Arial, sans-serif"><rect width="${width}" height="${height}" fill="${p.bg}"/>`;
  if (title) s += `<text x="${ml}" y="22" font-size="14" font-weight="600" fill="${p.ink}">${esc(title)}</text>`;
  ticks.forEach((v) => { s += `<line x1="${ml}" x2="${width - 12}" y1="${Y(v)}" y2="${Y(v)}" stroke="${p.line}"/><text x="${ml - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="${p.muted}">${tnum(v)}</text>`; });
  s += `<text x="14" y="${(mt + height - mb) / 2}" text-anchor="middle" font-size="12" fill="${p.muted}" transform="rotate(-90 14 ${(mt + height - mb) / 2})">energi (eV)</text>`;
  items.forEach((it, i) => {
    const x0 = ml + i * colW;
    [[it.a, 8], [it.b, 66]].forEach(([o, off], k) => {
      if (!o || o.HOMO == null) return;
      const xa = x0 + off, xb = xa + 46;
      s += `<line x1="${xa}" x2="${xb}" y1="${Y(o.HOMO)}" y2="${Y(o.HOMO)}" stroke="${p.accent}" stroke-width="3"/>`;
      s += `<line x1="${xa}" x2="${xb}" y1="${Y(o.LUMO)}" y2="${Y(o.LUMO)}" stroke="${p.neg}" stroke-width="3"/>`;
      s += `<line x1="${xa + 23}" x2="${xa + 23}" y1="${Y(o.HOMO) - 3}" y2="${Y(o.LUMO) + 3}" stroke="${p.muted}" stroke-dasharray="3 3"/>`;
      s += `<text x="${xa + 23}" y="${(Y(o.HOMO) + Y(o.LUMO)) / 2 + 4}" text-anchor="middle" font-size="10.5" fill="${p.ink}" paint-order="stroke" stroke="${p.bg}" stroke-width="3">${(o.LUMO - o.HOMO).toFixed(2)}</text>`;
      s += `<text x="${xa + 23}" y="${height - mb + 14}" text-anchor="middle" font-size="10" fill="${p.muted}">${k ? "kompleks" : "klaster"}</text>`;
    });
    s += `<text x="${x0 + colW / 2 - 6}" y="${height - mb + 34}" text-anchor="middle" font-size="11.5" font-weight="600" fill="${p.ink}">${esc(subf(it.label))}</text>`;
  });
  s += `<line x1="${ml}" x2="${ml + 22}" y1="${height - 12}" y2="${height - 12}" stroke="${p.accent}" stroke-width="3"/><text x="${ml + 28}" y="${height - 8}" font-size="11" fill="${p.ink}">HOMO</text>`;
  s += `<line x1="${ml + 84}" x2="${ml + 106}" y1="${height - 12}" y2="${height - 12}" stroke="${p.neg}" stroke-width="3"/><text x="${ml + 112}" y="${height - 8}" font-size="11" fill="${p.ink}">LUMO (angka = E_gap, eV)</text>`;
  return s + `</svg>`;
}

/* Grafik garis sederhana (optimasi). */
function lineChart({ xs, ys, xlab, ylab, p = PAL_VAR, width = 560, height = 230 }) {
  const ml = 60, mr = 14, mt = 12, mb = 40;
  const yt = niceTicks(Math.min(0, ...ys), Math.max(...ys), 5), lo = yt[0], hi = yt[yt.length - 1];
  const X = (i) => ml + ((xs[i] - xs[0]) / (xs[xs.length - 1] - xs[0] || 1)) * (width - ml - mr);
  const Y = (v) => mt + (1 - (v - lo) / (hi - lo)) * (height - mt - mb);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(ylab)}" font-family="IBM Plex Sans, Arial, sans-serif"><rect width="${width}" height="${height}" fill="${p.bg}"/>`;
  yt.forEach((v) => { s += `<line x1="${ml}" x2="${width - mr}" y1="${Y(v)}" y2="${Y(v)}" stroke="${p.line}"/><text x="${ml - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="${p.muted}">${tnum(v)}</text>`; });
  niceTicks(xs[0], xs[xs.length - 1], 6).filter((v) => v >= xs[0] && v <= xs[xs.length - 1] && Number.isInteger(v)).forEach((v) => {
    const x = ml + ((v - xs[0]) / (xs[xs.length - 1] - xs[0] || 1)) * (width - ml - mr);
    s += `<text x="${x}" y="${height - mb + 16}" text-anchor="middle" font-size="11" fill="${p.muted}">${v}</text>`;
  });
  s += `<text x="${(ml + width - mr) / 2}" y="${height - 6}" text-anchor="middle" font-size="11" fill="${p.muted}">${esc(xlab)}</text>`;
  s += `<text x="14" y="${(mt + height - mb) / 2}" text-anchor="middle" font-size="11" fill="${p.muted}" transform="rotate(-90 14 ${(mt + height - mb) / 2})">${esc(ylab)}</text>`;
  const d = ys.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  s += `<path d="${d} L${X(ys.length - 1)},${Y(lo)} L${X(0)},${Y(lo)} Z" fill="${p.soft}"/><path d="${d}" fill="none" stroke="${p.accent}" stroke-width="2"/>`;
  s += `<circle cx="${X(ys.length - 1)}" cy="${Y(ys[ys.length - 1])}" r="4" fill="${p.accent}"/>`;
  return s + `</svg>`;
}

/* Spektrum IR dengan pelebaran Lorentz (FWHM 20 cm-1). */
function irChart({ ir, p = PAL_VAR, width = 560, height = 220 }) {
  const ml = 14, mr = 14, mt = 10, mb = 38, g = 10;
  const xmax = Math.max(4000, ...ir.map((x) => x.nu + 100));
  const X = (nu) => ml + (1 - nu / xmax) * (width - ml - mr);
  const spec = [];
  for (let nu = 0; nu <= xmax; nu += 4) spec.push([nu, ir.reduce((a, q) => a + q.int * g * g / ((nu - q.nu) ** 2 + g * g), 0)]);
  const ymax = Math.max(...spec.map((q) => q[1])) || 1, imax = Math.max(...ir.map((q) => q.int)) || 1;
  const Y = (v) => mt + (1 - v / ymax) * (height - mt - mb);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Spektrum IR" font-family="IBM Plex Sans, Arial, sans-serif"><rect width="${width}" height="${height}" fill="${p.bg}"/>`;
  niceTicks(0, xmax, 8).forEach((v) => { if (v > xmax) return; s += `<line x1="${X(v)}" x2="${X(v)}" y1="${mt}" y2="${height - mb}" stroke="${p.line}"/><text x="${X(v)}" y="${height - mb + 14}" text-anchor="middle" font-size="10" fill="${p.muted}">${v}</text>`; });
  s += `<text x="${width / 2}" y="${height - 6}" text-anchor="middle" font-size="11" fill="${p.muted}">bilangan gelombang (cm⁻¹)</text>`;
  ir.forEach((q) => { s += `<line x1="${X(q.nu)}" x2="${X(q.nu)}" y1="${Y(0)}" y2="${Y(q.int / imax * ymax * 0.98)}" stroke="${p.neg}" opacity="0.55"/>`; });
  s += `<path d="${spec.map((q, i) => `${i ? "L" : "M"}${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join("")}" fill="none" stroke="${p.accent}" stroke-width="1.8"/>`;
  return s + `</svg>`;
}

/* blok grafik: tampil di layar + tombol unduh SVG/PNG (versi warna tetap) */
function chartBlock(make, base) {
  return `<figure class="chart">${make(PAL_VAR)}</figure><div class="dlrow">` +
    dlButton("SVG", () => download(base + ".svg", make(PAL_LIT), "image/svg+xml")) +
    dlButton("PNG", () => svgToPng(make(PAL_LIT), base + ".png")) + `</div>`;
}
function svgToPng(svgText, name, scale = 3) {
  const vb = svgText.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const w = +vb[1], h = +vb[2];
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgText.replace(/width="100%"/, `width="${w}" height="${h}"`)], { type: "image/svg+xml" }));
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = w * scale; c.height = h * scale;
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    c.toBlob((b) => download(name, b, "image/png"), "image/png");
  };
  img.src = url;
}

/* ---------- penampil struktur 3D (canvas) ---------- */
function rotX(t) { return [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]]; }
function rotY(t) { return [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]]; }
function mmul(A, B) { return A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j])); }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
  return `rgb(${c.join(",")})`;
}
/* atoms; opts: {labels, distLabels: "semua"|"situs"|"tidak", contacts: [{i,j,d}], highlight:Set, center, radius} */
function drawMolecule(ctx, w, h, atoms, rot, opts, theme) {
  const center = opts.center, R0 = opts.radius;
  const P = atoms.map((a) => [a.x - center[0], a.y - center[1], a.z - center[2]]);
  const sc = Math.min(w, h) / (2.2 * R0);
  const Q = P.map((p) => { const q = [0, 1, 2].map((i) => rot[i][0] * p[0] + rot[i][1] * p[1] + rot[i][2] * p[2]); return { x: w / 2 + q[0] * sc, y: h / 2 - q[1] * sc, z: q[2] }; });
  const rad = (el) => (0.18 + 0.3 * (RCOV[el] ?? 1)) * sc * (el === "H" ? 0.8 : 1);
  const bonds = findBonds(atoms);
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, w, h);
  const items = [];
  bonds.forEach((b) => items.push({ z: (Q[b.i].z + Q[b.j].z) / 2 - 0.01, b }));
  (opts.contacts || []).forEach((c) => items.push({ z: (Q[c.i].z + Q[c.j].z) / 2 - 0.01, c }));
  Q.forEach((q, i) => items.push({ z: q.z, i }));
  items.sort((a, b) => a.z - b.z);
  for (const it of items) {
    if (it.b) {
      const a = Q[it.b.i], b = Q[it.b.j], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      ctx.lineCap = "round"; ctx.lineWidth = Math.max(2, 0.15 * sc); ctx.setLineDash([]);
      ctx.strokeStyle = ELCOLOR[atoms[it.b.i].el] ?? "#c0a0ff"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(m.x, m.y); ctx.stroke();
      ctx.strokeStyle = ELCOLOR[atoms[it.b.j].el] ?? "#c0a0ff"; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else if (it.c) {
      const a = Q[it.c.i], b = Q[it.c.j];
      ctx.lineWidth = Math.max(1.5, 0.06 * sc); ctx.setLineDash([6, 5]); ctx.strokeStyle = theme.muted;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    } else {
      const q = Q[it.i], el = atoms[it.i].el, rr = rad(el), col = ELCOLOR[el] ?? "#c0a0ff";
      const gr = ctx.createRadialGradient(q.x - rr * 0.35, q.y - rr * 0.35, rr * 0.1, q.x, q.y, rr);
      gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.25, col); gr.addColorStop(1, shade(col, -0.45));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, rr, 0, 2 * Math.PI); ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = theme.line; ctx.stroke();
    }
  }
  const fs = Math.max(10, Math.min(15, 0.3 * sc));
  const label = (t, x, y, color) => {
    ctx.font = `600 ${fs}px "IBM Plex Mono", monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 4; ctx.strokeStyle = theme.bg; ctx.strokeText(t, x, y); ctx.fillStyle = color; ctx.fillText(t, x, y);
  };
  if (opts.distLabels && opts.distLabels !== "tidak") {
    const hl = opts.highlight || new Set();
    const list = bonds.map((b) => ({ ...b, contact: false })).concat((opts.contacts || []).map((c) => ({ ...c, contact: true })));
    for (const b of list) {
      if (opts.distLabels === "situs" && !(hl.has(b.i) || hl.has(b.j))) continue;
      label(b.d.toFixed(2), (Q[b.i].x + Q[b.j].x) / 2, (Q[b.i].y + Q[b.j].y) / 2, b.contact ? theme.accent : theme.ink);
    }
  }
  if (opts.labels) Q.forEach((q, i) => label(`${atoms[i].el}${i}`, q.x, q.y - rad(atoms[i].el) - fs * 0.8, theme.muted));
}
/* Pasang penampil interaktif pada elemen .viewer; kembalikan fungsi gambar ulang dan ekspor PNG. */
/* Orientasi baku: normal bidang terbaik atom-atom `plane` mengarah ke pengamat, sumbu atas menuju titik `up`,
   lalu dimiringkan 35 derajat (sama seperti gambar VMD laporan). */
function orientFrame(plane, up) {
  const c = ["x", "y", "z"].map((k) => plane.reduce((s, p) => s + p[k], 0) / plane.length);
  const pts = plane.map((p) => [p.x - c[0], p.y - c[1], p.z - c[2]]);
  const C = [0, 1, 2].map((i) => [0, 1, 2].map((j) => pts.reduce((s, p) => s + p[i] * p[j], 0)));
  const tr = C[0][0] + C[1][1] + C[2][2];
  const M = C.map((row, i) => row.map((v, j) => (i === j ? tr : 0) - v));
  let z = [0.3, 0.5, 0.8];
  for (let k = 0; k < 200; k++) { const w = [0, 1, 2].map((i) => M[i][0] * z[0] + M[i][1] * z[1] + M[i][2] * z[2]); const n = Math.hypot(...w) || 1; z = w.map((v) => v / n); }
  let y = up ? [up.x - c[0], up.y - c[1], up.z - c[2]] : [1, 0, 0];
  const dz = y[0] * z[0] + y[1] * z[1] + y[2] * z[2];
  y = y.map((v, i) => v - dz * z[i]);
  if (Math.hypot(...y) < 1e-6) y = [z[1], -z[0], 0];
  const ny = Math.hypot(...y) || 1; y = y.map((v) => v / ny);
  const x = [y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]];
  return mmul(rotX(-35 * Math.PI / 180), [x, y, z]);
}
function mountViewer(box, atoms, getOpts, rotInit, view = {}) {
  const cv = box.querySelector("canvas");
  const c = view.center || ["x", "y", "z"].map((k) => atoms.reduce((s, p) => s + p[k], 0) / atoms.length);
  const R0 = view.radius || Math.max(1.6, ...atoms.map((a) => Math.hypot(a.x - c[0], a.y - c[1], a.z - c[2])));
  let rot = rotInit ? rotInit.map((r) => r.slice()) : orientFrame(atoms.filter((a) => a.el !== "H"), null);
  const themeScreen = () => ({ bg: cssv("--soft") || "#eef2f6", ink: cssv("--ink") || "#000", muted: cssv("--muted") || "#555", line: cssv("--line") || "#ccc", accent: cssv("--accent") || "#2456c8" });
  const draw = () => {
    const dpr = window.devicePixelRatio || 1, w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMolecule(ctx, w, h, atoms, rot, { ...getOpts(), center: c, radius: R0 }, themeScreen());
  };
  let drag = null;
  box.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; box.setPointerCapture(e.pointerId); });
  box.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
    rot = mmul(rotY(dx * 0.01), mmul(rotX(dy * 0.01), rot));
    box.dispatchEvent(new CustomEvent("rotate", { detail: rot }));
    draw();
  });
  const end = () => (drag = null);
  box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
  const png = (name) => {
    const W = 1800, H = 1350, cvs = document.createElement("canvas"); cvs.width = W; cvs.height = H;
    drawMolecule(cvs.getContext("2d"), W, H, atoms, rot, { ...getOpts(), center: c, radius: R0 }, { bg: "#ffffff", ink: "#15202b", muted: "#5a6877", line: "#9aa5b1", accent: "#2456c8" });
    cvs.toBlob((b) => download(name, b, "image/png"), "image/png");
  };
  const setRot = (r) => { rot = r.map((x) => x.slice()); draw(); };
  draw();
  return { draw, png, setRot, getRot: () => rot };
}
function xyzText(r, comment) {
  return `${r.atoms.length}\n${comment}\n` + r.atoms.map((a) => `${a.el.padEnd(2)} ${a.x.toFixed(6).padStart(12)} ${a.y.toFixed(6).padStart(12)} ${a.z.toFixed(6).padStart(12)}`).join("\n") + "\n";
}
