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

---

## 2026-09-29 — Peneliti utama — Pilot bersyarat (G7), PDF, dan aliran langsung

Tidak ada konstanta yang berubah; ambang Tabel 3.8 dipakai apa adanya. Baru di `lib/method/pilot.ts`: `quadraticWeightedKappa`, `exactAgreement`, `pilotCompleteness`, `pilotTraceability`, `evaluatePilotGate` (vektor P1–P5, G7-1…G7-6, docs/05 §5.6 dan §6; nilai κw dihitung independen dengan Python sebelum implementasi).

| Keputusan | Rujukan | Alasan |
|---|---|---|
| κ = Cohen berbobot kuadratik antara dua asesor atas level 1–5; tanpa variasi → tidak terdefinisi (memblokir), bukan 1 | Tabel 3.8 | Level ordinal; κ tidak boleh dibulatkan menjadi sempurna |
| Kesepakatan = level persis sama | Tabel 3.8 | Tafsir paling ketat |
| Kelengkapan = level terisi bukan MISSING_ADMINISTRATIF; keterlacakan = setiap level ≥ 2 punya locator verbatim dan bukti wajib tercatat | Tabel 3.8 | Dapat dihitung dari data asesmen |
| Butir MISSING_ADMINISTRATIF pada salah satu asesor dikeluarkan dari κ/kesepakatan dan dilaporkan | §3.10.1 | Tanpa imputasi |
| Pilot di aplikasi = pilot antar-asesor simulasi (dua model berbeda, profil fiktif), selalu berlabel `SIMULATED_PILOT`; G7 juga memerlukan deklarasi etik dan akses institusi dari Admin | §3.11, §3.12 | Menguji stabilitas rubrik tanpa klaim pilot institusional |
| Asesmen pilot (`purpose = PILOT`) tidak dihitung untuk G6 dan tidak masuk ekspor rekalkulasi penskoran | docs/05 §6 | Satu keputusan gate per data |


---

## 2026-09-29 — Peneliti utama — Laporan lengkap G1–G7 (PDF)

Tidak ada konstanta yang berubah dan tidak ada perhitungan baru; laporan hanya membaca data dan evaluasi gate yang sudah ada.

| Keputusan | Rujukan | Alasan |
|---|---|---|
| Laporan memuat seluruh data versi aktif dan garis turunannya, termasuk transkrip FGD utuh dan ledger `ModelCall` — bukan ringkasan | §3.14 | Jejak komputasional lengkap dalam satu dokumen |
| Narasi bab oleh `anthropic/claude-sonnet-5` (prompt `report.chapter.narrate` v1.0.0) dari fakta terstruktur + kutipan transkrip; tanpa persona, CV, atau identitas | §3.13, docs/07 P6 | Narasi tidak boleh menjadi jalur kebocoran data pakar |
| Setiap bab wajib ditinjau dan disetujui Admin; PDF tidak dapat dibangun sebelum 10/10 bab disetujui, dan dibuang bila bab berubah | docs/07 P7 | Narasi model tidak pernah terbit tanpa pemeriksaan peneliti |
| Watermark di setiap halaman, nama berkas `SIM_`, tanpa opsi menonaktifkan | docs/07 P4 | Laporan simulasi tidak terbaca sebagai hasil |

---

## 2026-09-29 — Peneliti utama — Dry-run lengkap dengan AI nyata dan "AI peneliti"

Tidak ada konstanta di `lib/method/constants.ts` yang berubah. Semua data uji ZZ dihapus atas permintaan peneliti (cadangan `pg_dump` dibuat sebelumnya); baseline DCGMI-A1.0, formulir pra-reviu, akun, dan jejak audit disimpan.

