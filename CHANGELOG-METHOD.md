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

