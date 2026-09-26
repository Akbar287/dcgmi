# CHANGELOG-METHOD

Catatan setiap perubahan pada nilai, aturan, atau formula metodologis. Perubahan apa pun pada `lib/method/constants.ts` **wajib** punya entri di sini, dengan rujukan pasal dan persetujuan peneliti utama.

Format: `[tanggal] [aktor] — apa yang berubah — rujukan — alasan`

---

## 2026-09-25 — inisialisasi

Nilai awal diambil dari R1–V1.7 (19 September 2026).

| Konstanta | Nilai | Rujukan |
|---|---|---|
| `I_CVI_MIN` | 0.78 | §3.8.2, Tabel 3.6 |
| `I_CVI_REVISE_MIN` | 0.50 | Tabel 3.6 |
| `S_CVI_AVE_MIN` | 0.90 | §3.8.2 |
| `MEDIAN_MIN` | 3 | §3.8.2 |
| `IQR_MAX` | 1 | §3.8.2 |
| `MAX_ROUNDS` | 3 | §3.8.1 |
| `DELPHI_PANEL_SIZE` | 8 | §3.8.1 |
| `FGD_PANEL_SIZE` | 6 | §3.7.1 |
| `FGD_REVISE_NON_ACCEPT_MIN` | 4 | Tabel 3.5 |
| `FGD_SPECIAL_REJECT_MIN` | 2 | Tabel 3.5 |
| `CR_MAX` | 0.10 | §3.9.2, Tabel 3.7 |
| `AGGREGATION` | GEOMETRIC_MEAN | §3.9.2 |
| `PILOT_COMPLETENESS_MIN` | 0.90 | Tabel 3.8 |
| `PILOT_KAPPA_MIN` | 0.60 | Tabel 3.8 |
| `PILOT_AGREEMENT_MIN` | 0.80 | Tabel 3.8 |

**Catatan penting.** Ambang 0,75 dari rancangan lama **tidak** dipakai untuk keputusan validitas isi. R1–V1.7 §3.8.2 menurunkan statusnya menjadi statistik kesepakatan deskriptif. Dengan panel 8, batas operasional yang memenuhi I-CVI ≥ 0,78 adalah 7 dari 8. Jangan mengembalikannya ke 0,75.

---

## 2026-09-26 — Peneliti utama — Form pra-reviu pakar R1–V2.1.2B

Tidak ada konstanta di `lib/method/constants.ts` yang berubah. Dicatat karena menyangkut kapan instrumen boleh dipakai pada pakar manusia.

| Keputusan | Rujukan | Alasan |
|---|---|---|
| Form pra-reviu tidak diikat gate; syarat buka mengikuti `productionReadiness_()` + verifikasi isi | SPECIFICATION §4.2; R1–V2.1.2B | Pra-reviu adalah masukan FGD, bukan tahap FGD; cakupan rubrik 1–5 dinyatakan terbatas |
| Aturan kualitatif ditegakkan saat kirim, bukan hanya di QC | R1–V2.1.2B `description_()`, `normalize_()` | Aturan sudah dinyatakan wajib kepada responden; pola placeholder identik dengan QC |
| Hanya mode PRODUCTION di aplikasi | R1–V2.1.2B `TEST_EVIDENCE_NOTE` | Dry-run Google Form sudah dilakukan 23 September 2026 |
| Kode pakar diikat ke akun oleh Admin | R1–V1.7 §3.13.2 | Mencegah salah pilih/memakai kode orang lain; respons tetap hanya memuat kode |

---

## 2026-09-26 — Peneliti utama — Paket penilaian A1.0 diterapkan; C20b/C42

Tidak ada konstanta yang berubah. Sumber: `docs/DCGMI-Paket-Penilaian-43-Indikator.records.json` (DRAF, sha256 `85cc27b1b3892b91ec24b8e36674246e0ac78fbe30eb6ed2d96ed9c606e3b9f5`), diterapkan lewat `pnpm artifact:import-package` dengan 129 `ChangeLogEntry`.

