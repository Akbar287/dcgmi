# SPECIFICATION.md — DCGMI Dry-Run Console

**Versi dokumen:** DDC-SPEC-1.0
**Terikat pada:** R1–V1.7 (Laporan Antara, 19 September 2026)
**Jalur kerja induk:** R1–V2.1.2B — *Google Forms Build, Controlled Dry-Run, and Deployment Readiness*

---

## 1. Tujuan sistem

Menyediakan lingkungan terkendali untuk menguji kesiapan instrumen DCGMI sebelum instrumen tersebut dipakai pada pakar manusia, dengan cara:

1. Membangun dan menjalankan formulir pengumpulan data (pengganti/pendamping Google Forms) beserta ekspornya.
2. Mensimulasikan FGD dengan panel pakar berbasis AI yang diprofilkan dari CV pakar asli.
3. Menjalankan Delphi/CVI, AHP, dan mesin penskoran atas hasil simulasi untuk memverifikasi **kebenaran formula, percabangan, dan keterlacakan** — bukan untuk memperoleh temuan.
4. Menghasilkan jejak audit yang dapat diperiksa: siapa/apa mengubah apa, kapan, dan atas dasar apa.

### 1.1 Yang **bukan** tujuan sistem

- Menggantikan FGD atau Delphi dengan pakar manusia.
- Menghasilkan I-CVI, bobot AHP, atau skor kematangan yang dapat dilaporkan.
- Menyimpulkan apa pun tentang perguruan tinggi nyata.

---

## 2. Aktor

| Aktor | Hak |
|---|---|
| **Admin** (peneliti utama; dulu Owner) | Semua. Satu-satunya yang boleh mengaktifkan gate, mengubah versi artefak, mengelola pengguna, dan melihat Identitas Panelis |
| **Tester** (anggota tim; dulu Editor) | CRUD artefak, formulir, pakar; menjalankan simulasi; tidak boleh menutup gate |
| **Pakar** (pakar manusia) | Hanya mengisi instrumen yang ditugaskan. Tidak mengakses konsol simulasi agar penilaiannya tidak terpengaruh keluaran panel AI; masukannya ditulis `REAL` lewat jalur intake terpisah |
| **Responden formulir** | Tanpa akun; akses lewat tautan `/f/[slug]` |

**Autentikasi** (Auth.js v5): Google atau email + kata sandi. Hanya email yang sudah didaftarkan Admin yang dapat masuk; akun baru berperan `PAKAR` sampai diubah. Peran dibaca ulang dari basis data pada setiap permintaan, sehingga penonaktifan berlaku seketika.
| **Agen Pakar AI** | Bukan pengguna. Proses server yang menulis ke tabel bertanda `SIMULATED` |

---

## 3. Model tahap dan gate

Sistem memodelkan tahap penelitian sebagai mesin status yang memblokir.

```
BASELINE ──▶ FGD ──▶ DELPHI_CVI ──▶ CONTENT_LOCK ──▶ AHP ──▶ SCORING ──▶ PILOT
   A1.0        A1.1      kandidat        A2.0         bobot     profil    bersyarat
                       content-valid
```

| Gate | Syarat lulus | Sumber |
|---|---|---|
| `G1_BASELINE` | Struktur lengkap: 8 domain, 15 aspek, 43 indikator, tiap indikator punya rubrik 1–5 dan persyaratan bukti | §3.5, §3.6 |
| `G2_FGD` | Seluruh komponen agenda memiliki posisi panel dan keputusan tercatat; matriks revisi A1.0→A1.1 lengkap dan dapat diaudit | §3.7.3 |
| `G3_DELPHI` | Setiap butir selesai (lolos, direvisi-dinilai-ulang sampai ronde 3, atau dikeluarkan dengan alasan tercatat); S-CVI/Ave ≥ 0,90 | §3.8.2 |
| `G4_CONTENT_LOCK` | Admin mengunci struktur secara eksplisit; setelah ini perubahan struktur memicu pembukaan ulang gate | §3.9.1 |
| `G5_AHP` | Setiap matriks individual CR < 0,10; agregasi geometris tercatat; sensitivitas dijalankan | §3.9.2 |
| `G6_SCORING` | Uji formula lulus; penanganan data hilang terverifikasi; rekalkulasi independen identik | §3.10, §3.14 |
| `G7_PILOT` | Bersyarat: etik, akses institusi, stabilitas rubrik | §3.11 |

