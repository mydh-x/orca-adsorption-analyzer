/* pages.js — satu fungsi render per halaman (beranda, poin 1–7 rubrik, inspeksi file). */

const PAGES = [
  { id: "struktur", no: 1, title: "Struktur hasil optimasi", short: "Struktur", rubric: "Panjang ikatan dan sudut ikatan klaster sebelum dan sesudah adsorpsi, serta jarak host (klaster) – guest (molekul gas), disertai visualisasi.", gets: "Gambar struktur (PNG), koordinat .xyz untuk Chemcraft/VMD, tabel ikatan, sudut, dan jarak host–guest (CSV)." },
  { id: "kohesif", no: 2, title: "Energi kohesif", short: "Kohesif", rubric: "Stabilitas klaster dari energi kohesif per atom.", gets: "Tabel E_coh (CSV), grafik batang (SVG/PNG)." },
  { id: "adsorpsi", no: 3, title: "Energi adsorpsi", short: "Adsorpsi", rubric: "Kekuatan interaksi klaster–gas.", gets: "Tabel E_ads dalam kcal/mol dan eV (CSV), grafik (SVG/PNG)." },
  { id: "termodinamika", no: 4, title: "Parameter termodinamika", short: "Termodinamika", rubric: "ΔG, ΔH, dan ΔS adsorpsi.", gets: "Tabel ΔE, ΔH, ΔG, TΔS, ΔS (CSV), grafik (SVG/PNG)." },
  { id: "muatan", no: 5, title: "Momen dipol dan muatan Löwdin", short: "Dipol & muatan", rubric: "Perubahan momen dipol dan distribusi muatan akibat adsorpsi.", gets: "Ringkasan dipol, muatan dopan, transfer muatan, muatan per atom (CSV), grafik (SVG/PNG)." },
  { id: "orbital", no: 6, title: "HOMO, LUMO, celah, dan deskriptor kuantum", short: "Orbital", rubric: "E_HOMO, E_LUMO, celah HOMO–LUMO, kekerasan, potensial kimia, elektrofilisitas.", gets: "Tabel deskriptor klaster dan perubahan celah (CSV), diagram tingkat energi (SVG/PNG)." },
  { id: "sensor", no: 7, title: "Parameter kinerja sensor", short: "Sensor", rubric: "Sensitivitas elektronik, konduktivitas, rapat arus, fungsi kerja, waktu pemulihan, dan selektivitas.", gets: "Tabel sensor, waktu pemulihan, selektivitas κ dan κ_j (CSV), grafik (SVG/PNG)." },
];
/* Rumus untuk tampilan: klaster = unsur dopan dulu lalu unsur induk (SiZn3O3); gas = H di depan untuk asam/air (H2S, H2O, HCl), selain itu H di belakang (NH3, CH4). */
function niceFormula(r, kind) {
  const host = STATE.set.host.split(/[\s,;]+/).filter(Boolean);
  let els = Object.keys(r.count);
  if (kind === "klaster") els = els.filter((e) => !host.includes(e)).concat(host.filter((e) => e in r.count));
  else if (kind === "gas" && "H" in r.count) {
    const other = els.filter((e) => e !== "H");
    if (other.length === 2 && other.includes("C") && other.includes("N")) els = ["H", "C", "N"];
    else els = other.every((e) => ["O", "S", "Se", "F", "Cl", "Br", "I"].includes(e)) ? ["H", ...other] : [...other.filter((e) => e === "C"), ...other.filter((e) => e !== "C"), "H"];
    if (other.includes("C") && !other.includes("N")) els = ["C", "H", ...other.filter((e) => e !== "C")];
  } else if (kind === "gas") {
    const pri = ["C", "Si", "B", "S", "Se", "P", "N", "Cl", "Br", "I", "F", "O"];
    els = [...els].sort((a, b) => (pri.indexOf(a) + 99 * (pri.indexOf(a) < 0)) - (pri.indexOf(b) + 99 * (pri.indexOf(b) < 0)));
  }
  return els.map((e) => e + (r.count[e] > 1 ? r.count[e] : "")).join("");
}
function fileFormula(f) {
  if (f.role === "klaster" || f.role === "gas") return niceFormula(f.r, f.role);
  const s = STATE.systems.find((x) => x.cx === f.id);
  const K = s && fileById(s.cl), G = s && fileById(s.gas);
  return K && G ? `${niceFormula(K.r, "klaster")}–${niceFormula(G.r, "gas")}` : f.r.formula;
}
const sysLabel = (s) => s.name || `${niceFormula(s.K.r, "klaster")}–${niceFormula(s.G.r, "gas")}`;
const needSystems = () => `<div class="panel empty-state"><h3>Belum ada pasangan sistem</h3><p>Halaman ini butuh minimal satu pasangan <em>kompleks + klaster + gas</em>. Masukkan file output di <a href="#beranda">Beranda</a>, lalu periksa tabel "Pasangan sistem".</p></div>`;
function pageHead(pg, extra = "") {
  return `<header class="page-head"><p class="eyebrow">Poin ${pg.no} rubrik</p><h1>${pg.title}</h1><p class="lede">${pg.rubric}</p>${extra}</header>`;
}
function dlCard(items) {
  // items: [{label, buttons}]
  return `<aside class="dlcard" aria-label="Unduhan"><h2>Yang bisa diunduh</h2><ul>` +
    items.map((it) => `<li><span>${it.label}</span><span class="dlrow">${it.buttons}</span></li>`).join("") + `</ul></aside>`;
}
function howTo(lines) { return `<details class="how" open><summary>Cara membaca hasil</summary><ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul></details>`; }
function warnList(list) { return list.length ? `<div class="warns">${list.map((w) => `<p><span class="pill warnp">perhatian</span> ${esc(w)}</p>`).join("")}</div>` : ""; }
function sysPicker(systems, cur, id = "syspick") {
  return `<label class="picker" for="${id}">Sistem <select id="${id}">${systems.map((s) => `<option value="${s.id}" ${s.id === cur ? "selected" : ""}>${esc(subf(sysLabel(s)))}</option>`).join("")}</select></label>`;
}
const UI = { sys: null, file: null, dist: "situs", labels: false };