| Keputusan | Rujukan | Alasan |
|---|---|---|
| Definisi operasional, objek, batas, sumber, rubrik 1–5, dan bukti (jenis + level) 43 indikator diambil dari paket; C01 contoh seed diganti (RUMUS_ULANG, isi lama tersimpan di log) | §3.6.1; G1_BASELINE | Paket konsisten secara internal; definisi workbook R1–V2.1.2A tetap hanya pada form pra-reviu |
| Nama baseline dipertahankan; 15 nama berbeda di paket tidak diterapkan | §1.3 | Nama = yang dilihat pakar di pra-reviu; perubahan nama lewat FGD/Delphi |
| **C20b dan C42 (CH-08) diisi dari paket** — kode, nama, posisi tidak berubah | R1–V1.7 CH-08 | Keputusan versi eksplisit; tanpa ini G1 tidak dapat terpenuhi |
| G1 hanya dievaluasi otomatis (PENDING); kelulusan oleh Admin lewat Dasbor dengan catatan | docs/07 P7 | Gate tidak di-PASSED oleh skrip |

Status paket DRAF: rubrik belum melewati FGD maupun Delphi/CVI dan tidak boleh disebut tervalidasi. G1 hanya menilai kelengkapan.

---

## 2026-09-26 — Peneliti utama — Panel & persona (M4)

Tidak ada konstanta yang berubah.

| Keputusan | Rujukan | Alasan |
|---|---|---|
| Persona brief diisi manual; unggah CV dan ekstraksi AI ditunda | docs/04 §4, docs/07 §4 | Tidak ada isi CV yang diproses atau dikirim ke provider |
| Komposisi preset FGD-6 (2-2-1-1) dan Delphi-8 (+1 SPBE, +1 sustainability, keduanya ARTIFACT_ONLY) di `lib/panel/presets.ts`, bukan `constants.ts` | R1–V1.7 §3.7.1, §3.8.1 | Desain panel, bukan ambang; ukuran panel tetap dari `METHOD` |
| Persetujuan persona hanya Admin; persona dengan temuan de-identifikasi tidak dapat disetujui | docs/03 approvePersona, docs/04 §4.3 | Tata kelola data pakar |
| Uji koneksi mengirim "ping" nyata bila MOCK_AI≠1 | docs/03 testProvider | Tanpa persona, CV, atau artefak |

---

## 2026-09-26 — Peneliti utama — Simulator FGD (M5) dan Vercel AI Gateway

Tidak ada konstanta yang berubah. Aturan keputusan tetap `applyFgdDecisionRule` (Tabel 3.5) di `lib/method/fgd.ts`.

| Keputusan | Rujukan | Alasan |
|---|---|---|
| Vercel AI Gateway disetujui sebagai perantara; hanya keluarga model dari provider yang disetujui | docs/07 §5, docs/00 §10 | Satu kunci untuk panel multi-model; perantara dicatat, bukan diputuskan diam-diam |
| Sesi FGD dapat dibatasi per tahap dan per domain; estimasi panggilan ditampilkan sebelum sesi dibuat | SPECIFICATION §4.5, docs/04 §9 | Uji murah tanpa mengubah agenda 11 tahap |
| Tahap struktur domain/aspek/indikator/rubrik dibahas per komponen; tujuh tahap lain satu komponen untuk seluruh instrumen | §3.7.2 | Granularitas agenda corong di aplikasi |
| Eksekusi per komponen dengan checkpoint; STEP berhenti tiap akhir tahap, AUTO berhenti pada PEMBAHASAN_KHUSUS | SPECIFICATION §4.5 | Run dapat dilanjutkan; tidak ada komponen setengah tersimpan |

---

## 2026-09-26 — Peneliti utama — Operasionalisasi G2_FGD dan versi turunan A1.1

