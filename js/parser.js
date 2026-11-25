/* parser.js — membaca file output ORCA (diuji pada ORCA 6.1, RKS dan UKS).
   parseOrca(text, name) mengembalikan objek berisi angka-angka dan nomor baris sumbernya (r.src). */
const EH_KCAL = 627.5095, EH_EV = 27.211386, KB = 8.617333e-5;

function parseOrca(text, name) {
  const L = text.split(/\r?\n/);
  const r = { name, lines: L, src: {}, warn: [] };
  const lastIdx = (re, from = 0) => { for (let i = L.length - 1; i >= from; i--) if (re.test(L[i])) return i; return -1; };
  const allIdx = (re) => { const o = []; L.forEach((l, i) => { if (re.test(l)) o.push(i); }); return o; };
  const grab = (re, key, conv = parseFloat) => {
    const i = lastIdx(re);
    if (i < 0) return null;
    r.src[key] = i;
    return conv(L[i].match(re)[1]);
  };

  let i = lastIdx(/Program Version\s+([\d.]+)/);
  r.version = i >= 0 ? L[i].match(/Program Version\s+([\d.]+)/)[1] : null;
  // input echo
  r.input = [];
  for (let k = 0; k < L.length; k++) {
    const m = L[k].match(/^\|\s*\d+>\s?(.*)$/);
    if (m) { if (/END OF INPUT/.test(m[1])) break; r.input.push(m[1]); if (r.src.input === undefined) r.src.input = k; }
  }
  r.keywords = r.input.filter((l) => l.trim().startsWith("!")).map((l) => l.trim().slice(1).trim()).join(" ");
  const kw = r.keywords.toLowerCase();
  r.isOpt = /(^|\s)(opt|tightopt|verytightopt|looseopt|copt|zopt|gdiis-opt)(\s|$)/.test(kw);
  r.isFreq = /(^|\s)(freq|numfreq|anfreq)(\s|$)/.test(kw);

  r.terminated = lastIdx(/ORCA TERMINATED NORMALLY/) >= 0;
  if (r.terminated) r.src.terminated = lastIdx(/ORCA TERMINATED NORMALLY/);
  const hurray = lastIdx(/HURRAY|THE OPTIMIZATION HAS CONVERGED/);
  r.converged = hurray >= 0;
  if (r.converged) r.src.converged = hurray;
  r.cycles = allIdx(/GEOMETRY OPTIMIZATION CYCLE/).length;

  // energies
  const eIdx = allIdx(/FINAL SINGLE POINT ENERGY\s+(-?\d+\.\d+)/);
  r.energies = eIdx.map((k) => ({ line: k, E: parseFloat(L[k].match(/FINAL SINGLE POINT ENERGY\s+(-?\d+\.\d+)/)[1]) }));
  if (r.energies.length) { r.E = r.energies[r.energies.length - 1].E; r.src.E = eIdx[eIdx.length - 1]; }
  r.optEnergies = r.isOpt ? r.energies.filter((e) => hurray < 0 || e.line < hurray) : [];

  // last geometry-convergence table
  const gc = lastIdx(/\|Geometry convergence\|/);
  r.convTable = [];
  if (gc >= 0) {
    r.src.conv = gc;
    for (let k = gc + 3; k < gc + 12 && k < L.length; k++) {
      const m = L[k].match(/^\s*([A-Za-z][A-Za-z ]+?)\s{2,}(-?\d+\.\d+)\s+(\d+\.\d+)\s+(YES|NO)\s*$/);
      if (m) r.convTable.push({ item: m[1].trim(), value: +m[2], tol: +m[3], ok: m[4] === "YES" });
    }
  }

  r.charge = grab(/Total Charge\s+Charge\s+\.\.\.\.\s+(-?\d+)/, "charge", parseInt);
  r.mult = grab(/Multiplicity\s+Mult\s+\.\.\.\.\s+(\d+)/, "mult", parseInt);

  // final geometry
  r.atoms = [];
  i = lastIdx(/CARTESIAN COORDINATES \(ANGSTROEM\)/);
  if (i >= 0) {
    r.src.geom = i;
    for (let k = i + 2; k < L.length; k++) {
      const m = L[k].match(/^\s*([A-Z][a-z]?)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*$/);
      if (!m) break;
      r.atoms.push({ el: m[1], x: +m[2], y: +m[3], z: +m[4] });
    }
  }

  // orbitals (last block); UKS has spin-up and spin-down tables
  i = lastIdx(/^ORBITAL ENERGIES\s*$/);
  r.orbitals = null;
  if (i >= 0) {
    r.src.orb = i;
    const readTable = (start) => {
      const rows = []; let k = start;
      while (k < L.length && !/^\s*NO\s+OCC/.test(L[k])) k++;
      for (k = k + 1; k < L.length; k++) {
        const m = L[k].match(/^\s*(\d+)\s+(\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*$/);
        if (!m) break;
        rows.push({ no: +m[1], occ: +m[2], eh: +m[3], ev: +m[4] });
      }
      return { rows, end: k };
    };
    const isU = /SPIN UP ORBITALS/.test(L[i + 2] || "") || /SPIN UP ORBITALS/.test(L[i + 1] || "");
    if (isU) {
      const up = readTable(i);
      const down = readTable(up.end);
      r.orbitals = { uks: true, up: up.rows, down: down.rows };
    } else {
      r.orbitals = { uks: false, up: readTable(i).rows };
    }
    const occ = [], vir = [];
    for (const set of r.orbitals.uks ? [r.orbitals.up, r.orbitals.down] : [r.orbitals.up]) {
      for (const o of set) (o.occ > 0.5 ? occ : vir).push(o.ev);
    }
    if (occ.length && vir.length) { r.HOMO = Math.max(...occ); r.LUMO = Math.min(...vir); }
  }
  r.S2 = grab(/Expectation value of <S\*\*2>\s*:\s*(-?\d+\.\d+)/, "S2");
  r.S2ideal = grab(/Ideal value S\*\(S\+1\) for S=[\d.]+\s*:\s*(-?\d+\.\d+)/, "S2ideal");
  r.dipole = grab(/Magnitude \(Debye\)\s*:\s*(-?\d+\.\d+)/, "dipole");

  // charges
  const readCharges = (re, key) => {
    const s = lastIdx(re);
    if (s < 0) return null;
    r.src[key] = s;
    const out = [];
    for (let k = s + 2; k < L.length; k++) {
      const m = L[k].match(/^\s*(\d+)\s+([A-Z][a-z]?)\s*:\s+(-?\d+\.\d+)(?:\s+(-?\d+\.\d+))?/);
      if (!m) { if (out.length) break; else continue; }
      out.push({ i: +m[1], el: m[2], q: +m[3], spin: m[4] !== undefined ? +m[4] : null });
    }
    return out;
  };
  r.mulliken = readCharges(/^MULLIKEN ATOMIC CHARGES/, "mulliken");
  r.loewdin = readCharges(/^LOEWDIN ATOMIC CHARGES/, "loewdin");

  // Mayer bond orders
  i = lastIdx(/Mayer bond orders larger than/);
  r.mayer = [];
  if (i >= 0) {
    r.src.mayer = i;
    for (let k = i + 1; k < L.length && /B\(/.test(L[k]); k++) {
      for (const m of L[k].matchAll(/B\(\s*(\d+)-([A-Za-z]+)\s*,\s*(\d+)-([A-Za-z]+)\s*\)\s*:\s*(-?\d+\.\d+)/g)) {
        r.mayer.push({ a: +m[1], ea: m[2], b: +m[3], eb: m[4], bo: +m[5] });
      }
    }
  }

  // frequencies + IR
  i = lastIdx(/^VIBRATIONAL FREQUENCIES\s*$/);
  r.freqs = [];
  if (i >= 0) {
    r.src.freq = i;
    for (let k = i + 1; k < L.length; k++) {
      const m = L[k].match(/^\s*(\d+):\s+(-?\d+\.\d+)\s+cm\*\*-1(.*)$/);
      if (m) r.freqs.push({ mode: +m[1], nu: +m[2], imag: +m[2] < 0 || /imaginary/.test(m[3]) });
      else if (r.freqs.length && L[k].trim() === "") { if (L[k + 1] && L[k + 1].trim() === "") break; }
      else if (r.freqs.length && /^[A-Z-]/.test(L[k].trim())) break;
    }
  }
  r.nImag = r.freqs.filter((f) => f.imag).length;
  i = lastIdx(/^IR SPECTRUM\s*$/);
  r.ir = [];
  if (i >= 0) {
    r.src.ir = i;
    for (let k = i + 1; k < Math.min(L.length, i + 4000); k++) {
      const m = L[k].match(/^\s*(\d+):\s+(-?\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+/);
      if (m) r.ir.push({ mode: +m[1], nu: +m[2], int: +m[4] });
      else if (r.ir.length) break;
    }
  }

  // thermochemistry
  r.T = grab(/^Temperature\s+\.\.\.\s+(\d+\.\d+)\s*K/, "T");
  r.ZPE = grab(/^Zero point energy\s+\.\.\.\s+(-?\d+\.\d+)\s*Eh/, "ZPE");
  r.H = grab(/^Total Enthalpy\s+\.\.\.\s+(-?\d+\.\d+)\s*Eh/, "H");
  r.TS = grab(/^Final entropy term\s+\.\.\.\s+(-?\d+\.\d+)\s*Eh/, "TS");
  r.G = grab(/^Final Gibbs free energy\s+\.\.\.\s+(-?\d+\.\d+)\s*Eh/, "G");
  r.GminusE = grab(/^G-E\(el\)\s+\.\.\.\s+(-?\d+\.\d+)\s*Eh/, "GminusE");
  i = lastIdx(/TOTAL RUN TIME:/);
  r.runtime = i >= 0 ? L[i].replace(/^.*TOTAL RUN TIME:\s*/, "").trim() : null;
  if (i >= 0) r.src.runtime = i;

  // formula in order of first appearance
  const cnt = {}; const order = [];
  for (const a of r.atoms) { if (!(a.el in cnt)) { cnt[a.el] = 0; order.push(a.el); } cnt[a.el]++; }
  r.count = cnt;
  r.formula = order.map((e) => e + (cnt[e] > 1 ? cnt[e] : "")).join("");

  // derived descriptors (eV)
  if (r.HOMO != null && r.LUMO != null) {
    r.Eg = r.LUMO - r.HOMO;
    r.eta = r.Eg / 2;
    r.mu = (r.LUMO + r.HOMO) / 2;
    r.omega = r.mu * r.mu / (2 * r.eta);
    r.Phi = -r.mu;
  }

  // warnings
  if (!r.terminated) r.warn.push({ lvl: "bad", t: "Tidak ada baris 'ORCA TERMINATED NORMALLY': job berhenti di tengah atau file terpotong. Jangan pakai angkanya." });
  if (r.isOpt && !r.converged) r.warn.push({ lvl: "bad", t: "Optimasi belum konvergen (tidak ada 'HURRAY'). Geometri belum minimum." });
  if (r.nImag > 0) r.warn.push({ lvl: "bad", t: `${r.nImag} frekuensi imajiner: struktur ini titik pelana, bukan minimum. Optimasi ulang dari geometri yang digeser sepanjang mode imajiner, atau perketat (TightOpt).` });
  if (r.isOpt && !r.isFreq) r.warn.push({ lvl: "warnp", t: "Tidak ada job frekuensi: belum terbukti minimum, dan H/G tidak tersedia." });
  if (r.S2 != null && r.S2ideal != null && Math.abs(r.S2 - r.S2ideal) > 0.1) r.warn.push({ lvl: "warnp", t: `Kontaminasi spin: ⟨S²⟩ = ${r.S2.toFixed(3)} vs ideal ${r.S2ideal.toFixed(3)} (selisih > 0.1).` });
  if (r.atoms.length === 0) r.warn.push({ lvl: "warnp", t: "Blok 'CARTESIAN COORDINATES (ANGSTROEM)' tidak ditemukan." });
  return r;
}

if (typeof module !== "undefined") module.exports = { parseOrca };