**Aturan implementasi:** tahap N+1 memanggil `assertGate(N)` di server sebelum mutasi apa pun. Gate yang gagal melempar `GateError` dengan daftar syarat yang belum terpenuhi.

**Aturan buka-ulang:** perubahan struktur setelah `G4_CONTENT_LOCK` mengembalikan status ke `DELPHI_CVI` dan membatalkan bobot AHP yang ada (§2.8.3, CH-02). Bobot lama disimpan sebagai arsip, tidak dihapus.

---

## 4. Modul

### 4.1 Artefak Registry

CRUD atas hierarki DCGMI beserta seluruh metadatanya.

**Entitas:** `ArtifactVersion` → `Domain` → `Aspect` → `Indicator` → `RubricLevel` (5 baris) + `EvidenceRequirement`.

**Paket penilaian per indikator** (wajib lengkap sebelum G1, §3.6.1): kode, domain, aspek, definisi operasional, objek penilaian, bukti minimum, bukti penguat, deskriptor level 1–5, sumber, catatan batas.

**Jenis bukti** (§3.6.1): `NORMATIF | IMPLEMENTASI | OPERASIONAL | HASIL | PERBAIKAN`.

**Fitur:**
- Tabel TanStack dengan filter per domain/aspek, pencarian kode, kolom yang dapat disembunyikan, ekspor.
- Editor rubrik berdampingan: 5 kolom level, validasi "berurutan, terbedakan, realistis, evidence-anchored".
- Diff viewer antar `ArtifactVersion` (A1.0 vs A1.1) — tambah / hapus / gabung / pecah / pindah / rumus-ulang.
- Badge **controlled exception** pada `C20b` dan `C42`; percobaan hapus/rename memunculkan dialog konfirmasi berlapis dan mencatat keputusan versi.
- Indikator kesehatan baseline: distribusi indikator per domain harus `7–5–6–6–4–5–4–6` pada A1.0; penyimpangan ditandai, tidak diblokir.

### 4.2 Form Builder & Runner

Pengganti Google Forms yang sadar-metodologi.

**Tipe field:** teks pendek, paragraf, pilihan tunggal, pilihan ganda, dropdown, skala linier, **skala relevansi 4 titik** (tipe khusus Delphi), **matriks pairwise Saaty** (tipe khusus AHP), unggah berkas, tanggal, bagian/section, teks penjelas.

**Fitur:**
- Percabangan (`go to section based on answer`) dengan pemeriksa siklus.
- Setiap formulir membawa `versionId`, tanggal, tujuan, petunjuk, definisi, dan aturan pengisian (§3.12).
- Status formulir: `DRAFT | DRY_RUN | HOLD | ACTIVE | CLOSED`. Default `HOLD`. Hanya Admin yang boleh `ACTIVE`, dan hanya bila gate terkait lulus.
- Runner publik `/f/[slug]`: autosave, progres, dapat dilanjutkan, ramah ponsel.
- Tabel respons (TanStack Table): kolom virtual, ekspor CSV/XLSX, tanda `SIMULATED`/`REAL` per baris.
- **Form pra-reviu pakar R1–V2.1.2B** (keputusan peneliti, 26 September 2026):
  - Isi diimpor dari skrip Apps Script peneliti (`docs/R1-V2.1.2B-form-builder.gs`) dengan menjalankan `plan_('PRODUCTION')`/`description_()` aslinya; snapshot `DATA` diverifikasi SHA-256 (`352364f6…`) dan disimpan beserta signature build. Isi yang berubah tidak menimpa form; versi baru memakai slug baru.
  - Hanya mode PRODUCTION; dry-run Google Form dicatat di `TEST_EVIDENCE_NOTE`.
  - **Tidak terikat gate.** Syarat `ACTIVE` = `productionReadiness_()` + verifikasi isi terhadap snapshot. Rubrik 1–5 berada di luar cakupan (`LIMITED_REVIEW_SCOPE_ACKNOWLEDGED`).
  - Kode pakar (P01–P06) diikat ke akun Pakar oleh Admin; respons hanya menyimpan kode, bertanda `REAL` sejak penulisan pertama.
  - Aturan "alasan dan usulan bermakna wajib bila keputusan selain *Dapat dipertahankan*" ditegakkan saat pindah halaman dan saat kirim; QC ekspor (`normalize_()`) tetap dijalankan dan diuji paritasnya terhadap fungsi asli.
  - "Tidak bersedia" hanya mencatat pilihan dan waktu (tanpa kode/akun).