Tidak ada konstanta yang berubah. Evaluator baru `evaluateFgdGate` di `lib/method/gates.ts` (vektor G2-1…G2-6, docs/05 §6).

| Keputusan | Rujukan | Alasan |
|---|---|---|
| Cakupan G2 = gabungan seluruh sesi FGD SIMULATED pada versi; per komponen (tahap + target) dipakai hasil terbaru, hasil lama dicatat sebagai peringatan | SPECIFICATION §4.5, docs/05 §6 | Sesi boleh dipecah per tahap/domain tanpa mengulang agenda penuh |
| Komponen `PEMBAHASAN_KHUSUS` baru terhitung setelah peneliti mencatat resolusi | R1–V1.7 §3.7.3, Tabel 3.5 | Pembahasan khusus terjadi sebelum tindakan ditetapkan |
| Setiap usulan pada hasil terhitung wajib diputuskan; tidak diadopsi wajib beralasan | Tabel 3.5 baris terakhir | Matriks revisi lengkap sebelum A1.1 |
| Hanya versi DRAF turunan yang dapat disunting; A1.0 beku, perubahan struktur baseline hanya lewat alur FGD → A1.1 | AGENTS.md, CLAUDE.md (seed 8–15–43) | Menjaga baseline dan jejak versi |
| Hapus indikator = soft delete tercatat; C20b/C42 butuh keputusan versi eksplisit dan kodenya tidak dipakai ulang | CH-08, docs/06 §3 | Controlled exception tetap dapat dilacak |
| Pemeriksaan rubrik: level 1–5 lengkap, deskriptor terisi dan tidak kembar (blocking); level tanpa bukti wajib sebagai jangkar hanya peringatan | docs/06 §4 | "Evidence-anchored" adalah penilaian peneliti, bukan rumus |

---

## 2026-09-26 — Peneliti utama — Operasionalisasi G3_DELPHI dan simulator Delphi (M6)

Tidak ada konstanta yang berubah. `evaluateDelphiGate` di `lib/method/gates.ts` diganti dari evaluasi per ronde menjadi per butir (vektor G3-1…G3-9, docs/05 §6); empat test lama diganti vektor baru.

| Keputusan | Rujukan | Alasan |
|---|---|---|
| Delphi menilai versi DRAF turunan pasca-FGD; syarat G1 versi itu dan G2 (diwarisi dari induk, tetap diluluskan Admin) | SPECIFICATION §4.6, docs/05 §6 | Pakar menilai artefak hasil revisi FGD, bukan A1.0 |
| Isu kejelasan kritis ditetapkan peneliti per butir; tanpa ambang otomatis. Ronde tidak dapat difinalisasi sebelum setiap penanda ditinjau | §3.8.1, Tabel 3.6 | Ambang tidak tercantum di naskah; tidak ditebak |
| S-CVI/Ave untuk G3 = rata-rata I-CVI terakhir seluruh butir, termasuk yang dihapus dari inti | §3.8.2, docs/05 §3.3 | Penghapusan tidak boleh menaikkan S-CVI |
| `HAPUS_DARI_INTI` wajib alasan konstruk peneliti; `TIDAK_SELESAI` setelah R3 dilaporkan terbuka, tidak memblokir | Tabel 3.6 | Keterlacakan keputusan butir |
| Penilai valid ≠ 8 menghentikan ronde tanpa menulis hasil butir; ulangi hanya kursi yang gagal | §3.8.3 | Aturan 7/8 tidak diterapkan otomatis |
| Suntingan artefak ditolak selama ada ronde belum final | docs/05 §6 | Rating merujuk isi yang dinilai |
| "Item baru" ditunda | Tabel 3.6 | Cakupan putaran ini |

---

## 2026-09-26 — Peneliti utama — Content lock (G4), simulator AHP, dan G5