| Keputusan | Rujukan | Alasan / konsekuensi |
|---|---|---|
| Panel P01–P06 (FGD) dan P07–P08 (Delphi baru) dari CV pakar asli; nama dan institusi hanya di `PanelistIdentity`; persona diisi dari CV tanpa penanda identitas; tiap pakar dipasangkan ke model Gateway yang berbeda | docs/04 §4, docs/07 P6 | CV tidak diproses aplikasi dan tidak dikirim ke provider |
| **Penyimpangan komposisi §3.7.1/§3.8.1:** tidak ada CV berbidang sustainability; P05 (kursi 6 FGD) dan P08 (kursi 8 Delphi) tetap berlabel SUSTAINABILITY, tetapi persona mengikuti CV (masing-masing praktisi TI PTS dan konsultan SPBE) | SPECIFICATION §141 | Sudut pandang sustainability tidak terwakili; label kursi tidak mencerminkan isi CV |
| **Penyimpangan prosedur P7:** keputusan peneliti (resolusi PEMBAHASAN_KHUSUS, adopsi usulan, penerapan revisi, tinjauan kejelasan Delphi, revisi antar-ronde, content lock, profil fiktif, tinjauan narasi laporan) dibuat oleh "AI peneliti" `anthropic/claude-sonnet-5.5` dan dicatat atas nama akun Admin dengan label `[AI peneliti · anthropic/claude-sonnet-5.5 · atas nama Admin]`. Gate hanya diluluskan bila evaluator `lib/method` lulus; tidak ada bypass | docs/07 P7 | Atas permintaan peneliti utama; semua keputusan tercatat di AuditEvent, ChangeLogEntry, dan ledger `ModelCall` |
| Kebijakan AI peneliti: struktur 8–15–43 dijaga (TAMBAH/HAPUS/GABUNG/PECAH/PINDAH hanya bila argumennya kuat dan didukung >1 kursi); indikator baru (TAMBAH/PECAH) ditunda; C20b/C42 tidak disunting (butuh keputusan versi eksplisit peneliti) | CH-08, keputusan "item baru ditunda" | Tugas revisi yang ditunda dicatat `AI_RESEARCHER_REVISION_DEFERRED` |
| **Deklarasi G7 fiktif:** atas permintaan peneliti, deklarasi etik memakai nomor `FIKTIF-SIM-ETIK-<acak>` tanggal 2026-09-29, dan deklarasi akses menyatakan akses institusi fiktif; keduanya berlabel "BUKAN persetujuan etik" | Tabel 3.8, §3.11 | G7 dapat diuji tanpa menyiratkan izin etik yang tidak ada |
| Jumlah PEMBAHASAN_KHUSUS tidak diatur; hasil panel diterima apa adanya | Tabel 3.5 | Keluaran AI tidak disunting |
| Notulis FGD: claude-haiku-4.5 → claude-sonnet-5 → **openai/gpt-5.4** dan prompt `fgd.notetaker.extract` v1.1.0 (kutipan maks. 30 kata dari satu bagian utuh). Validasi kutipan verbatim tidak dilonggarkan; gpt-5.4 lolos validasi pada 4/4 transkrip nyata, model lain tidak. Komponen yang selesai sebelumnya tercatat dengan notulis dan versi prompt lamanya di ledger | docs/04 §5, docs/09 | Kegagalan skema berulang memaksa komponen diulang penuh |
| Penghematan token (keputusan peneliti, 29 Sep 2026 ±03:40 UTC): argumen kursi maks. 250 → **150 kata**, tanggapan silang 125 → **75 kata**, prompt `fgd.seat.argue`/`fgd.seat.crosstalk` v1.1.0 ("langsung ke inti"). Komponen yang selesai sebelumnya memakai v1.0.0 (terlihat di ledger per panggilan); thinking model tidak diubah | docs/04 §4.4, docs/09 | Biaya FGD diperkirakan melampaui plafon; tanggapan silang tetap dipertahankan |
| Thinking rendah untuk kursi panel (keputusan peneliti, 29 Sep 2026 ±04:00 UTC): `ai.seatThinking = "low"` untuk sisa FGD, Delphi, dan AHP (Qwen/DeepSeek tanpa thinking, Gemini Flash minimal, OpenAI low; Anthropic/Mistral tidak berubah). Uji: token output Qwen 1.249 → 165, DeepSeek 913 → 232, Gemini Flash 1.136 → 251 untuk jawaban setara. Komponen sebelumnya memakai thinking bawaan | docs/04 §9 | Penghematan token; isi jawaban yang terlihat tetap dibatasi prompt |
| Kredit Gateway habis pukul 04:55 UTC; setelah diisi ulang ($24,6) dipakai model lebih murah: AI peneliti claude-sonnet-5.5 → **openai/gpt-5.4-mini** (thinking rendah) untuk sisa keputusan (label `[AI peneliti · openai/gpt-5.4-mini …]`); asesor G6 dan pilot A gpt-5.5 → **gpt-5.4-mini**; asesor pilot B gemini-3.5-flash → **deepseek-v4-pro**; plafon run 80 → 50 USD. Keputusan adopsi AI peneliti diproses 6 komponen paralel | docs/07 §5 | Anggaran; keputusan sebelumnya tetap berlabel model lamanya |
| **Insiden & koreksi (29 Sep 2026 ±05:54 UTC):** saat menerapkan revisi domain/aspek, AI peneliti (gpt-5.4-mini) menulis nama perannya ("AI peneliti") sebagai nama D7, A02, A05, A07 di A1.1. Delphi R1 yang sedang berjalan (11 butir, 88 rating) dinilai dengan label keliru, sehingga dihapus (AuditEvent `DELPHI_ROUND_DELETE`; baris ledger panggilannya tetap disimpan) dan diulang. Nama dikoreksi lewat `updateGroup` (ChangeLogEntry "Koreksi: …"), hasilnya sama dengan nama baseline; prompt revisi kini menegaskan "name" = nama komponen dan validasi menolak nama berisi "peneliti". Indikator, rubrik, dan bukti diperiksa bersih | docs/07 P3 | Keluaran simulasi yang tercemar tidak boleh menjadi dasar G3 |
| **Insiden & koreksi (29 Sep 2026 ±06:13 UTC):** tinjauan Delphi R1 oleh AI peneliti gpt-5.4-mini menandai 43/43 butir "isu kejelasan kritis" dan 11 "konflik konstruk" (I-CVI rata-rata 0,997), sehingga 11 butir berkeputusan HAPUS_DARI_INTI tanpa dasar. Atas keputusan peneliti utama R1 dihapus dan diulang atas isi A1.1 saat ini (termasuk 40 suntingan C01–C04 yang sempat dibuat); tinjauan Delphi memakai **claude-sonnet-5.5** dengan kriteria tegas (prompt `researcher.delphi.review` v1.1.0: kritis hanya bila makna berubah/tidak dapat dinilai konsisten; konflik konstruk hanya bila kursi menyatakan konstruk lain; ragu → false) | §3.8.2, docs/05 G3 | Keputusan peneliti tidak boleh membalik hasil panel tanpa dasar |
| **Keputusan peneliti utama tentang C20b/C42 (29 Sep 2026):** pada dry-run ini kedua controlled exception **mengikuti aturan Delphi biasa**; bila tinjauan menetapkan konflik konstruk, keduanya dapat berkeputusan HAPUS_DARI_INTI dan tidak ikut content lock. Peneliti menyatakan memahami konsekuensinya | CH-08, CLAUDE.md rambu C20b/C42 | Keputusan versi eksplisit untuk dry-run |
| Asesor penskoran: gpt-5.4-mini berulang memberi level di atas plafon bukti wajib (melewatkan bukti wajib level 2, mis. C33/C38) dan locator tidak verbatim. Asesmen profil "Institut Vokasi Pesisir" (27/42) **dibatalkan** dan diulang penuh dengan **claude-sonnet-5.5**; asesmen "PTN Satker Kepulauan" (gpt-5.4-mini, selesai) dipertahankan. Pilot G7: asesor A claude-sonnet-5.5, B gemini-3.5-flash. Umpan balik penolakan plafon kini menyebut bukti wajib yang belum dipilih (aturan `evidenceLevelCap` tidak berubah). Temuan instrumen: model cenderung menganggap bukti level lebih tinggi mencakup bukti wajib level di bawahnya | docs/05 §5.5 | Validasi plafon dan locator tidak dilonggarkan |
| FGD dijalankan 3 komponen paralel (driver + 2 worker); tiap komponen tetap berurutan argumen → tanggapan silang → voting → notulis | SPECIFICATION §4.5 | Komponen saling independen (brief dari artefak); hanya waktu yang berubah |
| Perbaikan teknis (bukan metodologis): ruang token penalaran +4096 untuk panggilan model nyata (`lib/ai/call.ts`), batas output notulis 12000, alasan voting maks. 1200 karakter, alasan rating Delphi maks. 1000 dan catatan kejelasan 600 karakter (skor 1–4 dan I-CVI tidak berubah), alasan pasangan AHP maks. 800 karakter (preferensi/intensitas tidak berubah), prompt asesor `scoring.assessor.evidence` v1.1.0 (locator tanpa tanda kutip pembungkus; validasi verbatim tetap), percobaan ulang skema menyertakan alasan penolakan, perbandingan kutipan notulis setelah normalisasi format saja (`normalizeQuote`), harga katalog untuk model baru (`priceSource` null) | docs/04 §5, §9 | Model penalaran (Gemini 3.x, GPT-5.x, DeepSeek V4, Qwen 3.6) memotong JSON sebelum selesai |
| **Hasil akhir dry-run (29 Sep 2026 07:56 UTC):** A1.0 G1–G2 PASSED; A1.1 G1–G3 PASSED (R1: 31 PERTAHANKAN, 11 REVISI, 1 HAPUS C05; R2: 11 PERTAHANKAN; S-CVI/Ave ≈ 0,997); A2.0 (8–15–42) G4–G6 PASSED (G5 dengan 7 matriks `MATRIX_RETURNED_UNRESOLVED`; G6 rekalkulasi 0 perbedaan). **G7 tidak lulus**: κw 0,385 < 0,60 dan kesepakatan 0,732 < 0,80 (sonnet-5.5 vs gemini-3.5-flash) — dilaporkan apa adanya, pilot tidak diulang untuk mengejar angka. Laporan PDF G1–G7 810 halaman; 4 bab (pendahuluan, G2, G6, penutup) disetujui AI peneliti setelah satu kali buat ulang dengan isu tersisa dan perlu ditinjau peneliti. Total biaya ledger $47,98 | Tabel 3.8, §3.11 | Temuan uji instrumen: tafsir deskriptor rubrik dan tangga bukti wajib belum stabil antarpenilai |