/* ======================= BERANDA ======================= */
function renderHome() {
  const files = STATE.files, sys = resolvedSystems();
  const pill = (r) => [
    r.terminated ? `<span class="pill ok">selesai</span>` : `<span class="pill badp">terhenti</span>`,
    r.isOpt ? (r.converged ? `<span class="pill ok">konvergen</span>` : `<span class="pill badp">belum konvergen</span>`) : "",
    r.freqs.length ? (r.nImag ? `<span class="pill badp">${r.nImag} imajiner</span>` : `<span class="pill ok">0 imajiner</span>`) : r.isOpt ? `<span class="pill warnp">tanpa freq</span>` : "",
  ].join(" ");
  const fileRows = files.map((f) => `<tr>
      <td><a href="#file" data-file="${f.id}">${esc(f.name)}</a></td><td>${esc(subf(fileFormula(f)))}</td><td class="r num">${f.r.atoms.length}</td>
      <td><select data-role="${f.id}" aria-label="Peran ${esc(f.name)}">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${f.role === k ? "selected" : ""}>${v}</option>`).join("")}</select></td>
      <td class="r num">${fx(f.r.E, 6)}</td><td>${pill(f.r)}</td>
      <td><button class="ghost" data-del="${f.id}" aria-label="Hapus ${esc(f.name)}">hapus</button></td></tr>`).join("");
  const opt = (sel, filter) => `<option value="">(pilih)</option>` + files.filter(filter).map((f) => `<option value="${f.id}" ${f.id === sel ? "selected" : ""}>${esc(f.name)} — ${esc(subf(fileFormula(f)))}</option>`).join("");
  const multi = (f) => f.r.atoms.length > 1;
  const sysRows = STATE.systems.map((s) => {
    const rs = resolvedSystems().find((x) => x.id === s.id);
    const ok = rs ? computeSystem(rs, STATE.set) : null;
    return `<tr>
      <td><input type="text" data-sname="${s.id}" value="${esc(s.name)}" placeholder="${rs ? esc(sysLabel(rs)) : "nama"}" aria-label="Nama sistem"></td>
      <td><select data-sx="${s.id}" aria-label="Kompleks">${opt(s.cx, multi)}</select></td>
      <td><select data-sk="${s.id}" aria-label="Klaster">${opt(s.cl, multi)}</select></td>
      <td><select data-sg="${s.id}" aria-label="Gas">${opt(s.gas, multi)}</select></td>
      <td>${!rs ? `<span class="pill warnp">belum lengkap</span>` : ok.warn.length ? `<span class="pill warnp" title="${esc(ok.warn.join("; "))}">${ok.warn.length} catatan</span>` : `<span class="pill ok">siap</span>`}</td>
      <td><button class="ghost" data-sdel="${s.id}">hapus</button></td></tr>`;
  }).join("");
  return `
  <section class="hero">
    <div class="hero-text">
      <p class="eyebrow">Analisis adsorpsi gas pada klaster · ORCA</p>
      <h1>Dari <code>orca.out</code> ke tabel dan grafik laporan</h1>
      <p class="lede">Masukkan file output ORCA untuk klaster, molekul gas, kompleks, dan atom tunggal. Aplikasi membaca angkanya, memasangkan sistemnya, lalu menyiapkan hasil untuk tiap poin pembahasan, lengkap dengan tabel dan grafik yang bisa diunduh.</p>
      <p class="muted small">Semua file diproses di browser Anda dan tidak diunggah ke mana pun. Diuji pada ORCA 6.1 (RKS dan UKS).</p>
    </div>
    <div class="drop" id="drop">
      <strong>Tarik file output ke sini</strong>
      <span class="muted small">Bisa banyak file sekaligus (.out / .log). Teks output juga bisa ditempel dengan Ctrl+V di halaman ini.</span>
      <div class="row">
        <button class="primary" id="pick">Pilih file…</button>
        <input type="file" id="fileinput" multiple hidden>
        <button id="loadsample">Muat contoh</button>
        <button id="clearall">Hapus semua</button>
      </div>
      <div id="notice" class="banner" ${STATE.sample ? "" : "hidden"}>${STATE.sample ? "Contoh dimuat: Zn₃O₃ dan SiZn₃O₃ dengan NH₃, SiZn₃O₃ dengan H₂S, serta atom Zn, O, Si, N, H (r²SCAN-3c, ORCA 6.1). Masukkan file Anda untuk menggantinya." : ""}</div>
    </div>
  </section>

  <section class="panel">
    <h2>Cara pakai</h2>
    <ol class="steps">
      <li><strong>Siapkan output.</strong> Untuk tiap sistem dibutuhkan tiga job dengan metode yang sama: klaster, molekul gas, dan kompleks klaster–gas. Pakai <code>opt freq</code> agar ada ΔH, ΔG, dan cek frekuensi imajiner. Untuk energi kohesif tambahkan output atom tunggal pada keadaan dasarnya (mis. O, C, Si triplet; N kuartet; H doublet).</li>
      <li><strong>Masukkan file.</strong> Tarik semua file ke kotak di atas. Aplikasi menebak perannya dan memasangkan kompleks = klaster + gas bila urutan atomnya cocok (atom klaster di depan, atom gas di belakang).</li>
      <li><strong>Periksa tabel di bawah.</strong> Status harus <span class="pill ok">selesai</span> <span class="pill ok">konvergen</span> <span class="pill ok">0 imajiner</span>. Betulkan pasangan sistem bila tebakan otomatis salah, dan beri nama sistem bila perlu.</li>
      <li><strong>Buka halaman poin 1–7.</strong> Setiap halaman berisi tabel, grafik, cara membaca hasil, dan kotak "Yang bisa diunduh" (CSV, SVG, PNG, XYZ).</li>
      <li><strong>Cek asal angka.</strong> Halaman "File" menampilkan potongan output asli untuk setiap angka, lengkap dengan nomor barisnya.</li>
    </ol>
  </section>

  <section class="panel">
    <header class="row-between"><h2>File yang dimuat <span class="muted small">(${files.length})</span></h2></header>
    ${files.length ? `<div class="scroll"><table><thead><tr><th>File</th><th>Rumus</th><th class="r">Atom</th><th>Peran</th><th class="r">E (Eh)</th><th>Status</th><th></th></tr></thead><tbody>${fileRows}</tbody></table></div>` : `<p class="empty">Belum ada file. Tarik file ke kotak di atas, atau klik "Muat contoh".</p>`}
  </section>

  <section class="panel">
    <header class="row-between"><h2>Pasangan sistem <span class="muted small">(${sys.length} siap)</span></h2>
      <span class="row"><button id="autopair">Pasangkan otomatis</button><button id="addsys">Tambah sistem</button></span></header>
    <p class="muted small">E<sub>ads</sub> = E(kompleks) − E(klaster) − E(gas). Untuk selektivitas, buat beberapa sistem dengan klaster yang sama dan gas berbeda.</p>
    ${STATE.systems.length ? `<div class="scroll"><table><thead><tr><th>Nama</th><th>Kompleks</th><th>Klaster</th><th>Gas</th><th>Status</th><th></th></tr></thead><tbody>${sysRows}</tbody></table></div>` : `<p class="empty">Belum ada pasangan.</p>`}
  </section>

  <section class="panel">
    <h2>Pengaturan</h2>
    <div class="form-row">
      <label for="setT">T untuk σ, j, S (K)<input type="number" id="setT" value="${STATE.set.T}" step="1"></label>
      <label for="setTemps">Suhu untuk τ (K, pisahkan koma)<input type="text" id="setTemps" value="${STATE.set.temps.join(", ")}"></label>
      <label for="setNu">ν₀ untuk τ (s⁻¹)<input type="text" id="setNu" value="${STATE.set.nu0.toExponential(2)}"></label>
      <label for="setHost">Unsur klaster induk (bukan dopan)<input type="text" id="setHost" value="${esc(STATE.set.host)}"></label>
      <label for="setBF">Faktor batas ikatan<input type="number" id="setBF" value="${CHEM.bondFactor}" step="0.05" min="1" max="1.6"></label>
    </div>
    <p class="muted small">ΔH, ΔG, dan ΔS memakai suhu dari blok termokimia ORCA (biasanya 298.15 K). ν₀ = 5.2×10¹⁴ s⁻¹ mengikuti jurnal acuan; sesuaikan dengan arahan dosen.</p>
  </section>

  <section>
    <h2 class="sec-title">Halaman hasil</h2>
    <div class="cards">${PAGES.map((p) => `<a class="card" href="#${p.id}"><span class="card-no">${p.no}</span><span class="card-title">${p.title}</span><span class="card-desc">${p.gets}</span></a>`).join("")}
      <a class="card" href="#file"><span class="card-no">F</span><span class="card-title">Inspeksi per file</span><span class="card-desc">Status, energi, grafik optimasi, orbital, IR, orde ikatan Mayer, dan cuplikan baris output asli.</span></a>
    </div>
  </section>`;
}

/* ======================= 1. STRUKTUR ======================= */
function renderStruktur() {
  const pg = PAGES[0], sys = resolvedSystems();
  if (!sys.length) return pageHead(pg) + needSystems();
  const cur = sys.find((s) => s.id === UI.sys) || sys[0]; UI.sys = cur.id;
  const all = sys.map((s) => ({ s, c: compareStructure(s) }));
  const C = all.find((x) => x.s.id === cur.id).c;
  const sumSpec = { cols: [
    { h: "Sistem", f: (x) => sysLabel(x.s) },
    { h: "Situs–gas", f: (x) => (x.c.site ? x.c.site.lab : "") },
    { h: "d host–guest (Å)", f: (x) => x.c.site?.d, d: 3 },
    { h: "Jenis kontak", f: (x) => (x.c.site ? (x.c.site.bonded ? "ikatan" : "non-kovalen") : "") },
    { h: "Rerata ikatan klaster sebelum (Å)", f: (x) => x.c.meanK, d: 3 },
    { h: "Rerata ikatan klaster sesudah (Å)", f: (x) => x.c.meanX, d: 3 },
    { h: "Perubahan terbesar", f: (x) => (x.c.maxChange ? `${x.c.maxChange.lab} ${(x.c.maxChange.dX - x.c.maxChange.dK >= 0 ? "+" : "")}${(x.c.maxChange.dX - x.c.maxChange.dK).toFixed(3)} Å` : "") },
    { h: "Ikatan putus", f: (x) => x.c.broken.join(", ") || "–" },
    { h: "Ikatan terbentuk (klaster)", f: (x) => x.c.formed.join(", ") || "–" },
  ], rows: all };
  const bondSpec = { cols: [{ h: "Ikatan", f: (b) => b.lab }, { h: "d klaster (Å)", f: (b) => b.dK, d: 3 }, { h: "d kompleks (Å)", f: (b) => b.dX, d: 3 }, { h: "Δd (Å)", f: (b) => b.dX - b.dK, d: 3 }, { h: "Status", f: (b) => b.status }], rows: C.bonds };
  const angSpec = { cols: [{ h: "Sudut", f: (a) => a.lab }, { h: "∠ klaster (°)", f: (a) => a.aK, d: 1 }, { h: "∠ kompleks (°)", f: (a) => a.aX, d: 1 }, { h: "Δ∠ (°)", f: (a) => (a.aK == null ? null : a.aX - a.aK), d: 1 }], rows: C.angles };
  const hgSpec = { cols: [{ h: "Pasangan", f: (h) => h.lab }, { h: "Jarak (Å)", f: (h) => h.d, d: 3 }, { h: "Jenis", f: (h) => (h.bonded ? "ikatan (batas jarak)" : "kontak non-kovalen") }, { h: "Orde ikatan Mayer", f: (h) => cur.X.r.mayer.find((m) => (m.a === h.i && m.b === h.j) || (m.a === h.j && m.b === h.i))?.bo ?? null, d: 3 }], rows: C.hg };
  const gasSpec = { cols: [{ h: "Ikatan gas", f: (g) => g.lab }, { h: "d gas bebas (Å)", f: (g) => g.dG, d: 3 }, { h: "d teradsorpsi (Å)", f: (g) => g.dX, d: 3 }, { h: "Δd (Å)", f: (g) => g.dX - g.dG, d: 3 }], rows: C.gasBonds };
  const gasAngSpec = { cols: [{ h: "Sudut gas", f: (g) => g.lab }, { h: "∠ gas bebas (°)", f: (g) => g.aG, d: 1 }, { h: "∠ teradsorpsi (°)", f: (g) => g.aX, d: 1 }, { h: "Δ∠ (°)", f: (g) => g.aX - g.aG, d: 1 }], rows: C.gasAngles };
  const allBonds = { cols: [{ h: "Sistem", f: (r) => r.sys }].concat(bondSpec.cols.map((c) => ({ ...c, f: (r) => c.f(r.b) }))), rows: all.flatMap((x) => x.c.bonds.map((b) => ({ sys: sysLabel(x.s), b }))) };
  const allAngles = { cols: [{ h: "Sistem", f: (r) => r.sys }].concat(angSpec.cols.map((c) => ({ ...c, f: (r) => c.f(r.a) }))), rows: all.flatMap((x) => x.c.angles.map((a) => ({ sys: sysLabel(x.s), a }))) };
  const base = sysLabel(cur).replace(/[^\w-]+/g, "_");
  UI._struct = { cur, C };
  return pageHead(pg) +
    dlCard([
      { label: "Ringkasan semua sistem", buttons: tableDownloads(sumSpec, "1_ringkasan_struktur") },
      { label: "Panjang ikatan semua sistem", buttons: tableDownloads(allBonds, "1_ikatan_semua") },
      { label: "Sudut ikatan semua sistem", buttons: tableDownloads(allAngles, "1_sudut_semua") },
      { label: `Koordinat ${esc(subf(sysLabel(cur)))} (.xyz, buka di Chemcraft/VMD)`, buttons:
        dlButton("Klaster .xyz", () => download(`${base}_klaster.xyz`, xyzText(cur.K.r, `${cur.K.name} geometri akhir`), "chemical/x-xyz")) +
        dlButton("Kompleks .xyz", () => download(`${base}_kompleks.xyz`, xyzText(cur.X.r, `${cur.X.name} geometri akhir`), "chemical/x-xyz")) +
        dlButton("Gas .xyz", () => download(`${base}_gas.xyz`, xyzText(cur.G.r, `${cur.G.name} geometri akhir`), "chemical/x-xyz")) },
      { label: "Gambar struktur (PNG 1800×1350, latar putih)", buttons: `<button class="dl" id="pngK">Klaster</button><button class="dl" id="pngX">Kompleks</button>` },
    ]) +
    howTo([
      "Bandingkan panjang ikatan klaster sebelum dan sesudah adsorpsi. Ikatan di sekitar situs adsorpsi biasanya memanjang karena elektron gas masuk ke atom situs.",
      "Jarak host–guest yang pendek (mis. Zn–N ≈ 2.0–2.2 Å) dengan orde ikatan Mayer ≳ 0.3 menandakan ikatan koordinasi (kemisorpsi). Jarak > 2.5–3 Å tanpa orde ikatan Mayer menandakan fisisorpsi.",
      "Status <em>putus</em> atau <em>terbentuk</em> berarti topologi klaster berubah. Pastikan klaster bebas yang dipakai untuk E<sub>ads</sub> punya topologi yang sama dengan klaster di kompleks.",
      "Rubrik meminta visualisasi Chemcraft: unduh .xyz lalu buka di Chemcraft. Gambar PNG di sini bisa dipakai sebagai draf atau pembanding.",
    ]) +
    `<section class="panel"><h2>Ringkasan semua sistem</h2>${tableHTML(sumSpec)}</section>
    <section class="panel">
      <header class="row-between"><h2>Detail sistem</h2>${sysPicker(sys, cur.id)}</header>
      ${warnList(computeSystem(cur, STATE.set).warn)}
      <div class="tools">
        <label for="vlab"><input type="checkbox" id="vlab" ${UI.labels ? "checked" : ""}> label atom</label>
        <label for="vdist">label jarak <select id="vdist"><option value="tidak">tidak ada</option><option value="situs">di sekitar situs</option><option value="semua">semua ikatan</option></select></label>
        <button id="vsync">Samakan orientasi klaster dengan kompleks</button>
        <span class="muted small">Seret gambar untuk memutar. Garis putus-putus = kontak host–guest non-kovalen.</span>
      </div>
      <div class="viewers">
        <figure><div class="viewer" id="vK"><canvas aria-label="Struktur klaster"></canvas></div><figcaption>Klaster: ${esc(subf(niceFormula(cur.K.r, "klaster")))} <span class="muted">(${esc(cur.K.name)})</span></figcaption></figure>
        <figure><div class="viewer" id="vX"><canvas aria-label="Struktur kompleks"></canvas></div><figcaption>Kompleks: ${esc(subf(sysLabel(cur)))} <span class="muted">(${esc(cur.X.name)})</span></figcaption></figure>
      </div>
      <div class="grid2">
        <div><h3>Jarak host–guest</h3>${tableHTML(hgSpec, { empty: "Tidak ada kontak < 3.2 Å." })}<div class="dlrow">${tableDownloads(hgSpec, `1_hostguest_${base}`)}</div></div>
        <div><h3>Geometri molekul gas</h3>${tableHTML(gasSpec)}${tableHTML(gasAngSpec, { empty: "" })}<div class="dlrow">${tableDownloads(gasSpec, `1_gas_${base}`)}</div></div>
      </div>
      <div class="grid2">
        <div><h3>Panjang ikatan klaster</h3>${tableHTML(bondSpec, { rowCls: (b) => (b.status !== "tetap" ? "hl" : "") })}<div class="dlrow">${tableDownloads(bondSpec, `1_ikatan_${base}`)}</div></div>
        <div><h3>Sudut ikatan</h3>${tableHTML(angSpec)}<div class="dlrow">${tableDownloads(angSpec, `1_sudut_${base}`)}</div></div>
      </div>
    </section>`;
}
function afterStruktur() {
  const st = UI._struct; if (!st) return;
  const { cur, C } = st, n = cur.K.r.atoms.length;
  $("#vdist").value = UI.dist;
  const optsK = () => ({ labels: UI.labels, distLabels: UI.dist, highlight: new Set(C.site ? [C.site.i] : []), contacts: [] });
  const contacts = C.hg.filter((h) => !h.bonded).slice(0, 1).map((h) => ({ i: h.i, j: h.j, d: h.d }));
  const optsX = () => ({ labels: UI.labels, distLabels: UI.dist, highlight: new Set(C.site ? [C.site.i] : []), contacts: C.hg.some((h) => h.bonded) ? [] : contacts });
  // orientasi sama untuk klaster dan kompleks: bidang klaster menghadap pengamat, gas di atas; skala sama
  const XA = cur.X.r.atoms, KA = cur.K.r.atoms;
  const gasC = XA.slice(n); const gc = { x: 0, y: 0, z: 0 }; gasC.forEach((a) => { gc.x += a.x / gasC.length; gc.y += a.y / gasC.length; gc.z += a.z / gasC.length; });
  const rot0 = orientFrame(XA.slice(0, n).filter((a) => a.el !== "H"), gc);
  const cen = (arr) => ["x", "y", "z"].map((k) => arr.reduce((s, p) => s + p[k], 0) / arr.length);
  const cX = cen(XA), RX = Math.max(1.6, ...XA.map((a) => Math.hypot(a.x - cX[0], a.y - cX[1], a.z - cX[2])));
  const vX = mountViewer($("#vX"), XA, optsX, rot0, { center: cX, radius: RX });
  const vK = mountViewer($("#vK"), KA, optsK, rot0, { center: cen(KA), radius: RX });
  const base = sysLabel(cur).replace(/[^\w-]+/g, "_");
  $("#pngK").onclick = () => vK.png(`${base}_klaster.png`);
  $("#pngX").onclick = () => vX.png(`${base}_kompleks.png`);
  $("#vsync").onclick = () => vK.setRot(vX.getRot());
  $("#vlab").onchange = (e) => { UI.labels = e.target.checked; vK.draw(); vX.draw(); };
  $("#vdist").onchange = (e) => { UI.dist = e.target.value; vK.draw(); vX.draw(); };
  $("#syspick").onchange = (e) => { UI.sys = e.target.value; route(); };
  VIEWERS.push(vK, vX);
}

/* ======================= 2. KOHESIF ======================= */
function renderKohesif() {
  const pg = PAGES[1];
  const clusters = STATE.files.filter((f) => f.role === "klaster" && f.r.atoms.length > 1);
  const aE = atomEnergies();
  const els = [...new Set(clusters.flatMap((f) => Object.keys(f.r.count)))];
  const rows = clusters.map((f) => ({ f, ...cohesive(f.r, aE) }));
  const spec = { cols: [{ h: "Klaster", f: (x) => niceFormula(x.f.r, "klaster") }, { h: "File", f: (x) => x.f.name }, { h: "N atom", f: (x) => x.f.r.atoms.length, d: 0 }, { h: "E klaster (Eh)", f: (x) => x.f.r.E, d: 6 }, { h: "E_coh (eV/atom)", f: (x) => x.v, d: 3 }], rows };
  const atomSpec = { cols: [{ h: "Unsur", f: (e) => e }, { h: "E atom (Eh)", f: (e) => aE[e]?.E, d: 6 }, { h: "Multiplisitas", f: (e) => aE[e]?.mult ?? "" }, { h: "Sumber", f: (e) => aE[e]?.from ?? "belum ada" }], rows: els };
  const chart = (p) => barChart({ labels: rows.filter((x) => x.v != null).map((x) => niceFormula(x.f.r, "klaster")), series: [{ name: "E_coh", values: rows.filter((x) => x.v != null).map((x) => x.v) }], ylab: "E_coh (eV/atom)", p, title: "Energi kohesif klaster" });
  return pageHead(pg) +
    dlCard([{ label: "Tabel energi kohesif", buttons: tableDownloads(spec, "2_energi_kohesif") }, { label: "Energi atom yang dipakai", buttons: tableDownloads(atomSpec, "2_energi_atom") },
      { label: "Grafik energi kohesif", buttons: dlButton("SVG", () => download("2_energi_kohesif.svg", chart(PAL_LIT), "image/svg+xml")) + dlButton("PNG", () => svgToPng(chart(PAL_LIT), "2_energi_kohesif.png")) }]) +
    howTo([
      "E<sub>coh</sub> = [E(klaster) − Σ n<sub>i</sub>E<sub>i</sub>(atom)] / N. Nilai negatif berarti klaster lebih stabil daripada atom-atom bebasnya; makin negatif, makin stabil.",
      "Energi atom harus dihitung pada keadaan dasar dan dengan metode yang sama. Atom O, C, dan Si dalam keadaan singlet memberi E<sub>coh</sub> terlalu negatif sekitar 1.4–2.0 eV/atom.",
      "Bandingkan klaster murni dengan klaster terdoping: E<sub>coh</sub> yang kurang negatif menandakan dopan menurunkan stabilitas.",
      "Daftar klaster diambil dari file berperan \"Klaster / adsorben\" di Beranda.",
    ]) +
    `<section class="panel"><h2>Energi atom</h2><p class="muted small">Terisi otomatis dari file atom tunggal. Ketik nilai untuk mengganti atau melengkapi.</p>
      <div class="form-row">${els.map((e) => `<label for="ae-${e}">E(${e}) (Eh)${aE[e] ? ` <span class="muted">${esc(aE[e].from)}${aE[e].mult ? `, mult ${aE[e].mult}` : ""}</span>` : ` <span class="pill warnp">belum ada</span>`}<input type="number" step="any" id="ae-${e}" data-ae="${e}" value="${aE[e]?.E ?? ""}"></label>`).join("") || `<p class="empty">Belum ada klaster.</p>`}</div></section>
    <section class="panel"><h2>Hasil</h2>${tableHTML(spec, { empty: "Belum ada file berperan klaster." })}${chartBlock(chart, "2_energi_kohesif")}</section>`;
}
function afterKohesif() {
  $$("input[data-ae]").forEach((inp) => inp.addEventListener("change", () => {
    const v = parseFloat(inp.value);
    if (isFinite(v)) STATE.atomE[inp.dataset.ae] = { E: v, from: "diketik", mult: null }; else delete STATE.atomE[inp.dataset.ae];
    save(); route();
  }));
}

/* ======================= 3. ADSORPSI ======================= */
function renderAdsorpsi() {
  const pg = PAGES[2], sys = resolvedSystems();
  if (!sys.length) return pageHead(pg) + needSystems();
  const rows = sys.map((s) => ({ s, o: computeSystem(s, STATE.set), c: compareStructure(s) }));
  const kind = (x) => x.o.EadsEV == null ? "" : x.o.EadsEV >= 0 ? "tidak disukai (endotermik)" : (x.c.site?.bonded ? "kemisorpsi / ikatan koordinasi" : "fisisorpsi");
  const spec = { cols: [
    { h: "Sistem", f: (x) => sysLabel(x.s) }, { h: "E kompleks (Eh)", f: (x) => x.s.X.r.E, d: 6 }, { h: "E klaster (Eh)", f: (x) => x.s.K.r.E, d: 6 }, { h: "E gas (Eh)", f: (x) => x.s.G.r.E, d: 6 },
    { h: "E_ads (kcal/mol)", f: (x) => x.o.Eads, d: 2 }, { h: "E_ads (eV)", f: (x) => x.o.EadsEV, d: 3 }, { h: "d host–guest (Å)", f: (x) => x.c.site?.d, d: 3 }, { h: "Dugaan jenis adsorpsi", f: kind },
  ], rows };
  const chart = (p) => barChart({ labels: rows.map((x) => sysLabel(x.s)), series: [{ name: "E_ads", values: rows.map((x) => x.o.Eads) }], ylab: "E_ads (kcal/mol)", p, title: "Energi adsorpsi" });
  return pageHead(pg) +
    dlCard([{ label: "Tabel energi adsorpsi", buttons: tableDownloads(spec, "3_energi_adsorpsi") },
      { label: "Grafik energi adsorpsi", buttons: dlButton("SVG", () => download("3_energi_adsorpsi.svg", chart(PAL_LIT), "image/svg+xml")) + dlButton("PNG", () => svgToPng(chart(PAL_LIT), "3_energi_adsorpsi.png")) }]) +
    howTo([
      "E<sub>ads</sub> = E(kompleks) − E(klaster) − E(gas), dari energi elektronik akhir (FINAL SINGLE POINT ENERGY). 1 E<sub>h</sub> = 627.5095 kcal/mol = 27.2114 eV.",
      "Negatif = adsorpsi eksotermik. Makin negatif, makin kuat gas terikat, tetapi juga makin lama waktu pemulihan sensor (poin 7).",
      "Kolom \"dugaan jenis adsorpsi\" hanya berdasar jarak; pastikan dengan orde ikatan Mayer dan transfer muatan (halaman File dan poin 5).",
      "r²SCAN-3c sudah memuat koreksi BSSE (gCP) dan dispersi (D4), jadi tidak perlu koreksi counterpoise terpisah.",
    ]) +
    rows.map((x) => warnList(x.o.warn.map((w) => `${sysLabel(x.s)}: ${w}`))).join("") +
    `<section class="panel"><h2>Hasil</h2>${tableHTML(spec)}${chartBlock(chart, "3_energi_adsorpsi")}</section>`;
}

/* ======================= 4. TERMODINAMIKA ======================= */
function renderTermo() {
  const pg = PAGES[3], sys = resolvedSystems();
  if (!sys.length) return pageHead(pg) + needSystems();
  const rows = sys.map((s) => ({ s, o: computeSystem(s, STATE.set) }));
  const spec = { cols: [
    { h: "Sistem", f: (x) => sysLabel(x.s) }, { h: "ΔE (kcal/mol)", f: (x) => x.o.Eads, d: 2 }, { h: "ΔH (kcal/mol)", f: (x) => x.o.dH, d: 2 }, { h: "ΔG (kcal/mol)", f: (x) => x.o.dG, d: 2 },
    { h: "ΔG (eV)", f: (x) => x.o.dGEV, d: 3 }, { h: "TΔS (kcal/mol)", f: (x) => x.o.TdS, d: 2 }, { h: "ΔS (cal/mol·K)", f: (x) => x.o.dS, d: 2 }, { h: "T (K)", f: (x) => x.o.Tth, d: 2 },
    { h: "Spontan?", f: (x) => (x.o.dG == null ? "" : x.o.dG < 0 ? "ya" : "tidak") },
  ], rows };
  const chart = (p) => barChart({ labels: rows.map((x) => sysLabel(x.s)), series: [{ name: "ΔE", values: rows.map((x) => x.o.Eads) }, { name: "ΔH", values: rows.map((x) => x.o.dH) }, { name: "ΔG", values: rows.map((x) => x.o.dG) }], ylab: "kcal/mol", p, title: "Parameter termodinamika adsorpsi" });
  const missing = rows.filter((x) => x.o.dG == null).map((x) => sysLabel(x.s));
  return pageHead(pg) +
    dlCard([{ label: "Tabel termodinamika", buttons: tableDownloads(spec, "4_termodinamika") },
      { label: "Grafik ΔE, ΔH, ΔG", buttons: dlButton("SVG", () => download("4_termodinamika.svg", chart(PAL_LIT), "image/svg+xml")) + dlButton("PNG", () => svgToPng(chart(PAL_LIT), "4_termodinamika.png")) }]) +
    howTo([
      "ΔH dan ΔG diambil dari 'Total Enthalpy' dan 'Final Gibbs free energy' (sudah termasuk ZPE dan koreksi termal), dengan rumus selisih yang sama seperti E<sub>ads</sub>.",
      "TΔS = ΔH − ΔG, lalu ΔS = TΔS / T. ΔS negatif wajar: gas kehilangan kebebasan translasi dan rotasi saat menempel.",
      "ΔG &lt; 0 berarti adsorpsi spontan pada suhu tersebut (biasanya 298.15 K, 1 atm). Gas yang E<sub>ads</sub>-nya negatif tetapi ΔG-nya positif hanya terikat lemah.",
      "Entropi vibrasi ORCA memakai qRRHO, sehingga mode frekuensi rendah tidak membesar-besarkan entropi.",
    ]) +
    (missing.length ? warnList([`Tanpa blok termokimia (perlu job freq): ${missing.join(", ")}`]) : "") +
    `<section class="panel"><h2>Hasil</h2>${tableHTML(spec)}${chartBlock(chart, "4_termodinamika")}</section>`;
}

/* ======================= 5. MUATAN ======================= */
function renderMuatan() {
  const pg = PAGES[4], sys = resolvedSystems();
  if (!sys.length) return pageHead(pg) + needSystems();
  const cur = sys.find((s) => s.id === UI.sys) || sys[0]; UI.sys = cur.id;
  const rows = sys.map((s) => ({ s, o: computeSystem(s, STATE.set) }));
  const spec = { cols: [
    { h: "Sistem", f: (x) => sysLabel(x.s) }, { h: "μ_D klaster (D)", f: (x) => x.o.dipK, d: 3 }, { h: "μ_D kompleks (D)", f: (x) => x.o.dipX, d: 3 }, { h: "Δμ_D (D)", f: (x) => x.o.dDip, d: 3 },
    { h: "Atom dopan", f: (x) => x.o.dopLabel || "–" }, { h: "q dopan klaster (e)", f: (x) => x.o.qXK, d: 3 }, { h: "q dopan kompleks (e)", f: (x) => x.o.qXX, d: 3 }, { h: "Q gas (e)", f: (x) => x.o.Qgas, d: 3 },
    { h: "Arah transfer", f: (x) => (x.o.Qgas == null ? "" : x.o.Qgas > 0 ? "gas → klaster (gas donor)" : "klaster → gas (gas akseptor)") },
  ], rows };
  const n = cur.K.r.atoms.length, X = cur.X.r, K = cur.K.r;
  const atomRows = X.atoms.map((a, i) => ({ i, el: a.el, lk: K.loewdin?.[i]?.q, lx: X.loewdin?.[i]?.q, mk: K.mulliken?.[i]?.q, mx: X.mulliken?.[i]?.q, gas: i >= n, lg: i >= n ? cur.G.r.loewdin?.[i - n]?.q : null }));
  const atomSpec = { cols: [
    { h: "Atom", f: (r) => `${r.el}${r.i}` }, { h: "Bagian", f: (r) => (r.gas ? "gas" : "klaster") },
    { h: "Löwdin sebelum (e)", f: (r) => (r.gas ? r.lg : r.lk), d: 3 }, { h: "Löwdin sesudah (e)", f: (r) => r.lx, d: 3 }, { h: "Δq Löwdin (e)", f: (r) => (r.lx != null && (r.gas ? r.lg : r.lk) != null ? r.lx - (r.gas ? r.lg : r.lk) : null), d: 3 },
    { h: "Mulliken sesudah (e)", f: (r) => r.mx, d: 3 },
  ], rows: atomRows };
  const allAtoms = { cols: [{ h: "Sistem", f: (r) => r.sys }].concat(atomSpec.cols.map((c) => ({ ...c, f: (r) => c.f(r.a) }))), rows: sys.flatMap((s) => { const nn = s.K.r.atoms.length; return s.X.r.atoms.map((a, i) => ({ sys: sysLabel(s), a: { i, el: a.el, lk: s.K.r.loewdin?.[i]?.q, lx: s.X.r.loewdin?.[i]?.q, mx: s.X.r.mulliken?.[i]?.q, gas: i >= nn, lg: i >= nn ? s.G.r.loewdin?.[i - nn]?.q : null } })); }) };
  const chart = (p) => barChart({ labels: rows.map((x) => sysLabel(x.s)), series: [{ name: "klaster", values: rows.map((x) => x.o.dipK) }, { name: "kompleks", values: rows.map((x) => x.o.dipX) }], ylab: "momen dipol (Debye)", p, title: "Momen dipol sebelum dan sesudah adsorpsi" });
  const base = sysLabel(cur).replace(/[^\w-]+/g, "_");
  return pageHead(pg) +
    dlCard([{ label: "Ringkasan dipol dan muatan", buttons: tableDownloads(spec, "5_dipol_muatan") }, { label: "Muatan per atom, semua sistem", buttons: tableDownloads(allAtoms, "5_muatan_per_atom") },
      { label: "Grafik momen dipol", buttons: dlButton("SVG", () => download("5_dipol.svg", chart(PAL_LIT), "image/svg+xml")) + dlButton("PNG", () => svgToPng(chart(PAL_LIT), "5_dipol.png")) }]) +
    howTo([
      "Momen dipol diambil dari 'Magnitude (Debye)' terakhir. Kenaikan dipol setelah adsorpsi menunjukkan distribusi muatan menjadi lebih tidak simetris, sehingga respons listrik klaster berubah.",
      "Q gas = jumlah muatan Löwdin atom-atom gas di kompleks (gas bebas netral). Positif: gas memberi elektron ke klaster; negatif: gas menarik elektron.",
      "Muatan dopan dihitung dari atom yang bukan unsur klaster induk (atur di Beranda › Pengaturan).",
      "Löwdin lebih stabil terhadap ukuran basis daripada Mulliken; nilai Mulliken disertakan sebagai pembanding.",
    ]) +
    `<section class="panel"><h2>Ringkasan semua sistem</h2>${tableHTML(spec)}${chartBlock(chart, "5_dipol")}</section>
    <section class="panel"><header class="row-between"><h2>Muatan per atom</h2>${sysPicker(sys, cur.id)}</header>
      ${tableHTML(atomSpec, { rowCls: (r) => (r.gas ? "hl" : "") })}<div class="dlrow">${tableDownloads(atomSpec, `5_muatan_${base}`)}</div></section>`;
}
function afterMuatan() { const p = $("#syspick"); if (p) p.onchange = (e) => { UI.sys = e.target.value; route(); }; }

/* ======================= 6. ORBITAL ======================= */
function renderOrbital() {
  const pg = PAGES[5], sys = resolvedSystems();
  if (!sys.length) return pageHead(pg) + needSystems();
  const rows = sys.map((s) => ({ s, o: computeSystem(s, STATE.set) }));
  const uniqK = [...new Map(sys.map((s) => [s.K.id, s.K])).values()];
  const tA = { cols: [{ h: "Klaster", f: (f) => niceFormula(f.r, "klaster") }, { h: "E_HOMO (eV)", f: (f) => f.r.HOMO, d: 3 }, { h: "E_LUMO (eV)", f: (f) => f.r.LUMO, d: 3 }, { h: "E_g (eV)", f: (f) => f.r.Eg, d: 3 }, { h: "η (eV)", f: (f) => f.r.eta, d: 3 }, { h: "μ (eV)", f: (f) => f.r.mu, d: 3 }, { h: "ω (eV)", f: (f) => f.r.omega, d: 3 }, { h: "μ_D (D)", f: (f) => f.r.dipole, d: 3 }], rows: uniqK };
  const tB = { cols: [
    { h: "Sistem", f: (x) => sysLabel(x.s) },
    { h: "E_H klaster (eV)", f: (x) => x.s.K.r.HOMO, d: 3 }, { h: "E_L klaster (eV)", f: (x) => x.s.K.r.LUMO, d: 3 }, { h: "E_g klaster (eV)", f: (x) => x.s.K.r.Eg, d: 3 },
    { h: "E_H kompleks (eV)", f: (x) => x.s.X.r.HOMO, d: 3 }, { h: "E_L kompleks (eV)", f: (x) => x.s.X.r.LUMO, d: 3 }, { h: "E_g kompleks (eV)", f: (x) => x.s.X.r.Eg, d: 3 },
    { h: "ΔE_g (eV)", f: (x) => x.o.dEg, d: 3 }, { h: "ΔE_g (%)", f: (x) => x.o.dEgPct, d: 2 },
    { h: "η kompleks (eV)", f: (x) => x.s.X.r.eta, d: 3 }, { h: "μ kompleks (eV)", f: (x) => x.s.X.r.mu, d: 3 }, { h: "ω kompleks (eV)", f: (x) => x.s.X.r.omega, d: 3 },
  ], rows };
  const chart = (p) => levelDiagram({ items: rows.map((x) => ({ label: sysLabel(x.s), a: x.s.K.r, b: x.s.X.r })), p, title: "Tingkat energi HOMO dan LUMO" });
  return pageHead(pg) +
    dlCard([{ label: "Deskriptor klaster (gaya Tabel 1 jurnal)", buttons: tableDownloads(tA, "6_deskriptor_klaster") }, { label: "HOMO/LUMO sebelum–sesudah (gaya Tabel 2 jurnal)", buttons: tableDownloads(tB, "6_homo_lumo_adsorpsi") },
      { label: "Diagram tingkat energi", buttons: dlButton("SVG", () => download("6_diagram_energi.svg", chart(PAL_LIT), "image/svg+xml")) + dlButton("PNG", () => svgToPng(chart(PAL_LIT), "6_diagram_energi.png")) }]) +
    howTo([
      "HOMO dan LUMO diambil dari blok ORBITAL ENERGIES terakhir (kolom eV). Untuk sistem spin terbuka (UKS), HOMO = orbital terisi tertinggi dari kedua spin dan LUMO = orbital kosong terendah.",
      "η = E<sub>g</sub>/2 (kekerasan), μ = (E<sub>H</sub> + E<sub>L</sub>)/2 (potensial kimia), ω = μ²/2η (elektrofilisitas). Celah dan η besar berarti stabil dan kurang reaktif.",
      "ΔE<sub>g</sub> (%) = (E<sub>g,kompleks</sub> − E<sub>g,klaster</sub>)/E<sub>g,klaster</sub> × 100. Perubahan celah yang besar adalah dasar sensor resistif (poin 7).",
      "Gambar isosurface HOMO/LUMO tidak bisa dibuat dari file .out; buat file cube dengan orca_plot dari file .gbw lalu tampilkan di VMD/Chemcraft.",
    ]) +
    `<section class="panel"><h2>Deskriptor klaster</h2>${tableHTML(tA)}</section>
    <section class="panel"><h2>Sebelum dan sesudah adsorpsi</h2>${tableHTML(tB)}${chartBlock(chart, "6_diagram_energi")}</section>`;
}

/* ======================= 7. SENSOR ======================= */
function renderSensor() {
  const pg = PAGES[6], sys = resolvedSystems();
  if (!sys.length) return pageHead(pg) + needSystems();
  const set = STATE.set;
  const rows = sys.map((s) => ({ s, o: computeSystem(s, set) }));
  const spec = { cols: [
    { h: "Sistem", f: (x) => sysLabel(x.s) }, { h: "ΔE_g (%)", f: (x) => x.o.dEgPct, d: 2 }, { h: "σ_ads/σ", f: (x) => x.o.sigmaRatio, d: "e" }, { h: "S", f: (x) => x.o.S, d: "e" },
    { h: "Φ klaster (eV)", f: (x) => x.o.PhiK, d: 3 }, { h: "Φ kompleks (eV)", f: (x) => x.o.PhiX, d: 3 }, { h: "ΔΦ (%)", f: (x) => x.o.dPhiPct, d: 2 }, { h: "j_ads/j", f: (x) => x.o.jRatio, d: "e" }, { h: "S_j", f: (x) => x.o.Sj, d: "e" },
  ], rows };
  const tauSpec = { cols: [{ h: "Sistem", f: (x) => sysLabel(x.s) }, { h: "E_ads (eV)", f: (x) => x.o.EadsEV, d: 3 }].concat(set.temps.map((t, k) => ({ h: `τ ${t} K (s)`, f: (x) => x.o.tau[k], d: "e" }))), rows };
  // selektivitas: sistem dengan klaster (file) yang sama dengan sistem target
  const tgt = rows.find((x) => x.s.id === set.target) || rows[0];
  const same = rows.filter((x) => x.s.K.id === tgt.s.K.id);
  const selSpec = { cols: [
    { h: "Sistem", f: (x) => sysLabel(x.s) }, { h: "Gas", f: (x) => niceFormula(x.s.G.r, "gas") }, { h: "E_ads (eV)", f: (x) => x.o.EadsEV, d: 3 }, { h: "ΔE_g (%)", f: (x) => x.o.dEgPct, d: 2 }, { h: "S", f: (x) => x.o.S, d: "e" },
    { h: "κ", f: (x) => (x.o.S ? tgt.o.S / x.o.S : null), d: "e" }, { h: "Φ (eV)", f: (x) => x.o.PhiX, d: 3 }, { h: "ΔΦ (%)", f: (x) => x.o.dPhiPct, d: 2 }, { h: "S_j", f: (x) => x.o.Sj, d: "e" },
    { h: "κ_j", f: (x) => (x.o.Sj ? tgt.o.Sj / x.o.Sj : null), d: "e" },
  ], rows: same };
  const chart = (p) => barChart({ labels: rows.map((x) => sysLabel(x.s)), series: [{ name: "ΔE_g (%)", values: rows.map((x) => x.o.dEgPct) }, { name: "ΔΦ (%)", values: rows.map((x) => x.o.dPhiPct) }], ylab: "%", p, title: "Respons elektronik dan fungsi kerja" });
  const selChart = (p) => barChart({ labels: same.map((x) => niceFormula(x.s.G.r, "gas")), series: [{ name: "log₁₀ S", values: same.map((x) => (x.o.S > 0 ? Math.log10(x.o.S) : null)) }, { name: "log₁₀ S_j", values: same.map((x) => (x.o.Sj > 0 ? Math.log10(x.o.Sj) : null)) }], ylab: "log₁₀ sensitivitas", p, title: `Selektivitas ${subf(niceFormula(tgt.s.K.r, "klaster"))}` });
  return pageHead(pg, `<p class="muted small">T = ${set.T} K untuk σ, j, S, S<sub>j</sub>; τ pada ${set.temps.join(", ")} K dengan ν₀ = ${fe(set.nu0)} s⁻¹. Ubah di <a href="#beranda">Beranda › Pengaturan</a>.</p>`) +
    dlCard([{ label: "Parameter sensor", buttons: tableDownloads(spec, "7_sensor") }, { label: "Waktu pemulihan τ", buttons: tableDownloads(tauSpec, "7_waktu_pemulihan") },
      { label: "Selektivitas (κ, κ_j)", buttons: tableDownloads(selSpec, "7_selektivitas") },
      { label: "Grafik respons", buttons: dlButton("SVG", () => download("7_respons.svg", chart(PAL_LIT), "image/svg+xml")) + dlButton("PNG", () => svgToPng(chart(PAL_LIT), "7_respons.png")) },
      { label: "Grafik selektivitas", buttons: dlButton("SVG", () => download("7_selektivitas.svg", selChart(PAL_LIT), "image/svg+xml")) + dlButton("PNG", () => svgToPng(selChart(PAL_LIT), "7_selektivitas.png")) }]) +
    howTo([
      "σ ∝ T<sup>3/2</sup> exp(−E<sub>g</sub>/2k<sub>B</sub>T). Celah yang melebar menurunkan konduktivitas (σ<sub>ads</sub>/σ &lt; 1), celah menyempit menaikkannya.",
      "Φ = −(E<sub>H</sub> + E<sub>L</sub>)/2. ΔΦ (%) = (Φ − Φ<sub>ads</sub>)/Φ × 100; positif berarti fungsi kerja turun. Rapat arus j = A T² exp(−Φ/k<sub>B</sub>T) naik bila Φ turun.",
      "S = exp(|ΔE<sub>g</sub>|/2k<sub>B</sub>T) − 1 dan S<sub>j</sub> = exp(|ΔΦ|/k<sub>B</sub>T) − 1, yaitu |a − b| / min(a, b). Bentuk ini mereproduksi Tabel 5 jurnal acuan (de Sousa Sousa dkk., Langmuir 2024).",
      "τ = ν₀⁻¹ exp(−E<sub>ads</sub>/k<sub>B</sub>T). τ sangat panjang berarti gas sulit lepas; sensor perlu dipanaskan untuk pulih.",
      "Selektivitas: pilih sistem target (gas yang ingin dideteksi). κ = S<sub>target</sub>/S<sub>gas</sub> dan κ<sub>j</sub> = S<sub>j,target</sub>/S<sub>j,gas</sub> dihitung untuk semua sistem dengan klaster yang sama. κ &gt; 1 berarti respons terhadap target lebih besar. Perhatikan juga arah perubahan (tanda ΔE<sub>g</sub> dan ΔΦ).",
    ]) +
    `<section class="panel"><h2>Sensitivitas, konduktivitas, fungsi kerja</h2>${tableHTML(spec)}${chartBlock(chart, "7_respons")}</section>
    <section class="panel"><h2>Waktu pemulihan</h2>${tableHTML(tauSpec)}</section>
    <section class="panel"><header class="row-between"><h2>Selektivitas</h2>
      <label class="picker" for="tgtpick">Target <select id="tgtpick">${rows.map((x) => `<option value="${x.s.id}" ${x.s.id === tgt.s.id ? "selected" : ""}>${esc(subf(sysLabel(x.s)))}</option>`).join("")}</select></label></header>
      ${same.length < 2 ? `<p class="empty">Hanya ada satu sistem dengan klaster ${esc(subf(niceFormula(tgt.s.K.r, "klaster")))}. Tambahkan kompleks klaster yang sama dengan gas lain untuk menghitung κ.</p>` : ""}
      ${tableHTML(selSpec, { rowCls: (x) => (x === tgt ? "hl" : "") })}${same.length > 1 ? chartBlock(selChart, "7_selektivitas") : ""}</section>`;
}
function afterSensor() { const p = $("#tgtpick"); if (p) p.onchange = (e) => { STATE.set.target = e.target.value; save(); route(); }; }

/* ======================= FILE ======================= */
function renderFile() {
  const files = STATE.files;
  const head = `<header class="page-head"><p class="eyebrow">Inspeksi</p><h1>Isi satu file output</h1><p class="lede">Status job, energi, jalannya optimasi, orbital, orde ikatan Mayer, frekuensi, dan dari baris mana setiap angka diambil.</p></header>`;
  if (!files.length) return head + `<div class="panel empty-state"><p>Belum ada file. Masukkan di <a href="#beranda">Beranda</a>.</p></div>`;
  const f = files.find((x) => x.id === UI.file) || files[0]; UI.file = f.id;
  const r = f.r;
  const chip = (key, line) => { const ln = line ?? r.src[key]; return ln == null ? "" : `<button class="chip" data-line="${ln}">baris ${ln + 1}</button>`; };
  const kv = (rows) => `<div class="kv">${rows.map(([k, v, c]) => `<span class="k">${k}</span><span class="v">${v}</span><span>${c || ""}</span>`).join("")}</div>`;
  const energySpec = { cols: [{ h: "Besaran", f: (x) => x[0] }, { h: "Eh", f: (x) => x[1], d: 6 }, { h: "kcal/mol", f: (x) => (x[1] == null ? null : x[1] * EH_KCAL), d: 2 }, { h: "eV", f: (x) => (x[1] == null ? null : x[1] * EH_EV), d: 3 }],
    rows: [["E elektronik", r.E], ["Entalpi H", r.H], ["Energi bebas G", r.G], ["ZPE", r.ZPE], ["T·S", r.TS], ["G − E(el)", r.GminusE]] };
  const optSpec = { cols: [{ h: "Siklus", f: (x) => x.k, d: 0 }, { h: "E (Eh)", f: (x) => x.E, d: 8 }, { h: "E − E akhir (kcal/mol)", f: (x) => x.rel, d: 4 }], rows: r.optEnergies.map((e, k) => ({ k: k + 1, E: e.E, rel: (e.E - r.optEnergies[r.optEnergies.length - 1].E) * EH_KCAL })) };
  const irSpec = { cols: [{ h: "Mode", f: (x) => x.mode, d: 0 }, { h: "ν (cm⁻¹)", f: (x) => x.nu, d: 2 }, { h: "Intensitas IR (km/mol)", f: (x) => x.int ?? null, d: 2 }, { h: "Imajiner", f: (x) => (x.imag ? "ya" : "") }],
    rows: r.freqs.filter((q) => q.nu !== 0).map((q) => ({ ...q, int: r.ir.find((x) => x.mode === q.mode)?.int })) };
  const qSpec = { cols: [{ h: "Atom", f: (x) => `${x.el}${x.i}` }, { h: "Löwdin (e)", f: (x) => r.loewdin?.[x.i]?.q, d: 4 }, { h: "Mulliken (e)", f: (x) => r.mulliken?.[x.i]?.q, d: 4 }, { h: "x (Å)", f: (x) => x.x, d: 6 }, { h: "y (Å)", f: (x) => x.y, d: 6 }, { h: "z (Å)", f: (x) => x.z, d: 6 }], rows: r.atoms.map((a, i) => ({ ...a, i })) };
  const mSpec = { cols: [{ h: "Pasangan", f: (m) => `${m.ea}${m.a}–${m.eb}${m.b}` }, { h: "Jarak (Å)", f: (m) => (r.atoms[m.a] && r.atoms[m.b] ? dist(r.atoms[m.a], r.atoms[m.b]) : null), d: 3 }, { h: "Orde ikatan", f: (m) => m.bo, d: 3 }], rows: [...r.mayer].sort((a, b) => b.bo - a.bo) };
  const base = f.name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "_");
  const optC = (p) => lineChart({ xs: optSpec.rows.map((x) => x.k), ys: optSpec.rows.map((x) => x.rel), xlab: "siklus optimasi", ylab: "E − E akhir (kcal/mol)", p });
  const irC = (p) => irChart({ ir: r.ir, p });
  const checks = [[r.terminated, "Job selesai normal (ORCA TERMINATED NORMALLY)", "terminated"], [r.isOpt ? r.converged : null, "Optimasi konvergen (HURRAY)", "converged"], [r.freqs.length ? r.nImag === 0 : null, "Tidak ada frekuensi imajiner", "freq"]];
  UI._file = f;
  return head +
    `<div class="panel"><label class="picker" for="filepick">File <select id="filepick">${files.map((x) => `<option value="${x.id}" ${x.id === f.id ? "selected" : ""}>${esc(x.name)} — ${esc(subf(x.r.formula))}</option>`).join("")}</select></label></div>` +
    dlCard([{ label: "Energi dan termokimia", buttons: tableDownloads(energySpec, `F_${base}_energi`) }, { label: "Koordinat dan muatan per atom", buttons: tableDownloads(qSpec, `F_${base}_atom`) + dlButton(".xyz", () => download(`${base}.xyz`, xyzText(r, f.name), "chemical/x-xyz")) },
      ...(optSpec.rows.length ? [{ label: "Energi per siklus optimasi", buttons: tableDownloads(optSpec, `F_${base}_optimasi`) }] : []),
      ...(irSpec.rows.length ? [{ label: "Frekuensi dan intensitas IR", buttons: tableDownloads(irSpec, `F_${base}_frekuensi`) }] : []),
      ...(mSpec.rows.length ? [{ label: "Orde ikatan Mayer", buttons: tableDownloads(mSpec, `F_${base}_mayer`) }] : [])]) +
    `<div class="grid2">
      <section class="panel"><h2>Identitas dan status</h2>
        ${kv([["Versi ORCA", esc(r.version ?? "–")], ["Keyword", esc(r.keywords || "–"), chip("input")], ["Muatan / multiplisitas", `${r.charge ?? "–"} / ${r.mult ?? "–"}`, chip("mult")], ["Rumus", esc(subf(r.formula))], ["Siklus optimasi", r.isOpt ? r.cycles : "–"], ["Waktu total", esc(r.runtime ?? "–"), chip("runtime")]])}
        <div class="checks">${checks.map(([ok, t, k]) => (ok === null ? "" : `<p><span class="pill ${ok ? "ok" : "badp"}">${ok ? "ya" : "tidak"}</span> ${t} ${chip(k)}</p>`)).join("")}</div>
        ${r.warn.length ? `<div class="warns">${r.warn.map((w) => `<p><span class="pill ${w.lvl}">${w.lvl === "bad" ? "masalah" : "perhatian"}</span> ${esc(w.t)}</p>`).join("")}</div>` : ""}
      </section>
      <section class="panel"><h2>Energi dan termokimia</h2>${tableHTML(energySpec)}
        <p class="muted small">Sumber: E ${chip("E")} H ${chip("H")} G ${chip("G")} T = ${r.T ?? "–"} K ${chip("T")}</p></section>
      <section class="panel"><h2>Orbital frontier</h2>
        ${kv([["E_HOMO", `${fx(r.HOMO)} eV`, chip("orb")], ["E_LUMO", `${fx(r.LUMO)} eV`], ["E_g", `${fx(r.Eg)} eV`], ["η", `${fx(r.eta)} eV`], ["μ", `${fx(r.mu)} eV`], ["ω", `${fx(r.omega)} eV`], ["Φ", `${fx(r.Phi)} eV`], ["Momen dipol", `${fx(r.dipole)} D`, chip("dipole")], ...(r.S2 != null ? [["⟨S²⟩", fx(r.S2), chip("S2")]] : [])])}</section>
      ${optSpec.rows.length > 1 ? `<section class="panel"><h2>Jalannya optimasi ${chip("conv")}</h2>${chartBlock(optC, `F_${base}_optimasi`)}
        ${r.convTable.length ? tableHTML({ cols: [{ h: "Kriteria", f: (c) => c.item }, { h: "Nilai", f: (c) => c.value, d: "e" }, { h: "Toleransi", f: (c) => c.tol, d: "e" }, { h: "Lolos", f: (c) => (c.ok ? "YES" : "NO") }], rows: r.convTable }) : ""}</section>` : ""}
      ${r.ir.length ? `<section class="panel"><h2>Spektrum IR ${chip("ir")}</h2>${chartBlock(irC, `F_${base}_IR`)}</section>` : ""}
      ${mSpec.rows.length ? `<section class="panel"><h2>Orde ikatan Mayer ${chip("mayer")}</h2>${tableHTML(mSpec)}</section>` : ""}
    </div>
    <section class="panel"><h2>Cuplikan output</h2><p class="muted small">Klik penanda "baris …" untuk melihat asal angka di file output.</p><pre class="snip" id="snip"></pre></section>`;
}
function afterFile() {
  const f = UI._file; if (!f) return;
  const show = (line, scroll) => {
    const L = f.r.lines, s = Math.max(0, line - 3), e = Math.min(L.length, line + 9);
    $("#snip").innerHTML = L.slice(s, e).map((l, k) => (s + k === line ? `<mark>${String(s + k + 1).padStart(6)}  ${esc(l)}</mark>` : `${String(s + k + 1).padStart(6)}  ${esc(l)}`)).join("\n");
    if (scroll) $("#snip").scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  $$(".chip").forEach((b) => b.addEventListener("click", () => show(+b.dataset.line, true)));
  show(f.r.src.E ?? 0, false);
  $("#filepick").onchange = (e) => { UI.file = e.target.value; route(); };
}
