# 06 — Navigasi & Inventaris CRUD

## 1. Kerangka layout

Sidebar kiri (dapat diciutkan) · topbar dengan pemilih **Versi Artefak** aktif dan **indikator gate** · area konten · panel kanan kontekstual (detail/inspector).

Indikator gate di topbar menampilkan **garis proses** versi aktif (keputusan peneliti, 29 Sep 2026): leluhur, versi itu sendiri, dan turunan terbarunya (mis. A1.0 → A1.1 → A2.0). Setiap G1–G7 memakai catatan terjauh di garis itu, dan tooltip menyebut versi pemegangnya. Tombol meluluskan gate di Dasbor tetap berlaku untuk versi aktif saja (`listLineageGates`).

**Dasbor** memuat, berurutan: alur proses tujuh tahap (tahap saat ini, input, syarat gate, output, yang kurang, dan tahap berikutnya), evaluasi G1 dengan keputusan Admin, struktur artefak, dan pemetaan domain → aspek → indikator.

**Banner origin.** Bila konteks aktif adalah data `SIMULATED`, sebuah strip berwarna muncul di bawah topbar: *"Mode simulasi — keluaran bukan data penelitian"*. Strip ini tidak dapat ditutup.

---

## 2. Peta menu

```
Dasbor

Artefak
  ├ Versi                 CRUD  ArtifactVersion
  ├ Domain                CRUD  Domain
  ├ Aspek                 CRUD  Aspect
  ├ Indikator             CRUD  Indicator
  ├ Rubrik                CRUD  RubricLevel      (editor 5 kolom)
  ├ Persyaratan Bukti     CRUD  EvidenceRequirement
  ├ Pemetaan SDGs         CRUD  tag pada Domain/Indicator
  ├ Change Log            R     ChangeLogEntry
  └ Bandingkan Versi      R     diff A1.0 ↔ A1.1

Instrumen
  ├ Formulir              CRUD  Form
  ├ Builder               CRUD  FormSection, FormField
  ├ Pratinjau & Uji Alur  R     simulator percabangan
  ├ Respons               R/D   FormResponse
  └ Impor/Ekspor GForm    —     JSON + Apps Script, impor CSV

Pakar
  ├ Registry Pakar        CRUD  Expert
  ├ CV & Berkas           CRUD  unggah/hapus, URL bertanda tangan
  ├ Persona Brief         CRUD  PersonaBrief (+ alur persetujuan)
  ├ Konflik Kepentingan   CRUD  deklarasi COI
  └ Identitas Panelis     CRUD  PanelistIdentity   ← khusus ADMIN

Panel AI
  ├ Provider              CRUD  Provider
  ├ Profil Model          CRUD  ModelProfile
  ├ Konfigurasi Panel     CRUD  PanelConfig
  ├ Kursi Pakar           CRUD  PanelSeat          (drag untuk urutan)
  └ Uji Koneksi           —     ping tiap provider

FGD
  ├ Sesi                  CRUD  FgdSession
  ├ Preset Agenda         CRUD  11 tahap corong
  ├ Ruang Sesi            R     transkrip langsung + kartu kursi
  ├ Lembar Keputusan      R/U   FgdDecisionRecord
  ├ Matriks Revisi        R/U   FgdSuggestion (adopsi + alasan)
  └ Terapkan ke A1.1      —     buat versi turunan

Delphi / CVI
  ├ Ronde                 CRUD  DelphiRound
  ├ Matriks Penilaian     R     43 indikator × N kursi
  ├ Hasil per Butir       R     I-CVI, median, IQR, keputusan
  ├ Ringkasan Skala       R     S-CVI/Ave
  └ Umpan Balik Ronde     R     pratinjau paket anonim

AHP
  ├ Konfigurasi           CRUD  AhpSession (diatur di awal)
  ├ Matriks Pairwise      CRUD  AhpMatrix per kursi
  ├ Bobot & Konsistensi   R     bobot individual/agregat, CR
  ├ Skenario Sensitivitas CRUD  SensitivityScenario
  └ Matriks Dikembalikan  R/U   daftar CR >= 0,10

Penskoran
  ├ Asesmen               CRUD  Assessment
  ├ Register Bukti        CRUD  locator + kecukupan
  ├ Skor Indikator        CRUD  IndicatorScore
  ├ Log Data Hilang       R     per jenis missing
  ├ Profil Domain         R     radar + batang
  └ Kalkulator            R     uji formula manual

Run
  ├ Daftar Run            CRUD  PipelineRun
  ├ Perancang Pipeline    CRUD  urutan tahap + parameter
  ├ Monitor               R     timeline, biaya, log langkah
  └ Estimator Biaya       R     sebelum jalan

Audit
  ├ Jejak Aktivitas       R     AuditEvent
  ├ Log Panggilan Model   R     prompt hash, token, biaya
  ├ Ekspor                —     CSV/XLSX/JSON/PDF (berwatermark)
  └ Paket Reproduksi      —     ZIP lengkap

Pengaturan
  ├ Umum                  CRUD  nama proyek, bahasa, tema
  ├ Pengguna & Peran      CRUD  User
  ├ Kunci API             CRUD  nama env var (bukan nilainya)
  ├ Ambang Metodologis    R     read-only + alasan terkunci
  ├ Anggaran & Limit      CRUD  batas biaya, konkurensi
  ├ Retensi Data          CRUD  masa simpan, jadwal pemusnahan
  └ Basis Data            —     seed, reset, backup
```