- **Import/Export Google Forms**: ekspor definisi ke JSON + skrip Apps Script untuk membangun form padanan; impor respons dari CSV Google Forms dengan pemetaan kolom.

### 4.3 Expert Registry

CRUD pakar asli dan persona turunannya.

**Field:** nama (opsional, dapat disamarkan), kode panelis, bidang (`IT_GOVERNANCE | MANAJEMEN_PT | SPBE | SUSTAINABILITY`), afiliasi, deklarasi konflik kepentingan, status keikutsertaan (FGD / Delphi / AHP), berkas CV.

**Alur pembentukan persona:**

1. Unggah CV (PDF/DOCX). Berkas disimpan di storage terpisah dari basis data analisis (§3.13.2, least privilege).
2. Ekstraksi terstruktur → `PersonaBrief`: bidang keahlian, tahun pengalaman, jenis institusi, fokus riset, posisi metodologis yang terlihat dari publikasi, kosakata khas, kecenderungan penekanan.
3. **De-identifikasi wajib** sebelum brief dikirim ke provider mana pun: nama, institusi, gelar, dan penanda unik diganti placeholder. Yang dikirim adalah profil kompetensi, bukan identitas.
4. Peneliti meninjau dan menyetujui brief. Brief tidak dipakai sebelum berstatus `APPROVED`.

> **Catatan etik yang harus tampil di UI:** persona adalah abstraksi kompetensi, bukan representasi pendapat pakar yang bersangkutan. Keluarannya tidak boleh diatribusikan kepada orang tersebut. Gunakan hanya CV yang publik atau yang pemiliknya telah memberi izin.

### 4.4 AI Panel Configuration

Menghubungkan slot pakar ke provider model.

**Konfigurasi panel:**

| Field | Keterangan |
|---|---|
| `panelSize` | Jumlah pakar, dapat diatur. Preset: 6 (FGD, §3.7.1), 8 (Delphi/AHP, §3.8.1) |
| `seats[]` | Tiap kursi: label (`Pakar 1`), `expertId` (persona), `providerId`, `model`, `temperature`, `seed` |
| `facilitator` | Model terpisah untuk fasilitator |
| `notetaker` | Model terpisah untuk notulis/pengkode |

**Provider yang didukung** (lewat Vercel AI SDK): OpenAI, Anthropic, Google, DeepSeek, Alibaba Qwen (endpoint OpenAI-compatible), Mistral, xAI, dan endpoint OpenAI-compatible kustom (mis. model lokal).

**Aturan panel:**
- Komposisi bidang harus cocok dengan preset yang dipilih. Preset FGD-6: 2 IT governance, 2 manajemen PT, 1 SPBE, 1 sustainability. Preset Delphi-8: enam kursi FGD + 1 SPBE baru + 1 sustainability baru (§3.8.1).
- Dua kursi "pakar baru" pada preset Delphi-8 **tidak menerima konteks FGD** pada ronde 1. Ini diberlakukan di orkestrator, bukan sekadar catatan.
- Disarankan setiap kursi memakai provider berbeda untuk mengurangi korelasi keluaran. Bila dua kursi memakai model sama, UI menampilkan peringatan korelasi.

### 4.5 FGD Simulator

**Agenda 11 tahap (alur corong, §3.7.2):** pembukaan → validasi masalah → struktur domain → struktur aspek → indikator → rubrik → formula → pembobotan → interpretasi → konteks Indonesia → prioritas revisi.

**Siklus per komponen:**

1. Fasilitator menyajikan komponen + paket penilaiannya.
2. Tiap kursi pakar memberi argumen (urutan diacak per komponen untuk mengurangi bias posisi).
3. Satu ronde tanggapan silang (opsional, dapat dibatasi jumlah putaran).
4. Tiap kursi memberi posisi: `TERIMA | TERIMA_DENGAN_REVISI | TOLAK` + alasan + tindakan yang diusulkan (`TAMBAH | HAPUS | GABUNG | PECAH | PINDAH | RUMUS_ULANG`).
5. Notulis mengekstrak: kutipan, bidang pakar, posisi, tindakan usulan, alasan.
6. Mesin aturan menerapkan Tabel 3.5 dan menghasilkan keputusan.

**Aturan keputusan FGD (Tabel 3.5, panel 6):**

