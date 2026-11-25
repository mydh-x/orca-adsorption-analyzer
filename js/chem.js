/* chem.js — geometri (ikatan, sudut), perhitungan parameter adsorpsi dan sensor. */

const RCOV = { H: .31, He: .28, Li: 1.28, Be: .96, B: .84, C: .76, N: .71, O: .66, F: .57, Ne: .58, Na: 1.66, Mg: 1.41, Al: 1.21, Si: 1.11, P: 1.07, S: 1.05, Cl: 1.02, Ar: 1.06, K: 2.03, Ca: 1.76, Sc: 1.7, Ti: 1.6, V: 1.53, Cr: 1.39, Mn: 1.39, Fe: 1.32, Co: 1.26, Ni: 1.24, Cu: 1.32, Zn: 1.22, Ga: 1.22, Ge: 1.2, As: 1.19, Se: 1.2, Br: 1.2, Kr: 1.16, Rb: 2.2, Sr: 1.95, Y: 1.9, Zr: 1.75, Nb: 1.64, Mo: 1.54, Ru: 1.46, Rh: 1.42, Pd: 1.39, Ag: 1.45, Cd: 1.44, In: 1.42, Sn: 1.39, Sb: 1.39, Te: 1.38, I: 1.39, Xe: 1.4, Pt: 1.36, Au: 1.36, Hg: 1.32, Pb: 1.46, Bi: 1.48 };
const METAL = new Set("Li Be Na Mg Al K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Rb Sr Y Zr Nb Mo Ru Rh Pd Ag Cd In Sn Cs Ba Pt Au Hg Pb Bi".split(" "));
const ELCOLOR = { H: "#f2f2f2", C: "#5b5b5b", N: "#2f4fe0", O: "#e0301e", F: "#8fe04f", Cl: "#1fd81f", S: "#e6a119", Si: "#f0d000", P: "#ff8000", B: "#ffb5b5", Zn: "#9ea3b3", Mg: "#2ec82e", Cd: "#ff8c00", Cu: "#c88033", Al: "#bfa6a6", Fe: "#e06633", Ni: "#50d050", Ag: "#c0c0c0", Au: "#ffd123", Br: "#a62929", I: "#940094", Na: "#ab5cf2", Ca: "#3dff00", Ti: "#bfc2c7", Ga: "#c28f8f", Ge: "#668f8f" };

const CHEM = { bondFactor: 1.25 };

/* Ikatan dari jarak: d <= faktor x (r_kov,a + r_kov,b), dengan pengecualian yang teruji untuk klaster ZnO. */
function cutoff(a, b) {
  const p = [a, b].sort().join("-");
  const fixed = { "H-S": 1.45, "O-O": 1.6, "Zn-Zn": 2.45, "Cd-Zn": 0, "Cd-Cd": 0 };
  if (p in fixed) return fixed[p];
  const ra = RCOV[a] ?? 1.5, rb = RCOV[b] ?? 1.5;
  if (METAL.has(a) && METAL.has(b)) return ra + rb;
  if (a === "H" || b === "H") return Math.min(1.25, CHEM.bondFactor * (ra + rb));
  return CHEM.bondFactor * (ra + rb);
}
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
function findBonds(atoms) {
  const out = [];
  for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) {
    const c = cutoff(atoms[i].el, atoms[j].el), d = dist(atoms[i], atoms[j]);
    if (c > 0 && d <= c) out.push({ i, j, d });
  }
  return out;
}
function angleAt(atoms, a, c, b) {
  const A = atoms[a], C = atoms[c], B = atoms[b];
  const u = [A.x - C.x, A.y - C.y, A.z - C.z], v = [B.x - C.x, B.y - C.y, B.z - C.z];
  const cos = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v));
  return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
}
function anglesOf(atoms, bonds) {
  const nb = atoms.map(() => []);
  for (const b of bonds) { nb[b.i].push(b.j); nb[b.j].push(b.i); }
  const out = [];
  nb.forEach((list, c) => {
    const s = [...list].sort((x, y) => x - y);
    for (let x = 0; x < s.length; x++) for (let y = x + 1; y < s.length; y++) out.push({ a: s[x], c, b: s[y], ang: angleAt(atoms, s[x], c, s[y]) });
  });
  return out;
}
const alab = (atoms, i) => `${atoms[i].el}${i}`;
const bkey = (i, j) => (i < j ? `${i}-${j}` : `${j}-${i}`);

