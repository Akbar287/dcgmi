# 08 — Roadmap

Milestone disusun agar setiap tahap menghasilkan sesuatu yang dapat diuji, dan agar pekerjaan metodologis selesai sebelum pekerjaan AI dimulai. Urutan ini disengaja: orkestrator yang dibangun di atas perhitungan yang belum terverifikasi akan menghasilkan kesalahan yang sulit ditemukan.

| M | Nama | Keluaran | Selesai bila |
|---|---|---|---|
| **M0** | Fondasi | Next.js 15 + TS strict + Tailwind v4 + shadcn + Prisma + auth dasar | `pnpm check` hijau; login bekerja |
| **M1** | Mesin metodologis | `lib/method/` lengkap: constants, fgd, cvi, ahp, scoring, gates | `pnpm method:verify` lulus seluruh vector di docs/05 |
| **M2** | Artefak Registry | CRUD domain/aspek/indikator/rubrik/bukti + seed A1.0 + change log + diff versi | Seed menghasilkan 8–15–43; `G1_BASELINE` dapat dievaluasi dan benar-benar gagal saat rubrik kurang |
| **M3** | Form Builder | Builder, runner publik, respons, ekspor, impor/ekspor Google Forms | Satu formulir Delphi 43 butir dapat diisi ujung ke ujung |
| **M4** | Pakar & Panel | Expert registry, unggah CV, ekstraksi persona, de-identifikasi, provider, konfigurasi kursi | Enam kursi dengan enam provider berbeda lulus uji koneksi |
| **M5** | FGD Simulator | Orkestrator, agenda 11 tahap, voting terstruktur, notulis, aturan keputusan, matriks revisi, A1.1 | Satu sesi penuh berjalan `MOCK_AI=1` lalu berjalan nyata |
| **M6** | Delphi/CVI | Ronde, anonimitas, isolasi kursi baru, perhitungan, umpan balik, S-CVI | Vector C1–C7 terbukti benar lewat UI, bukan hanya unit test |
| **M7** | AHP + Scoring | Pairwise, CR, pengembalian matriks, agregasi geometris, sensitivitas, mesin skor, profil domain | Rekalkulasi Python identik sampai 6 desimal |
| **M8** | Pipeline & Audit | Runner otomatis, monitor biaya, ekspor berwatermark, paket reproduksibilitas | Seluruh kriteria penerimaan di SPECIFICATION.md §6 terpenuhi |

---

## Yang sengaja ditunda

| Item | Alasan |
|---|---|
| Kolaborasi real-time multi-pengguna | Tim kecil; polling sudah memadai |
| Modul pilot institusional penuh | Tahap bersyarat (R1–V1.7 §3.11); bangun setelah gate sebelumnya stabil |
| Fine-tuning model persona | Prompting sudah cukup untuk uji instrumen; fine-tuning menambah risiko atribusi |
| Aplikasi mobile | Runner formulir sudah responsif |
| Publikasi multi-tenant | Satu proyek penelitian |

---

## Risiko

| Risiko | Mitigasi |
|---|---|
| Keluaran simulasi terbaca sebagai hasil | Tujuh pagar di docs/07; tinjau di setiap PR |
| Biaya API membengkak | `MOCK_AI=1` saat pengembangan; estimator + pemutus anggaran |
| Model gagal memenuhi skema | `generateObject` + 2 percobaan + tandai `FAILED`, tanpa nilai default |
| Panel homogen karena satu model | Peringatan korelasi + metrik kesamaan keluaran |
| Ambang metodologis berubah diam-diam | Konstanta terpusat + `CHANGELOG-METHOD.md` + test vector |
| Data CV bocor ke provider | De-identifikasi wajib + daftar provider disetujui + CV tidak pernah dikirim |
| Perubahan struktur setelah content lock | `reopenGates` otomatis + arsip bobot lama |
