# 05 — Aturan Metodologis & Test Vector

Dokumen ini adalah **sumber kebenaran tunggal** untuk semua perhitungan. Setiap angka di sini berasal dari R1–V1.7. Bila implementasi dan dokumen ini berbeda, dokumen ini yang benar.

Seluruh isi diimplementasikan di `lib/method/` sebagai fungsi murni, dan diverifikasi oleh `pnpm method:verify`.

---

## 1. Konstanta terkunci

```ts
// lib/method/constants.ts
export const METHOD = {
  // Delphi / CVI — R1-V1.7 §3.8.2
  I_CVI_MIN:        0.78,   // batas operasional: 7 dari 8 pakar
  I_CVI_REVISE_MIN: 0.50,   // 0.50 <= I-CVI < 0.78 → revisi & nilai ulang
  S_CVI_AVE_MIN:    0.90,
  MEDIAN_MIN:       3,
  IQR_MAX:          1,
  RELEVANCE_SCALE:  [1, 2, 3, 4] as const,
  RELEVANT_SCORES:  [3, 4] as const,
  MAX_ROUNDS:       3,
  DELPHI_PANEL_SIZE: 8,

  // FGD — R1-V1.7 §3.7.1, Tabel 3.5
  FGD_PANEL_SIZE:   6,
  FGD_REVISE_NON_ACCEPT_MIN: 4,   // >=4 dari 6 selain "terima"
  FGD_SPECIAL_REJECT_MIN:    2,   // >=2 dari 6 "tolak"

  // AHP — R1-V1.7 §3.9.2
  CR_MAX:           0.10,
  SAATY_SCALE:      [1,2,3,4,5,6,7,8,9] as const,
  AGGREGATION:      'GEOMETRIC_MEAN' as const,

  // Scoring — R1-V1.7 §3.10.2
  LEVEL_MIN: 1,
  LEVEL_MAX: 5,

  // Pilot — R1-V1.7 Tabel 3.8
  PILOT_COMPLETENESS_MIN: 0.90,
  PILOT_KAPPA_MIN:        0.60,
  PILOT_AGREEMENT_MIN:    0.80,
  PILOT_TRACEABILITY:     1.00,
} as const;
```

> **Peringatan yang harus dibaca sebelum menyentuh angka ini.** Rancangan lama memakai I-CVI ≥ 0,75. R1–V1.7 §3.8.2 menurunkan statusnya menjadi **statistik kesepakatan deskriptif saja**. Yang mengikat untuk keputusan validitas isi adalah **0,78**, yang dengan 8 pakar berarti **7 dari 8**. Jangan "memperbaiki" ini kembali ke 0,75.

---

## 2. FGD — aturan keputusan

### Algoritma

```
input  : positions[] (satu per kursi, panel n = 6)
output : { decision, tally, ruleFired }

tally.TERIMA, tally.TERIMA_DENGAN_REVISI, tally.TOLAK
nonAccept = n - tally.TERIMA

1. jika tally.TOLAK >= 2                          → PEMBAHASAN_KHUSUS  (GE2_TOLAK)
2. jika nonAccept >= 4                            → REVISI             (GE4_NON_TERIMA)
3. jika tally.TERIMA == 3 && nonAccept == 3       → TIDAK_SEPAKAT      (SPLIT_3_3)
4. jika nonAccept dalam {1,2}                     → PERTAHANKAN_SEMENTARA (NOTES_1_2)
5. selain itu                                     → TERIMA
```

**Urutan evaluasi penting.** Aturan "≥2 tolak" dievaluasi lebih dulu karena memicu pembahasan khusus *sebelum* tindakan ditetapkan (§3.7.3). Bila keduanya terpenuhi, sistem mencatat `PEMBAHASAN_KHUSUS` dan menyimpan bahwa ambang revisi juga terpenuhi di kolom `note`.

### Test vector — FGD