| Kondisi | Tindakan sistem |
|---|---|
| ≥4 dari 6 memilih selain "terima" | `REVISI` komponen pada A1.1 |
| ≥2 dari 6 memilih "tolak" | `PEMBAHASAN_KHUSUS` sebelum tindakan ditetapkan |
| 3 terima : 3 selain terima | `TIDAK_SEPAKAT` — prioritas Delphi |
| 1–2 catatan substantif | `PERTAHANKAN_SEMENTARA` — catatan diteruskan ke Delphi |
| Saran tidak diadopsi | Wajib isi alasan eksplisit pada matriks keputusan |

Aturan ini **membantu keputusan, bukan menghitung validitas** (§3.7.3). UI harus menyatakan itu di setiap layar hasil FGD.

**Keluaran:** transkrip lengkap, lembar keputusan per komponen, matriks revisi A1.0→A1.1, daftar isu yang diteruskan ke Delphi.

**Mode eksekusi:** `STEP` (peneliti menyetujui tiap tahap) dan `AUTO` (berjalan sampai selesai, berhenti pada `PEMBAHASAN_KHUSUS`). Progres real-time lewat streaming.

### 4.6 Delphi / CVI

**Panel:** 8 kursi. **Skala:** 4 titik (1 tidak relevan … 4 sangat relevan). Skor 3–4 dihitung relevan.

**Kejelasan dinilai terpisah** dari relevansi (penanda + komentar), agar skor relevansi tidak tercampur mutu redaksi (§3.8.1).

**Aturan ronde:**
- Ronde 1: seluruh indikator dan rubrik.
- Ronde 2: hanya butir yang belum memenuhi aturan, dan butir baru.
- Ronde 3: bila masih ada perubahan bermakna. Berhenti setelahnya.
- Umpan balik antar-ronde menampilkan skor pribadi, median, IQR, distribusi kelompok — **tanpa identitas** (§3.13.2).

**Aturan keputusan (Tabel 3.6):**

| Keputusan | Kriteria |
|---|---|
| Pertahankan | I-CVI ≥ 0,78 **dan** median ≥ 3 **dan** IQR ≤ 1 **dan** tidak ada isu kejelasan kritis |
| Revisi & nilai ulang | I-CVI 0,50–<0,78, atau IQR > 1, atau redaksi/bukti ambigu |
| Hapus dari inti | I-CVI < 0,50 atau konflik konstruk mendasar |
| Item baru | Usulan pakar dengan definisi dan sumber memadai → dinilai penuh pada ronde berikutnya |
| Skala | S-CVI/Ave ≥ 0,90 |
| Tidak selesai setelah ronde 3 | Keluarkan dari instrumen inti, laporkan terbuka |

**Penanganan panel tidak lengkap (§3.8.3):** bila jumlah penilai valid ≠ 8, sistem **menghentikan ronde** dan menolak menerapkan aturan 7/8 secara otomatis. Penyebut aktual ditampilkan bersama setiap nilai I-CVI. Sel kosong tidak diimputasi sebagai skor rendah.

### 4.7 AHP

**Ruang lingkup:** bobot antar-domain dan bobot antar-aspek di dalam tiap domain. Indikator diperlakukan setara kecuali ada justifikasi terpisah yang diuji ulang (§3.9.1).

**Konfigurasi di awal** (sesuai permintaan: klasifikasi AHP diatur sebelum proses berjalan):
- Pemilihan hierarki sumber (harus versi `CONTENT_LOCKED`).
- Skala Saaty 1–9 + nilai antara.
- Metode agregasi: rata-rata geometris (default, terkunci).
- Ambang `CR < 0,10`.
- Skenario sensitivitas: daftar perubahan bobot yang akan diuji.
- Kursi mana yang mengisi matriks domain, matriks aspek, atau keduanya.

**Perhitungan:** normalisasi matriks → eigenvector utama → `CI = (λmax − n)/(n − 1)` → `CR = CI/RI`. Matriks dengan CR ≥ 0,10 **dikembalikan ke kursi pakar untuk ditinjau**, tidak diperbaiki otomatis (§3.9.2).

**Pelaporan wajib:** bobot individual, bobot agregat, CR individual, CR agregat, variasi antarpakar, hasil sensitivitas. UI tidak boleh menyembunyikan variasi.

### 4.8 Scoring Engine

**Evidence-to-level:** asesor (atau agen simulasi) mencatat locator bukti, menilai kecukupan terhadap deskriptor, memilih level tertinggi yang seluruh syarat wajibnya terpenuhi.

**Formula (§3.10.2):**

```
A(i,j) = (1/n(i,j)) · Σ_k r(i,j,k)        skor aspek
D(i)   = Σ_j w(j|i) · A(i,j)              skor domain
DCGMI  = Σ_i w(i) · D(i)                  skor total
```

