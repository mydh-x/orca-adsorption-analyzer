# ORCA Adsorption Analyzer

Aplikasi web statis untuk membaca file output [ORCA](https://www.faccts.de/orca/). Dari output itu, aplikasi menyiapkan tabel dan grafik analisis adsorpsi gas pada klaster: struktur, energi kohesif, energi adsorpsi, termodinamika, momen dipol dan muatan, orbital frontier, serta parameter sensor dan selektivitas.

Semua perhitungan berjalan di browser pengguna. Data hanya dikirim ke server bila pengguna menekan **Bagikan** (lihat "Berbagi antarlaptop").

## Fitur

| Halaman | Isi | Unduhan |
|---|---|---|
| Beranda | Input file (tarik, pilih, atau tempel teks); status tiap job (selesai, konvergen, frekuensi imajiner); pasangan sistem kompleks = klaster + gas; pengaturan | – |
| 1. Struktur | Panjang dan sudut ikatan sebelum/sesudah adsorpsi, jarak host–guest, geometri gas, penampil 3D dengan label jarak | CSV, PNG, .xyz (untuk Chemcraft/VMD) |
| 2. Energi kohesif | E_coh per atom dari energi atom tunggal | CSV, SVG, PNG |
| 3. Energi adsorpsi | E_ads (kcal/mol, eV) dan dugaan jenis adsorpsi | CSV, SVG, PNG |
| 4. Termodinamika | ΔE, ΔH, ΔG, TΔS, ΔS | CSV, SVG, PNG |
| 5. Dipol dan muatan | Momen dipol, muatan Löwdin dopan, transfer muatan, muatan per atom | CSV, SVG, PNG |
| 6. Orbital | HOMO, LUMO, celah, η, μ, ω; diagram tingkat energi | CSV, SVG, PNG |
| 7. Sensor | ΔE_g, σ, S, Φ, ΔΦ, j, S_j, waktu pemulihan τ, selektivitas κ dan κ_j | CSV, SVG, PNG |
| File | Isi satu output: status, energi, grafik optimasi, IR, orde ikatan Mayer, dan **cuplikan baris asli** untuk setiap angka | CSV, .xyz |

CSV tersedia dalam dua format. Format internasional memakai koma sebagai pemisah dan titik sebagai desimal. Format "Excel Indonesia" memakai titik koma sebagai pemisah dan koma sebagai desimal. Setiap tabel juga punya tombol **Salin** untuk ditempel langsung ke Excel, LibreOffice, atau Word.

## Cara pakai

1. Untuk setiap sistem, jalankan tiga job ORCA dengan metode yang sama: klaster, molekul gas, dan kompleks. Pakai `opt freq` agar ada ΔH dan ΔG serta pemeriksaan frekuensi imajiner. Untuk energi kohesif, tambahkan job atom tunggal pada keadaan dasarnya.
2. Buka aplikasi, lalu tarik semua file `.out` ke kotak di Beranda.
3. Aplikasi memasangkan kompleks dengan klaster dan gasnya bila urutan atom kompleks = [atom klaster, lalu atom gas]. Bila tebakannya salah, betulkan di tabel "Pasangan sistem".
4. Buka halaman 1–7 dan unduh tabel atau grafik yang dibutuhkan.

Tombol **Muat contoh** memuat output contoh (Zn₃O₃ dan SiZn₃O₃ dengan NH₃ dan H₂S, r²SCAN-3c, ORCA 6.1).

## Berbagi antarlaptop

Di Beranda ada tombol **Bagikan**. Tombol ini menyimpan seluruh proyek (file output, peran, pasangan sistem, energi atom, dan pengaturan) ke Supabase dalam bentuk terkompres, lalu memberi **kode 8 karakter** dan tautan `…/#p=KODE`. Di laptop lain, buka tautan itu atau ketik kodenya di kotak **Buka kode**.

- Data hanya bisa dibuka oleh yang tahu kodenya. Tabelnya tidak bisa dibaca langsung; pengunjung hanya bisa memanggil fungsi `share_save` dan `share_load`.
- Batas 8 MB per proyek setelah dikompres. Sebagai gambaran, tiga output lengkap (1,8 MB) menjadi sekitar 340 KB.
- Proyek terhapus otomatis setelah 30 hari.
- Konfigurasi server (URL dan *publishable key*) ada di `js/share.js`. Skrip database ada di `supabase_share.sql`; jalankan sekali di Supabase SQL Editor bila memakai proyek Supabase sendiri.

## Menjalankan

Tidak perlu instalasi atau build. Ada dua cara:

- Buka `index.html` langsung di browser (klik dua kali), atau
- Jalankan server lokal: `python3 -m http.server` di folder ini, lalu buka `http://localhost:8000`.

### GitHub Pages

```bash
git init
git add .
git commit -m "ORCA Adsorption Analyzer"
git branch -M main
git remote add origin https://github.com/<username>/orca-adsorption-analyzer.git
git push -u origin main
```

Lalu buka **Settings → Pages**, pilih *Deploy from a branch*, branch `main`, folder `/ (root)`. Situs akan tersedia di `https://<username>.github.io/orca-adsorption-analyzer/`.

## Rumus

| Besaran | Rumus |
|---|---|
| Energi kohesif | E_coh = [E(klaster) − Σ nᵢEᵢ(atom)] / N |
| Energi adsorpsi (juga ΔH, ΔG) | E_ads = E(kompleks) − E(klaster) − E(gas) |
| Entropi | TΔS = ΔH − ΔG; ΔS = TΔS / T |
| Celah dan deskriptor | E_g = E_L − E_H; η = E_g/2; μ = (E_H + E_L)/2; ω = μ²/2η |
| Fungsi kerja | Φ = −μ |
| Konduktivitas, rapat arus | σ ∝ T^3/2 exp(−E_g/2k_BT); j = A T² exp(−Φ/k_BT), A = 1.20×10⁶ A m⁻² K⁻² |
| Sensitivitas | S = exp(|ΔE_g|/2k_BT) − 1; S_j = exp(|ΔΦ|/k_BT) − 1 |
| Selektivitas | κ = S_target / S_gas; κ_j = S_j,target / S_j,gas |
| Waktu pemulihan | τ = ν₀⁻¹ exp(−E_ads/k_BT) |

Rumus mengikuti de Sousa Sousa dkk., *Langmuir* **2024**, 40, 23310. Persamaan S dan S_j di artikel itu tercetak dengan penyebut tetap, tetapi hanya bentuk simetris |a − b| / min(a, b) di atas yang mereproduksi semua nilai pada Tabel 5 artikel tersebut.

## Batasan

- Diuji pada output ORCA 6.1 (RKS dan UKS). Versi lain kemungkinan besar bisa dibaca selama format bloknya sama.
- Nilai yang dibaca adalah blok **terakhir** di file: energi akhir, geometri akhir, orbital, muatan, frekuensi, dan termokimia.
- Ikatan pada gambar ditentukan dari jarak, sehingga hanya berfungsi sebagai alat bantu visual. Untuk menilai ada tidaknya ikatan, pakai orde ikatan Mayer (halaman File).
- Gambar isosurface orbital tidak bisa dibuat dari file `.out`. Gunakan `orca_plot` atau file `.gbw` dengan VMD/Chemcraft.

## Struktur folder

```
index.html          kerangka halaman dan navigasi
css/style.css       tampilan (tema terang/gelap)
js/parser.js        pembaca output ORCA
js/chem.js          geometri, parameter adsorpsi dan sensor
js/store.js         daftar file, pasangan sistem, penyimpanan di browser
js/ui.js            tabel, CSV, grafik SVG, penampil 3D
js/pages.js         isi setiap halaman
js/share.js         berbagi proyek (Bagikan / Buka kode) lewat Supabase
js/app.js           navigasi dan input file
sample/contoh.js    output contoh (dipotong ke blok yang dibaca aplikasi)
```
