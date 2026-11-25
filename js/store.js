/* store.js — daftar file, peran, pasangan sistem, pengaturan; disimpan di browser (IndexedDB + localStorage). */

const STATE = {
  files: [],          // {id, name, text, role, r}
  systems: [],        // {id, name, cx, cl, gas}  (id file)
  atomE: {},          // {el: {E, from, mult}}  energi atom manual / dari file atom
  set: { T: 298.15, temps: [298.15, 398.15, 498.15], nu0: 5.2e14, host: "Zn, O", target: null },
  sample: false,
};
let _nextId = 1;
const ROLES = { kompleks: "Kompleks", klaster: "Klaster / adsorben", gas: "Gas", atom: "Atom tunggal", lain: "Lainnya" };

function fileById(id) { return STATE.files.find((f) => f.id === id); }
function resolvedSystems() {
  return STATE.systems.map((s) => ({ ...s, X: fileById(s.cx), K: fileById(s.cl), G: fileById(s.gas) }))
    .filter((s) => s.X && s.K && s.G);
}
function sysName(s) {
  if (s.name) return s.name;
  const X = fileById(s.cx);
  return X ? X.r.formula : "sistem";
}
function atomEnergies() {
  const out = {};
  for (const f of STATE.files) if (f.r.atoms.length === 1 && f.r.E != null) out[f.r.atoms[0].el] = { E: f.r.E, from: f.name, mult: f.r.mult };
  for (const [e, v] of Object.entries(STATE.atomE)) if (isFinite(v.E)) out[e] = v;
  return out;
}

function addFile(name, text) {
  if (!/FINAL SINGLE POINT ENERGY/.test(text)) return { ok: false, msg: `${name}: tidak ditemukan 'FINAL SINGLE POINT ENERGY'. Pastikan yang dimasukkan file output (.out), bukan .inp atau .xyz.` };
  if (STATE.sample) clearAll(false);
  const r = parseOrca(text, name);
  const f = { id: "f" + _nextId++, name, text, role: "lain", r };
  STATE.files.push(f);
  return { ok: true, f };
}
function clearAll(persist = true) {
  STATE.files = []; STATE.systems = []; STATE.atomE = {}; STATE.sample = false; STATE.set.target = null;
  if (persist) save();
}

/* Pasangkan otomatis: kompleks = klaster + gas bila jumlah atom cocok dan urutan unsur sama. */
function autoPair() {
  const multi = STATE.files.filter((f) => f.r.atoms.length > 1);
  const seq = (f) => f.r.atoms.map((a) => a.el);
  const used = new Set(STATE.systems.map((s) => s.cx));
  const sorted = [...multi].sort((a, b) => b.r.atoms.length - a.r.atoms.length);
  for (const X of sorted) {
    if (used.has(X.id)) continue;
    const sx = seq(X);
    let found = null;
    for (const K of multi) {
      if (K === X || K.r.atoms.length >= X.r.atoms.length) continue;
      const sk = seq(K);
      if (!sk.every((e, i) => sx[i] === e)) continue;
      const rest = sx.slice(sk.length).join(" ");
      const G = multi.find((g) => g !== X && g !== K && seq(g).join(" ") === rest);
      if (G && (!found || K.r.atoms.length > found.K.r.atoms.length)) found = { K, G };
    }
    if (found) {
      STATE.systems.push({ id: "s" + _nextId++, name: "", cx: X.id, cl: found.K.id, gas: found.G.id });
      used.add(X.id);
    }
  }
  // peran mengikuti pasangan; atom tunggal = atom
  for (const f of STATE.files) {
    if (f.r.atoms.length === 1) { f.role = "atom"; continue; }
    if (f.roleManual) continue;
    if (STATE.systems.some((s) => s.cx === f.id)) f.role = "kompleks";
    else if (STATE.systems.some((s) => s.cl === f.id)) f.role = "klaster";
    else if (STATE.systems.some((s) => s.gas === f.id)) f.role = "gas";
    else f.role = f.r.atoms.some((a) => METAL.has(a.el)) ? "klaster" : "lain";
  }
  if (!STATE.set.target || !STATE.systems.some((s) => s.id === STATE.set.target)) STATE.set.target = STATE.systems[0]?.id ?? null;
}

/* ---------- penyimpanan ---------- */
const DB = { name: "orca-analyzer", store: "files" };
function idb() {
  return new Promise((res, rej) => {
    try {
      const q = indexedDB.open(DB.name, 1);
      q.onupgradeneeded = () => q.result.createObjectStore(DB.store, { keyPath: "id" });
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    } catch (e) { rej(e); }
  });
}
async function save() {
  try {
    localStorage.setItem("orca-analyzer-meta", JSON.stringify({
      systems: STATE.systems, atomE: STATE.atomE, set: STATE.set, sample: STATE.sample, nextId: _nextId,
      roles: STATE.files.map((f) => [f.id, f.role, !!f.roleManual]),
    }));
  } catch (e) { /* penyimpanan tidak tersedia: aplikasi tetap jalan tanpa ingatan */ }
  try {
    const db = await idb();
    const tx = db.transaction(DB.store, "readwrite");
    const st = tx.objectStore(DB.store);
    st.clear();
    if (!STATE.sample) for (const f of STATE.files) st.put({ id: f.id, name: f.name, text: f.text });
  } catch (e) { /* abaikan */ }
}
async function restore() {
  let meta = null;
  try { meta = JSON.parse(localStorage.getItem("orca-analyzer-meta") || "null"); } catch (e) { meta = null; }
  if (!meta || meta.sample) return false;
  let rows = [];
  try {
    const db = await idb();
    rows = await new Promise((res, rej) => { const q = db.transaction(DB.store).objectStore(DB.store).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  } catch (e) { return false; }
  if (!rows.length) return false;
  const roles = new Map((meta.roles || []).map(([id, role, man]) => [id, { role, man }]));
  STATE.files = rows.map((x) => ({ id: x.id, name: x.name, text: x.text, role: roles.get(x.id)?.role || "lain", roleManual: roles.get(x.id)?.man || false, r: parseOrca(x.text, x.name) }));
  STATE.files.sort((a, b) => parseInt(a.id.slice(1)) - parseInt(b.id.slice(1)));
  STATE.systems = meta.systems || [];
  STATE.atomE = meta.atomE || {};
  Object.assign(STATE.set, meta.set || {});
  _nextId = meta.nextId || STATE.files.length + 1;
  return true;
}
function loadSamples() {
  clearAll(false);
  for (const s of window.SAMPLES || []) {
    const r = parseOrca(s.text, s.name);
    STATE.files.push({ id: "f" + _nextId++, name: s.name, text: s.text, role: "lain", r });
  }
  autoPair();
  STATE.sample = true;
  save();
}