`r ∈ [1,5]`. Aspek tunggal dalam satu domain berbobot lokal 1. Seluruh bobot pada tiap tingkat berjumlah 1.

**Data hilang:** dibedakan menjadi `TIDAK_ADA_KAPABILITAS` (boleh menghasilkan level rendah) dan `MISSING_ADMINISTRATIF` (menahan skor agregat). **Tidak ada imputasi rerata.**

**Interpretasi:** profil 8 domain adalah keluaran utama; skor komposit adalah ringkasan sekunder. UI menampilkan profil domain lebih dulu, tidak boleh menampilkan angka tunggal sendirian. Kategori komposit berstatus **provisional** — tidak dikalibrasi dari sampel kecil (§3.10.3).

### 4.9 Pipeline Runner

Menjalankan rantai tahap secara otomatis.

**Definisi run:** artefak sumber, konfigurasi panel, preset agenda, parameter Delphi, konfigurasi AHP, skenario sensitivitas, mode (`STEP`/`AUTO`), anggaran token dan biaya maksimum.

**Perilaku:** eksekusi antrian dengan checkpoint per tahap; berhenti pada gate gagal; dapat dilanjutkan; log per langkah (prompt hash, model, token, biaya, latensi); estimasi biaya sebelum jalan; tombol batal.

**Monitor:** timeline tahap, kartu status per kursi pakar, aliran transkrip langsung, meter biaya berjalan.

### 4.10 Audit & Export

- `ChangeLogEntry` untuk setiap mutasi artefak: `versionId`, tipe tindakan, alasan, sumber keputusan, tanggal, dampak pada komponen terkait (§3.5).
- `AuditEvent` untuk setiap aksi pengguna dan setiap panggilan model.
- Ekspor: CSV, XLSX, JSON, PDF. Semua ekspor dari data `SIMULATED` memuat banner dan watermark yang tidak dapat dimatikan.
- Paket reproduksibilitas: satu berkas ZIP berisi definisi artefak, konfigurasi panel, seluruh prompt, seluruh keluaran mentah, hasil perhitungan, dan hash — memenuhi "jejak komputasional" §3.14.

### 4.11 Settings

Provider & kunci API · profil model per kursi · ambang metodologis (tampil **read-only** dengan alasan terkunci; perubahan lewat berkas + changelog) · batas biaya · retensi data · peran pengguna · bahasa · tema · seed & reset basis data.

---

## 5. Kebutuhan non-fungsional

| Aspek | Ketentuan |
|---|---|
| Keamanan | Kunci API hanya di server. CV disimpan di bucket privat dengan URL bertanda tangan dan masa berlaku pendek |
| Privasi | Pemetaan kode↔identitas panelis di tabel terpisah dengan akses terbatas Admin (§3.13.2) |
| Auditabilitas | Setiap angka yang ditampilkan dapat ditelusuri ke data sumbernya dalam ≤3 klik |
| Determinisme | Setiap run menyimpan seed, versi prompt, dan versi model agar dapat direproduksi sejauh provider mengizinkan |
| Kinerja | Tabel 43 indikator × 8 penilai × 3 ronde harus responsif tanpa paginasi server |
| Aksesibilitas | Kontras WCAG AA; navigasi keyboard penuh; hormati `prefers-reduced-motion` |
| Biaya | Estimasi sebelum run; pemutus otomatis saat anggaran terlampaui |
| Offline/mock | `MOCK_AI=1` menjalankan seluruh alur dengan fixture tanpa memanggil provider |

---

## 6. Kriteria penerimaan

Sistem dinyatakan siap untuk dry-run resmi bila:

1. `pnpm method:verify` lulus seluruh test vector di `docs/05-METHOD-RULES.md`.
2. Rekalkulasi independen (skrip terpisah, mis. Python) atas satu run menghasilkan angka identik sampai 6 desimal.
3. Mencoba menjalankan AHP sebelum `CONTENT_LOCK` menghasilkan `GateError` yang informatif.
4. Mencoba mengagregasi campuran `SIMULATED` + `REAL` menghasilkan `OriginMismatchError`.
5. Ekspor dari run simulasi memuat watermark pada setiap halaman/baris header.
6. Panel Delphi dengan penilai valid ≠ 8 menghentikan ronde, bukan menyesuaikan ambang.
7. Seluruh 43 indikator memiliki rubrik 5 level dan persyaratan bukti lengkap sebelum `G1` lulus.