| # | TERIMA | REVISI | TOLAK | Harapan | ruleFired |
|---|---|---|---|---|---|
| F1 | 6 | 0 | 0 | `TERIMA` | — |
| F2 | 5 | 1 | 0 | `PERTAHANKAN_SEMENTARA` | `NOTES_1_2` |
| F3 | 4 | 2 | 0 | `PERTAHANKAN_SEMENTARA` | `NOTES_1_2` |
| F4 | 3 | 3 | 0 | `TIDAK_SEPAKAT` | `SPLIT_3_3` |
| F5 | 2 | 4 | 0 | `REVISI` | `GE4_NON_TERIMA` |
| F6 | 4 | 0 | 2 | `PEMBAHASAN_KHUSUS` | `GE2_TOLAK` |
| F7 | 1 | 2 | 3 | `PEMBAHASAN_KHUSUS` | `GE2_TOLAK` (+note: GE4 juga terpenuhi) |
| F8 | 3 | 2 | 1 | `TIDAK_SEPAKAT` | `SPLIT_3_3` |
| F9 | 0 | 6 | 0 | `REVISI` | `GE4_NON_TERIMA` |

---

## 3. Delphi / CVI

### 3.1 I-CVI

```
I-CVI = (jumlah penilai yang memberi skor 3 atau 4) / (jumlah penilai valid)
```

`jumlah penilai valid` = penilai yang benar-benar mengisi (bukan null). **Selalu tampilkan bersama nilainya.**

### 3.2 Median dan IQR

Skala ordinal 4 titik. Gunakan definisi kuartil **tipe 7** (interpolasi linier, default R/NumPy) agar hasil dapat direproduksi oleh skrip pemeriksa independen. Catat pilihan ini di laporan; jangan diam-diam pakai definisi lain.

```
IQR = Q3 − Q1
```

### 3.3 S-CVI/Ave

```
S-CVI/Ave = rata-rata I-CVI seluruh butir yang dinilai pada ronde tersebut
```

Tidak boleh dinaikkan dengan menghapus butir secara mekanis. Setiap penghapusan wajib punya alasan konstruk + bukti komentar pakar + pemeriksaan dampak cakupan domain (§3.8.2). Sistem menolak `DelphiDecision.HAPUS_DARI_INTI` tanpa `reason` terisi.

### 3.4 Keputusan per butir

```
jika validRaters != panelSize yang direncanakan → HENTIKAN RONDE, lapor deviasi
jika iCvi >= 0.78 && median >= 3 && iqr <= 1 && !clarityCritical → PERTAHANKAN
jika iCvi < 0.50 || konflikKonstrukMendasar                      → HAPUS_DARI_INTI
jika iCvi < 0.78 || iqr > 1 || ambiguRedaksiAtauBukti            → REVISI_NILAI_ULANG
jika round == 3 && belum memenuhi                                → TIDAK_SELESAI
```

### 3.5 Test vector — CVI (panel 8)

| # | Rating 8 kursi | I-CVI | median | IQR | Keputusan |
|---|---|---|---|---|---|
| C1 | 4,4,4,4,4,3,3,3 | 1.000 | 4.0 | 1.0 | `PERTAHANKAN` |
| C2 | 4,4,4,4,4,4,4,2 | 0.875 | 4.0 | 0.0 | `PERTAHANKAN` |
| C3 | 4,4,4,4,4,4,2,2 | 0.750 | 4.0 | 0.5 | `REVISI_NILAI_ULANG` ← 0,75 **tidak** lolos |
| C4 | 4,4,3,3,2,2,2,2 | 0.500 | 2.5 | 1.25 | `REVISI_NILAI_ULANG` |
| C5 | 3,2,2,2,2,1,1,1 | 0.125 | 2.0 | 1.0 | `HAPUS_DARI_INTI` |
| C6 | 4,4,4,4,1,1,1,1 | 0.500 | 2.5 | 3.0 | `REVISI_NILAI_ULANG` (IQR > 1) |
| C7 | 4,4,4,4,4,4,4,null | 1.000 (n=7) | 4.0 | 0.0 | **Ronde dihentikan** — penilai valid ≠ 8 |

Test C3 dan C7 adalah dua kasus yang paling mudah diimplementasikan salah. Pastikan keduanya lulus.

### 3.6 Test vector — S-CVI