Tidak ada konstanta yang berubah. Evaluator baru `evaluateContentLockGate` dan `evaluateAhpGate` per grup di `lib/method/gates.ts`, helper `expectedAhpGroups` dan `pairValue` di `lib/method/ahp.ts` (vektor G4-1…G4-5, G5-1…G5-8, docs/05 §6); empat test G5 lama diganti.

| Keputusan | Rujukan | Alasan |
|---|---|---|
| Content lock membuat versi baru A2.0 `CONTENT_LOCKED`; butir `HAPUS_DARI_INTI`/`TIDAK_SELESAI` tidak ikut dan dicatat `HAPUS`; versi Delphi dibekukan | §3.9.1, Tabel 3.6 | Hierarki AHP = instrumen inti; versi Delphi tetap dapat ditelusuri |
| Tombol kunci = keputusan eksplisit Admin: G4 `PASSED` dan G1–G3 dicatat diwarisi pada versi terkunci | docs/07 P7 | Satu keputusan tercatat, bukan kelulusan otomatis |
| Aspek yang kosong setelah pengecualian memblokir lock | docs/05 §5.1 | Aspek tanpa indikator tidak dapat diskor |
| Grup matriks: domain + aspek per domain beraspek ≥ 2; aspek tunggal berbobot lokal 1 | §3.9.1, docs/05 §5.1 | Tidak ada penilaian untuk n = 1 |
| Panel AHP dipilih per sesi (FGD_6/DELPHI_8) dengan cakupan per kursi (domain, aspek, keduanya) | SPECIFICATION §4.7 | Konfigurasi di awal |
| Skenario sensitivitas bawaan ±0,05 dan ±0,10 absolut per domain (`lib/ahp/scenarios.ts`, dapat diubah sebelum sesi) | §3.9.2 | Desain uji, bukan ambang |
| Matriks tak terselesaikan setelah 2 peninjauan dikeluarkan dan dilaporkan; grup tanpa matriks diterima memblokir G5 | docs/04 §8, §3.9.2 | Tidak ada koreksi otomatis |
| Sesi AHP baru ditolak setelah G5 `PASSED` | docs/07 P7 | Keputusan Admin merujuk bobot sesi tertentu |

---

## 2026-09-26 — Peneliti utama — Penskoran (M7) dan G6

Tidak ada konstanta yang berubah. Baru di `lib/method`: `evidenceLevelCap` (vektor E1–E5, docs/05 §5.5) dan `evaluateScoringGate` (vektor G6-1…G6-9, docs/05 §6). `scripts/recompute.py` ditambah pemeriksaan agregat AHP dan opsi `--report`.

| Keputusan | Rujukan | Alasan |
|---|---|---|
| Asesor = simulasi AI atas profil institusi **fiktif** yang ditulis peneliti; tanpa input level manual | SPECIFICATION §4.8, docs/07 | Menguji keterpakaian rubrik tanpa data institusi nyata |
| Plafon level = level tertinggi yang seluruh bukti wajibnya (minimumFor ≤ L) terpenuhi; bukti wajib tanpa minimumFor berlaku sejak level 1; lantai level 1; level di atas plafon ditolak, bukan dipangkas | SPECIFICATION §4.8 | Aturan evidence-to-level dibuat dapat diperiksa |
| Skor memakai bobot agregat sesi AHP yang diluluskan G5 saja; aspek tunggal berbobot 1 | §3.10.2, docs/05 §5.1 | Tidak ada bobot seragam dalam asesmen; kalkulator bagaimana-jika menandainya jelas |
| G6 mewajibkan kasus `MISSING_ADMINISTRATIF` dan `TIDAK_ADA_KAPABILITAS` pada asesmen nyata, terpropagasi di rollup | §3.10.1, docs/05 §5.2 | "Penanganan data hilang terverifikasi" dibuktikan pada data, bukan hanya vektor |
| Rekalkulasi independen: ekspor deterministik → `recompute.py --report` di mesin peneliti → unggah; diterima hanya untuk SHA-256 ekspor terkini, toleransi ≤ 1e-6 | §3.14, docs/05 §7 | Berjalan tanpa Python di server; laporan usang/palsu ditolak |
| Asesmen baru ditolak setelah G6 `PASSED` | docs/07 P7 | Keputusan Admin merujuk data asesmen tertentu |

