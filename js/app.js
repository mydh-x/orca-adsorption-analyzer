/* app.js — navigasi antarhalaman (hash), input file, dan event halaman Beranda. */

let VIEWERS = [];
const RENDER = {
  beranda: [renderHome, afterHome], struktur: [renderStruktur, afterStruktur], kohesif: [renderKohesif, afterKohesif],
  adsorpsi: [renderAdsorpsi, null], termodinamika: [renderTermo, null], muatan: [renderMuatan, afterMuatan],
  orbital: [renderOrbital, null], sensor: [renderSensor, afterSensor], file: [renderFile, afterFile],
};
function route() {
  const id = (location.hash || "#beranda").slice(1);
  const page = RENDER[id] ? id : "beranda";
  VIEWERS = [];
  for (const k in DL) delete DL[k];
  $("#main").innerHTML = RENDER[page][0]();
  if (RENDER[page][1]) RENDER[page][1]();
  $$("#nav a").forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === "#" + page ? "page" : "false"));
  const pg = PAGES.find((p) => p.id === page);
  document.title = (pg ? `${pg.no}. ${pg.short} · ` : page === "file" ? "File · " : "") + "ORCA Adsorption Analyzer";
}
window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
window.addEventListener("resize", () => VIEWERS.forEach((v) => v.draw()));

function notice(html, err = false) {
  const n = $("#notice"); if (!n) return;
  n.hidden = !html; n.innerHTML = html || ""; n.classList.toggle("err", err);
}
async function ingest(fileList) {
  const msgs = []; let n = 0;
  for (const f of [...fileList]) {
    const res = addFile(f.name, await f.text());
    if (res.ok) n++; else msgs.push(res.msg);
  }
  if (n) autoPair();
  await save();
  route();
  notice((n ? `${n} file dimuat.` : "") + (msgs.length ? `<br>${msgs.map(esc).join("<br>")}` : ""), msgs.length > 0 && !n);
}

/* ---------- event beranda ---------- */
function afterHome() {
  $("#pick").onclick = () => $("#fileinput").click();
  $("#fileinput").onchange = (e) => { ingest(e.target.files); e.target.value = ""; };
  $("#loadsample").onclick = () => { loadSamples(); route(); };
  $("#clearall").onclick = async () => { clearAll(); await save(); route(); };
  $$("select[data-role]").forEach((s) => s.onchange = () => { const f = fileById(s.dataset.role); f.role = s.value; f.roleManual = true; save(); });
  $$("button[data-del]").forEach((b) => b.onclick = () => {
    const id = b.dataset.del;
    STATE.files = STATE.files.filter((f) => f.id !== id);
    STATE.systems = STATE.systems.filter((s) => s.cx !== id && s.cl !== id && s.gas !== id);
    save(); route();
  });
  $$("a[data-file]").forEach((a) => a.onclick = () => { UI.file = a.dataset.file; });
  $("#autopair").onclick = () => { STATE.systems = []; autoPair(); save(); route(); };
  $("#addsys").onclick = () => { STATE.systems.push({ id: "s" + _nextId++, name: "", cx: "", cl: "", gas: "" }); save(); route(); };
  const upd = (attr, key) => $$(`[data-${attr}]`).forEach((el) => el.onchange = () => {
    const s = STATE.systems.find((x) => x.id === el.dataset[attr]);
    s[key] = el.value; save(); if (key !== "name") route();
  });
  upd("sname", "name"); upd("sx", "cx"); upd("sk", "cl"); upd("sg", "gas");
  $$("button[data-sdel]").forEach((b) => b.onclick = () => { STATE.systems = STATE.systems.filter((s) => s.id !== b.dataset.sdel); save(); route(); });
  $("#setT").onchange = (e) => { const v = parseFloat(e.target.value); if (v > 0) { STATE.set.T = v; save(); } };
  $("#setTemps").onchange = (e) => { const v = e.target.value.split(/[,;\s]+/).map(parseFloat).filter((x) => x > 0); if (v.length) { STATE.set.temps = v; save(); } };
  $("#setNu").onchange = (e) => { const v = parseFloat(e.target.value); if (v > 0) { STATE.set.nu0 = v; save(); } };
  $("#setHost").onchange = (e) => { STATE.set.host = e.target.value; save(); };
  $("#setBF").onchange = (e) => { const v = parseFloat(e.target.value); if (v >= 1 && v <= 1.6) { CHEM.bondFactor = v; save(); } };
}

/* drag-and-drop dan tempel berlaku di semua halaman */
document.addEventListener("dragover", (e) => { e.preventDefault(); $("#drop")?.classList.add("over"); document.body.classList.add("dragging"); });
document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) { $("#drop")?.classList.remove("over"); document.body.classList.remove("dragging"); } });
document.addEventListener("drop", (e) => {
  e.preventDefault(); $("#drop")?.classList.remove("over"); document.body.classList.remove("dragging");
  if (e.dataTransfer?.files?.length) { if (location.hash && location.hash !== "#beranda") location.hash = "#beranda"; ingest(e.dataTransfer.files); }
});
let _paste = 0;
document.addEventListener("paste", (e) => {
  if (e.target.closest?.("input, textarea, select")) return;
  const t = e.clipboardData?.getData("text");
  if (t && t.length > 200) ingest([new File([t], `tempelan-${++_paste}.out`)]);
});

(async () => {
  const ok = await restore();
  if (!ok) loadSamples();
  route();
})();
