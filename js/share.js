/* share.js — "Bagikan" dan "Buka kode": simpan seluruh proyek ke Supabase dengan kode acak 8 karakter.
   Data dikompres gzip di browser. Server hanya punya dua fungsi (share_save, share_load);
   tabelnya tidak bisa dibaca langsung, jadi data hanya terbuka bagi yang tahu kodenya.
   Proyek dihapus otomatis setelah 30 hari. Skrip database: supabase_share.sql. */

const SHARE = {
  url: "https://admboblvtzqdfaadjvxt.supabase.co",
  key: "sb_publishable__4w2P-WlzTfF9WDrlrjBKg_qGtTddOD",   // kunci publik (publishable), aman dipasang di halaman web
  maxBytes: 8 * 1024 * 1024,
  days: 30,
};

async function shareRpc(fn, body) {
  let r;
  try {
    r = await fetch(`${SHARE.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SHARE.key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("Tidak bisa terhubung ke server berbagi. Periksa koneksi internet.");
  }
  const t = await r.text();
  if (!r.ok) {
    let m = t;
    try { m = JSON.parse(t).message || t; } catch (e) { /* teks biasa */ }
    throw new Error(m || `HTTP ${r.status}`);
  }
  return JSON.parse(t);
}

function toB64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function packText(text) {
  if (typeof CompressionStream === "undefined") return "j:" + text;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return "g:" + toB64(new Uint8Array(await new Response(stream).arrayBuffer()));
}
async function unpackText(data) {
  if (data.startsWith("j:")) return data.slice(2);
  if (!data.startsWith("g:")) throw new Error("Format data tidak dikenal.");
  if (typeof DecompressionStream === "undefined") throw new Error("Browser ini terlalu lama untuk membuka proyek terkompres. Pakai Chrome, Edge, Firefox, atau Safari versi terbaru.");
  const stream = new Blob([fromB64(data.slice(2))]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

function projectJSON() {
  return JSON.stringify({
    v: 1,
    savedAt: new Date().toISOString(),
    files: STATE.files.map((f) => ({ id: f.id, name: f.name, text: f.text, role: f.role, roleManual: !!f.roleManual })),
    systems: STATE.systems, atomE: STATE.atomE, set: STATE.set, bondFactor: CHEM.bondFactor, nextId: _nextId,
  });
}

/* Simpan proyek yang sedang dimuat; kembalikan kode. */
async function shareSave() {
  if (!STATE.files.length) throw new Error("Belum ada file untuk dibagikan.");
  if (STATE.sample) throw new Error("Yang dimuat masih data contoh. Masukkan file output Anda dulu, lalu bagikan.");
  const data = await packText(projectJSON());
  if (data.length > SHARE.maxBytes) throw new Error(`Proyek terlalu besar untuk dibagikan (${(data.length / 1048576).toFixed(1)} MB setelah dikompres, batas 8 MB). Kurangi jumlah file.`);
  return await shareRpc("share_save", { p_data: data });
}

/* Buka proyek dari kode; mengganti data yang sedang dimuat. */
async function shareLoad(code) {
  const c = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length !== 8) throw new Error("Kode berisi 8 huruf/angka, misalnya K7Q2XM8P.");
  const data = await shareRpc("share_load", { p_code: c });
  if (!data) throw new Error(`Kode ${c} tidak ditemukan, atau sudah lebih dari ${SHARE.days} hari sehingga terhapus.`);
  const p = JSON.parse(await unpackText(data));
  STATE.files = p.files.map((f) => ({ ...f, r: parseOrca(f.text, f.name) }));
  STATE.systems = p.systems || [];
  STATE.atomE = p.atomE || {};
  Object.assign(STATE.set, p.set || {});
  CHEM.bondFactor = p.bondFactor || 1.25;
  _nextId = Math.max(p.nextId || 1, STATE.files.length + STATE.systems.length + 1);
  STATE.sample = false;
  await save();
  return { code: c, n: STATE.files.length, savedAt: p.savedAt };
}
const shareLink = (code) => `${location.origin}${location.pathname}#p=${code}`;