/* Perbandingan struktur klaster (K) dan kompleks (X). Atom klaster di kompleks harus berurutan sama di depan. */
function compareStructure(sys) {
  const K = sys.K.r, X = sys.X.r, G = sys.G.r, n = K.atoms.length;
  const bK = findBonds(K.atoms), bX = findBonds(X.atoms);
  const mapK = new Map(bK.map((b) => [bkey(b.i, b.j), b])), mapX = new Map(bX.map((b) => [bkey(b.i, b.j), b]));
  const bonds = [];
  for (const b of bK) {
    const x = mapX.get(bkey(b.i, b.j));
    bonds.push({ lab: `${alab(K.atoms, b.i)}–${alab(K.atoms, b.j)}`, i: b.i, j: b.j, dK: b.d, dX: x ? x.d : dist(X.atoms[b.i], X.atoms[b.j]), status: x ? "tetap" : "putus" });
  }
  for (const b of bX) {
    if (b.i < n && b.j < n && !mapK.has(bkey(b.i, b.j))) bonds.push({ lab: `${alab(X.atoms, b.i)}–${alab(X.atoms, b.j)}`, i: b.i, j: b.j, dK: dist(K.atoms[b.i], K.atoms[b.j]), dX: b.d, status: "terbentuk" });
  }
  // host-guest: ikatan/kontak antara atom klaster dan atom gas di kompleks
  const hg = [];
  for (let i = 0; i < n; i++) for (let j = n; j < X.atoms.length; j++) {
    const d = dist(X.atoms[i], X.atoms[j]);
    const bonded = mapX.has(bkey(i, j));
    if (bonded || d < 3.2) hg.push({ lab: `${alab(X.atoms, i)}···${alab(X.atoms, j)}`, i, j, d, bonded });
  }
  hg.sort((a, b) => a.d - b.d);
  const site = hg[0] || null;
  // sudut: semua sudut klaster, dibandingkan pada kompleks; ditambah sudut di atom situs yang melibatkan gas
  const angles = anglesOf(K.atoms, bK).map((a) => ({ lab: `${alab(K.atoms, a.a)}–${alab(K.atoms, a.c)}–${alab(K.atoms, a.b)}`, aK: a.ang, aX: angleAt(X.atoms, a.a, a.c, a.b) }));
  const angX = anglesOf(X.atoms, bX).filter((a) => a.a >= n || a.b >= n || a.c >= n)
    .map((a) => ({ lab: `${alab(X.atoms, a.a)}–${alab(X.atoms, a.c)}–${alab(X.atoms, a.b)}`, aK: null, aX: a.ang }));
  // geometri gas bebas vs teradsorpsi
  const bG = findBonds(G.atoms);
  const gasBonds = bG.map((b) => ({ lab: `${alab(G.atoms, b.i)}–${alab(G.atoms, b.j)}`, dG: b.d, dX: dist(X.atoms[n + b.i], X.atoms[n + b.j]) }));
  const gasAngles = anglesOf(G.atoms, bG).map((a) => ({ lab: `${alab(G.atoms, a.a)}–${alab(G.atoms, a.c)}–${alab(G.atoms, a.b)}`, aG: a.ang, aX: angleAt(X.atoms, n + a.a, n + a.c, n + a.b) }));
  const kept = bonds.filter((b) => b.status === "tetap");
  const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
  const maxd = kept.length ? kept.reduce((m, b) => (Math.abs(b.dX - b.dK) > Math.abs(m.dX - m.dK) ? b : m), kept[0]) : null;
  return {
    bonds, angles: angles.concat(angX), hg, site, gasBonds, gasAngles,
    meanK: mean(bonds.filter((b) => b.status !== "terbentuk").map((b) => b.dK)),
    meanX: mean(bonds.filter((b) => b.status !== "putus").map((b) => b.dX)),
    maxChange: maxd, broken: bonds.filter((b) => b.status === "putus").map((b) => b.lab), formed: bonds.filter((b) => b.status === "terbentuk").map((b) => b.lab),
  };
}