---

## 2026-09-26 — Peneliti utama — Pipeline, anggaran, ekspor, dan reproduksibilitas (M8)

Tidak ada konstanta yang berubah. Baru di `lib/method`: `runMethodSelfCheck` (vektor docs/05 yang dijalankan aplikasi untuk kriteria §6.1; diuji). `assertSingleOrigin` kini juga dipanggil pada agregasi rating Delphi (docs/07 P2).

| Keputusan | Rujukan | Alasan |
|---|---|---|
| Pipeline tidak pernah meluluskan gate atau mengambil keputusan peneliti; ia menunggu (`WAITING_GATE`, `WAITING_RESEARCHER`) | docs/07 P7 | Otomatisasi tanpa melewati Admin |
| Sesi FGD baru dalam run mengevaluasi ulang G2 versi sumber; G2 yang sudah lulus turun sampai usulan baru diputuskan dan Admin meluluskan lagi | SPECIFICATION §4.5 | Hasil baru tidak lolos tanpa ditinjau |
| Revisi antar-ronde Delphi dikonfirmasi peneliti dengan melanjutkan run | SPECIFICATION §4.6 | Revisi adalah keputusan peneliti |
| Anggaran sesi, anggaran run, dan plafon bulanan menolak panggilan sebelum dikirim; model tanpa harga ditolak bila ada anggaran | docs/04 §9, docs/08 risiko biaya | Pemutus anggaran yang tidak dapat terlampaui |
| Retensi: data simulasi diarsipkan, tidak ada penghapusan massal; seed/reset basis data hanya lewat CLI | docs/07 §3.5 | Jejak proses dipertahankan; tindakan tak dapat dibatalkan tidak diberi tombol |

---

## 2026-09-26 — Peneliti utama — Form builder (M3) dan Delphi pakar manusia

Tidak ada konstanta yang berubah. Aturan Tabel 3.6 dan G3 dipakai apa adanya untuk ronde REAL.

| Keputusan | Rujukan | Alasan |
|---|---|---|
| Satu versi = satu origin Delphi: ronde REAL hanya pada versi tanpa ronde simulasi, dan sebaliknya (`DELPHI_ORIGIN_CONFLICT`) | docs/07 P2 | G3, lock, dan tahap berikutnya jelas berasal dari satu origin |
| Respons DRY_RUN disimpan SIMULATED dengan respondentRef `UJI:<user>` dan tidak pernah dihitung | docs/07 P1, P3 | Uji coba tanpa mencemari data pakar |
| Umpan balik R2/R3 pakar manusia: skor pribadi + median, IQR, sebaran kelompok, tanpa jawaban/identitas pakar lain | §3.8.1, §3.13.2 | Sama dengan kursi simulasi |
| Kursi i ↔ kode panel ke-i, tetap sama di setiap ronde | §3.8.1 | Umpan balik personal dan penyebut konsisten |
| Kode tanpa respons, respons menolak, atau butir tidak dinilai = null (tidak diimputasi) → ronde berhenti bila penilai valid ≠ 8 | §3.8.3 | Aturan 7/8 tidak diterapkan otomatis |
| Formulir aktif hanya oleh Admin, bila struktur valid (tanpa siklus), ada responden, dan gate sebelum tahapnya lulus | SPECIFICATION §4.2 | Instrumen tidak dibuka sebelum waktunya |
| Unggah berkas ditunda | — | Menunggu penyimpanan berkas dikonfigurasi |