Butir dengan I-CVI `[1.000, 0.875, 0.875, 1.000, 0.750]` → S-CVI/Ave = `0.900` → tepat di ambang, **lolos** (`>= 0.90`).

---

## 4. AHP

### 4.1 Prioritas dari satu matriks

1. Susun matriks `A` berukuran `n×n`, `a[i][j] > 0`, `a[j][i] = 1/a[i][j]`, `a[i][i] = 1`.
2. Vektor prioritas: metode eigenvector utama. Implementasi memakai **iterasi pangkat** dengan normalisasi, toleransi `1e-10`, maksimum 1000 iterasi.
3. `λmax = Σ_i (A·w)_i / w_i / n`
4. `CI = (λmax − n) / (n − 1)`
5. `CR = CI / RI(n)`

### 4.2 Tabel Random Index (Saaty)

| n | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| RI | 0.00 | 0.00 | 0.58 | 0.90 | 1.12 | 1.24 | 1.32 | 1.41 | 1.45 | 1.49 |

Untuk `n <= 2`, `CR` didefinisikan `0` (matriks selalu konsisten).

### 4.3 Agregasi panel

Rata-rata geometris **atas sel matriks** (AIJ — aggregation of individual judgements), bukan atas vektor bobot:

```
a_agg[i][j] = ( Π_s a_s[i][j] )^(1/S)
```

`S` = jumlah matriks yang **diterima** (`cr < 0.10`). Matriks yang ditolak tidak ikut. Lalu hitung ulang prioritas dan CR agregat dari `a_agg`.

### 4.4 Kontrol

| Kontrol | Aturan |
|---|---|
| Hierarki masuk | Harus `ArtifactStatus.CONTENT_LOCKED` |
| Matriks individual | `CR < 0.10`; bila gagal → status `RETURNED_TO_SEAT`, bukan koreksi otomatis |
| Agregasi | Rata-rata geometris |
| Pelaporan | Bobot & CR individual **dan** agregat; variasi antarpakar tidak disembunyikan |
| Sensitivitas | Jalankan seluruh skenario terdaftar; tandai bila urutan domain berubah |

### 4.5 Test vector — AHP

**A1 — matriks konsisten sempurna (n=3)**

```
[ 1,   2,   4  ]
[ 1/2, 1,   2  ]
[ 1/4, 1/2, 1  ]
```
→ `w ≈ [0.5714, 0.2857, 0.1429]`, `λmax = 3.000`, `CI = 0`, `CR = 0` → **diterima**

**A2 — matriks Saaty klasik (n=3, tidak konsisten ringan)**

```
[ 1,   3,   5  ]
[ 1/3, 1,   3  ]
[ 1/5, 1/3, 1  ]
```
→ `w ≈ [0.6370, 0.2583, 0.1047]`, `λmax ≈ 3.0385`, `CI ≈ 0.0193`, `CR ≈ 0.0332` → **diterima**

**A3 — tidak konsisten, harus ditolak (n=3)**

```
[ 1,   9,   1/5 ]
[ 1/9, 1,   3   ]
[ 5,   1/3, 1   ]
```
→ `CR > 0.10` → **ditolak**, dikembalikan ke kursi pakar

**A4 — identitas (n=8)**
Seluruh sel = 1 → `w_i = 0.125` untuk semua i, `CR = 0`.

**A5 — agregasi geometris (2 matriks, n=2)**
`a1[0][1] = 3`, `a2[0][1] = 5` → `a_agg[0][1] = sqrt(15) ≈ 3.87298`

Toleransi perbandingan: `1e-6`.

---

## 5. Scoring

### 5.1 Formula

```
A(i,j) = (1/n(i,j)) · Σ_k r(i,j,k)
D(i)   = Σ_j w(j|i) · A(i,j)
DCGMI  = Σ_i w(i) · D(i)
```

- `r ∈ [1,5]`, bilangan bulat.
- `Σ_j w(j|i) = 1` untuk setiap domain i. Domain beraspek tunggal (D7, D8) → `w = 1`.
- `Σ_i w(i) = 1`.
- Validasi jumlah bobot dengan toleransi `1e-9`; selisih lebih besar → `MethodError`.

### 5.2 Data hilang