---

## 2026-09-29 — Peneliti utama — Laporan Word tanpa watermark dan grafik per gate

Tidak ada konstanta atau perhitungan yang berubah.

| Keputusan | Rujukan | Alasan / konsekuensi |
|---|---|---|
| **Laporan Word (.docx) G1–G7 tanpa watermark, tanpa catatan simulasi, dan tanpa awalan `SIM_`** — atas permintaan eksplisit peneliti utama setelah diberi tahu risikonya (docs/07 P4, pagar prosedural #1). PDF dan ekspor lain tetap berwatermark | docs/07 P4, CLAUDE.md rambu watermark | Peneliti menyatakan memahami bahwa dokumen dapat terbaca sebagai hasil penelitian; setiap unduhan tercatat `EXPORT_REPORT_DOCX` (`watermark: false`) |
| PDF dan Word dibangun dari daftar blok yang sama; 51 grafik (batang, bertumpuk, berkelompok, kolom, donut, heatmap, garis, tornado, dot-range) di setiap gate, masing-masing diikuti tabel lengkap; palet kategorikal tetap, satu rampa biru untuk besaran, nilai dicetak, legenda untuk ≥ 2 seri | SPECIFICATION §4.10 | Keterbacaan; grafik tidak menggantikan tabel |
| Nama peneliti utama pada akun Admin diisi "Prof. Dr. Syopiansyah Jaya Putra, M.Sis" (AuditEvent `USER_UPDATE`); sampul laporan menyatakan keputusan dan persetujuan bab dibuat AI peneliti atas nama peneliti utama | docs/07 P7 | Atribusi yang benar untuk keputusan AI |
| Nama pakar P01–P08 dicantumkan **hanya** di tabel "Komposisi panel" pada Word yang diunduh Admin, dengan keterangan bahwa isi diskusi adalah keluaran model AI; label kursi di seluruh tabel memakai kode persona ("Pakar 1 · P02"); nama tidak ditempelkan pada ujaran atau penilaian | docs/07 P6 | Mencegah pernyataan simulasi terbaca sebagai pernyataan pakar nyata |
| **PDF laporan G1–G7 juga tanpa watermark, peringatan footer/metadata, dan awalan `SIM_`** — permintaan eksplisit peneliti utama (keputusan yang sama dengan versi Word; peneliti telah diberi tahu risikonya). `ReportWriter` mendapat opsi `marks` (bawaan `true`); hanya laporan G1–G7 memakai `marks: false`. Ekspor tabel dan paket reproduksi tetap berwatermark; kriteria §6.5 mencatat pengecualian ini | docs/07 P4 | Keputusan peneliti |