/* Semua parameter adsorpsi + sensor untuk satu sistem. Satuan: kcal/mol dan eV. */
function computeSystem(sys, set) {
  const X = sys.X.r, K = sys.K.r, G = sys.G.r, n = K.atoms.length;
  const T = set.T, kT = KB * T;
  const d = (k) => (X[k] != null && K[k] != null && G[k] != null ? X[k] - K[k] - G[k] : null);
  const dE = d("E"), dH = d("H"), dG = d("G");
  const Tth = X.T ?? 298.15;
  const o = {
    Eads: dE != null ? dE * EH_KCAL : null, EadsEV: dE != null ? dE * EH_EV : null,
    dH: dH != null ? dH * EH_KCAL : null, dG: dG != null ? dG * EH_KCAL : null, dGEV: dG != null ? dG * EH_EV : null,
  };
  o.TdS = o.dH != null && o.dG != null ? o.dH - o.dG : null;
  o.dS = o.TdS != null ? o.TdS * 1000 / Tth : null;
  o.Tth = Tth;
  o.EgK = K.Eg; o.EgX = X.Eg;
  o.dEg = K.Eg != null && X.Eg != null ? X.Eg - K.Eg : null;
  o.dEgPct = o.dEg != null ? o.dEg / K.Eg * 100 : null;
  o.PhiK = K.Phi; o.PhiX = X.Phi;
  o.dPhi = K.Phi != null && X.Phi != null ? X.Phi - K.Phi : null;
  o.dPhiPct = o.dPhi != null ? -o.dPhi / K.Phi * 100 : null;
  o.sigmaRatio = o.dEg != null ? Math.exp(-o.dEg / (2 * kT)) : null;
  o.S = o.dEg != null ? Math.expm1(Math.abs(o.dEg) / (2 * kT)) : null;
  o.jRatio = o.dPhi != null ? Math.exp(-o.dPhi / kT) : null;
  o.Sj = o.dPhi != null ? Math.expm1(Math.abs(o.dPhi) / kT) : null;
  o.tau = set.temps.map((t) => (o.EadsEV != null ? Math.exp(-o.EadsEV / (KB * t)) / set.nu0 : null));
  o.orderOK = K.atoms.every((a, i) => X.atoms[i]?.el === a.el) && G.atoms.every((a, i) => X.atoms[n + i]?.el === a.el) && X.atoms.length === n + G.atoms.length;
  o.Qgas = X.loewdin && o.orderOK ? X.loewdin.slice(n).reduce((s, x) => s + x.q, 0) : null;
  o.dipK = K.dipole; o.dipX = X.dipole; o.dDip = K.dipole != null && X.dipole != null ? X.dipole - K.dipole : null;
  const host = new Set(set.host.split(/[\s,;]+/).filter(Boolean));
  o.dopIdx = K.atoms.map((a, i) => (host.has(a.el) ? -1 : i)).filter((i) => i >= 0);
  o.dopLabel = o.dopIdx.map((i) => alab(K.atoms, i)).join(", ");
  const sumQ = (r, idx) => (r.loewdin ? idx.reduce((s, i) => s + (r.loewdin[i]?.q ?? 0), 0) : null);
  o.qXK = o.dopIdx.length ? sumQ(K, o.dopIdx) : null;
  o.qXX = o.dopIdx.length && o.orderOK ? sumQ(X, o.dopIdx) : null;
  o.warn = [];
  if (!o.orderOK) o.warn.push("urutan/jumlah atom kompleks ≠ [klaster, lalu gas]");
  for (const f of [sys.X, sys.K, sys.G]) {
    if (f.r.nImag) o.warn.push(`${f.name}: ${f.r.nImag} frekuensi imajiner`);
    if (!f.r.terminated) o.warn.push(`${f.name}: job tidak selesai normal`);
  }
  const kw = (r) => r.keywords.toLowerCase().replace(/\b(opt|tightopt|verytightopt|looseopt|freq|numfreq|anfreq|tightscf|verytightscf|defgrid\d)\b/g, "").replace(/\s+/g, " ").trim();
  if (new Set([X, K, G].map(kw)).size > 1) o.warn.push("keyword metode ketiga file berbeda");
  return o;
}

function cohesive(r, atomE) {
  const miss = Object.keys(r.count).filter((e) => !isFinite(atomE[e]?.E));
  if (miss.length || r.E == null) return { miss, v: null };
  const sum = Object.entries(r.count).reduce((s, [e, k]) => s + k * atomE[e].E, 0);
  return { miss, v: (r.E - sum) * EH_EV / r.atoms.length };
}