Area **Pakar** (`/pakar`, peran PAKAR) berada di luar peta menu di atas: tanpa sidebar, tanpa banner simulasi, tanpa akses ke konsol. Isinya hanya instrumen yang ditugaskan ke kode pakar akun tersebut dan tanda terima pengiriman.

---

## 3. Pola CRUD standar

Setiap layar daftar memakai komponen yang sama, `<DataTable/>` berbasis TanStack Table v8:

- Pencarian global + filter per kolom
- Pengurutan multi-kolom
- Pilih baris (checkbox) + aksi massal
- Visibilitas kolom, penyematan kolom, penyesuaian lebar
- Paginasi dengan ukuran halaman yang diingat
- Ekspor hasil yang sedang difilter
- Menu baris: Lihat · Ubah · Duplikasi · Riwayat · Hapus
- Kolom **Origin** dengan badge `SIMULATED`/`REAL` pada setiap tabel yang memuat penilaian

**Ubah** memakai panel geser (sheet) untuk entitas sederhana dan halaman penuh untuk entitas kompleks (indikator, formulir, konfigurasi panel).

**Hapus** memakai dialog konfirmasi. Untuk entitas terversi, hapus = soft delete + `ChangeLogEntry`. Untuk `C20b` dan `C42`, dialog berlapis dua dan wajib mengisi alasan versi.

---

## 4. Layar yang butuh perhatian khusus

### Editor Rubrik
Lima kolom berdampingan (level 1–5), masing-masing dengan deskriptor dan bukti yang dipersyaratkan. Pemeriksa bawaan menandai: deskriptor kembar, lompatan yang tidak terbedakan, dan level yang mensyaratkan bukti yang tidak ada di `EvidenceRequirement`.

### Ruang Sesi FGD
Tiga kolom: agenda (kiri), transkrip streaming (tengah), kartu posisi kursi (kanan). Kartu kursi menampilkan status (berpikir / menjawab / memberi suara / selesai) dengan animasi Framer Motion yang halus. Saat keputusan muncul, panel bawah menampilkan tally dan aturan yang menyala.

### Matriks Penilaian Delphi
Tabel 43 baris × N kolom kursi. Sel menampilkan 1–4 dengan warna. Kolom terakhir: I-CVI, median, IQR, keputusan, **dan penyebut aktual**. Sel kosong ditampilkan sebagai `—`, jelas berbeda dari nilai rendah.

### Matriks Pairwise AHP
Slider 1–9 dua arah untuk tiap pasangan (mode manusia) atau tampilan hasil (mode AI). Indikator CR berjalan yang memperbarui saat matriks terisi. Pasangan paling tidak konsisten disorot.

### Profil Domain
Radar 8 sumbu + batang horizontal berurutan. Skor komposit ditampilkan **di bawah** profil, lebih kecil, dengan label `PROVISIONAL`. Tidak ada tampilan yang menyajikan komposit sendirian.

---

## 5. Bahasa & aksesibilitas

- Antarmuka Bahasa Indonesia; `en` tersedia lewat `lib/i18n`.
- Kontras WCAG AA. Status tidak pernah disampaikan hanya lewat warna — selalu ada ikon atau teks.
- Navigasi keyboard penuh, termasuk DataTable dan editor rubrik.
- Semua animasi Framer Motion dibungkus pemeriksaan `prefers-reduced-motion`.
- Tabel lebar memakai `overflow-x: auto` pada kontainernya sendiri, bukan menggeser seluruh halaman.