| Kode | Makna | Perlakuan |
|---|---|---|
| `TIDAK_ADA_KAPABILITAS` | Institusi memang belum punya praktiknya | Diskor sesuai rubrik (boleh level 1) |
| `MISSING_ADMINISTRATIF` | Akses, kerusakan, atau respons belum diterima | **Menahan skor agregat.** Aspek, domain, dan komposit yang terdampak dikembalikan sebagai `null` dengan daftar penyebab |

**Tidak ada imputasi rerata.** Bila satu indikator `MISSING_ADMINISTRATIF`, aspeknya tidak dihitung dengan n yang dikurangi — aspeknya menjadi `null`.

### 5.3 Interpretasi

- Keluaran utama = **profil 8 domain**. Komposit hanya ringkasan sekunder.
- Label level 1–5 berlaku di **tingkat indikator**. Interpretasi skor aspek/domain/total berstatus **provisional** sampai distribusi memadai tersedia (§3.10.3).
- API scoring mengembalikan `{ domainProfile, composite, compositeStatus: 'PROVISIONAL', missingReport }`. UI tidak boleh merender `composite` tanpa `domainProfile` di layar yang sama.
- Aturan floor / non-kompensasi hanya diterapkan bila pakar menetapkan indikator kritis dan alasannya terdokumentasi. Tidak boleh disisipkan setelah melihat hasil.

### 5.4 Test vector — Scoring

**S1 — kasus dasar**
Domain D7 (1 aspek, 4 indikator), skor `[3,4,3,2]` → `A = 3.00`, `w = 1` → `D7 = 3.00`.

**S2 — bobot domain**
`D = [3.0, 2.0, 4.0]`, `w = [0.5, 0.3, 0.2]` → `DCGMI = 1.5 + 0.6 + 0.8 = 2.90`.

**S3 — missing administratif**
Aspek dengan indikator `[4, MISSING_ADMINISTRATIF, 3]` → `A = null`; domain yang memuatnya `null`; komposit `null`; `missingReport` memuat kode indikatornya.

**S4 — tidak ada kapabilitas**
Aspek dengan indikator `[4, level 1 (TIDAK_ADA_KAPABILITAS), 3]` → `A = 2.6667`. Skor tetap dihitung.

**S5 — bobot tidak berjumlah 1**
`w = [0.5, 0.3, 0.3]` → lempar `MethodError('WEIGHTS_NOT_NORMALIZED')`.

---

## 6. Gate

```ts
assertGate(gate: GateKey, versionId: string): void
```

Mengembalikan daftar `unmet` bila gagal. Contoh untuk `G1_BASELINE`:

- `DOMAIN_COUNT_MISMATCH` — jumlah domain bukan 8 (peringatan, tidak memblokir bila sengaja diubah lewat FGD)
- `INDICATOR_WITHOUT_RUBRIC` — ada indikator tanpa 5 level rubrik (memblokir)
- `RUBRIC_LEVEL_GAP` — level 1–5 tidak lengkap atau tidak berurutan (memblokir)
- `INDICATOR_WITHOUT_EVIDENCE` — tidak ada `EvidenceRequirement` wajib (memblokir)
- `MISSING_OPERATIONAL_DEFINITION` (memblokir)

`G4_CONTENT_LOCK` hanya dapat di-`PASSED` oleh `ADMIN`, dan mencatat `AuditEvent` dengan alasan.

**Buka ulang:** perubahan struktur setelah content lock memanggil `reopenGates(['G3_DELPHI','G4_CONTENT_LOCK','G5_AHP'])`, mengarsipkan `AhpWeight` terkait, dan mencatat `ChangeLogEntry` dengan `decisionSource` yang memicu.

---

## 7. Rekalkulasi independen

`pnpm method:verify` menjalankan seluruh vector di atas terhadap implementasi TypeScript. Untuk memenuhi §3.14, tersedia pula `scripts/recompute.py` yang membaca ekspor JSON satu run dan menghitung ulang I-CVI, bobot AHP, dan skor dengan NumPy. Kedua hasil harus identik sampai **6 desimal**. Perbedaan apa pun adalah bug yang memblokir rilis.
