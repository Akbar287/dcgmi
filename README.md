# DCGMI Dry-Run Console (DDC)

Perangkat lunak pendukung penelitian **R1–DCGMI (UIN Research Grant 2026)** — _Pengembangan dan Validasi Awal Digital Campus Governance Maturity Index (DCGMI) untuk Perguruan Tinggi Indonesia_.

Aplikasi ini mengimplementasikan jalur kerja **R1–V2.1.2B — Google Forms Build, Controlled Dry-Run, and Deployment Readiness** yang pada laporan antara R1–V1.7 berstatus HOLD. Fungsinya adalah **menguji instrumen sebelum dipakai ke pakar manusia**: instruksi, navigasi, percabangan, konsistensi kode, penyimpanan, ekspor, dan kebenaran formula.

---

## ⚠️ Batas klaim (baca sebelum apa pun)

> Simulasi panel pakar berbasis AI di dalam aplikasi ini adalah **controlled dry-run internal**. Keluarannya **bukan** data FGD, **bukan** data Delphi, **bukan** bukti validitas isi, dan **bukan** hasil AHP. Keluaran simulasi tidak boleh dilaporkan sebagai hasil penelitian dalam bentuk apa pun.

Landasan: R1–V1.7 §3.12, §3.14, dan §4.3 — _"Controlled dry-run internal tidak dianggap sebagai validasi empiris"_.

Konsekuensi teknis yang diwajibkan arsitektur ini:

- Setiap baris data membawa kolom `dataOrigin` bertipe `SIMULATED | REAL`.
- Dua jenis data **tidak pernah** berada dalam satu agregasi. Query lintas-origin ditolak di layer repository.
- Seluruh ekspor dari run simulasi diberi watermark dan header peringatan yang tidak dapat dimatikan.
- Tidak ada jalur "promote simulated → real". Data pakar asli hanya masuk lewat form intake yang terpisah.

Detail lengkap: [`docs/07-RESEARCH-INTEGRITY.md`](docs/07-RESEARCH-INTEGRITY.md).

---

## Apa yang dilakukan aplikasi ini

| Modul                | Fungsi                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Artefak Registry** | CRUD Domain / Aspek / Indikator + rubrik level 1–5 + persyaratan bukti, dengan versioning `DCGMI-A1.0 → A1.1` dan change log |
| **Form Builder**     | Pembuat formulir ala Google Forms (section, branching, skala 4 titik, matriks) + runner publik + tabel respons               |
| **Expert Registry**  | CRUD profil pakar; unggah CV pakar asli untuk membentuk _persona brief_ yang dipakai agen AI                                 |
| **AI Panel**         | Pemetaan `Pakar N → provider` (ChatGPT / DeepSeek / Qwen / Claude / Gemini / lokal), jumlah pakar dapat diatur               |
| **FGD Simulator**    | Sesi FGD 11 tahap alur corong, voting per komponen (terima / terima dengan revisi / tolak), transkrip, matriks revisi        |
| **Delphi/CVI**       | Ronde anonim skala 4 titik, hitung I-CVI, S-CVI/Ave, median, IQR, keputusan per butir                                        |
| **AHP**              | Pairwise Saaty 1–9, eigenvector, CI/CR, agregasi rata-rata geometris, analisis sensitivitas                                  |
| **Scoring Engine**   | Evidence-to-level, agregasi hierarkis tiga tingkat, penanganan data hilang                                                   |
| **Pipeline Runner**  | Menjalankan rantai tahap secara otomatis dengan **gate** yang memblokir tahap berikutnya                                     |
| **Audit & Export**   | Jejak keputusan lengkap, ekspor CSV/XLSX/JSON/PDF                                                                            |

---

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind CSS v4 · shadcn/ui · Motion · TanStack Table · TanStack Query · Prisma + PostgreSQL · Zod · React Hook Form · Vercel AI SDK v7 · Vitest + Playwright

Butuh **Node 22+** (batasnya dari AI SDK 7, bukan Next.js).

---

## Status implementasi

| Milestone                  | Status                                                        |
| -------------------------- | ------------------------------------------------------------- |
| **M1 — Mesin metodologis** | Selesai. `lib/method/` lengkap, 74 unit test lulus            |
| **M2 — Skema & baseline**  | Selesai. 39 model Prisma, seed DCGMI-A1.0, pemeriksa invarian |
| M0, M3–M8                  | Belum. Lihat `docs/08-ROADMAP.md`                             |

Yang sudah dapat dijalankan tanpa UI:

```bash
pnpm install
pnpm method:verify      # 74 test: F1-F9, C1-C7, S-CVI, A1-A5, S1-S5, gate
pnpm schema:check       # invarian skema: dataOrigin, relasi, kolom kritis
pnpm baseline:check     # 8-15-43, distribusi 7-5-6-6-4-5-4-6, kode C01-C42 + C20b
python scripts/recompute.py --self-test   # rekalkulasi independen (NumPy)
```

Keempatnya sudah hijau. Implementasi TypeScript dan Python menghasilkan angka
identik dalam toleransi `1e-6`, memenuhi syarat jejak komputasional R1-V1.7 §3.14.

## Mulai cepat

Repo ini belum berisi Next.js. Ikuti [`docs/00-SETUP.md`](docs/00-SETUP.md) untuk scaffold, lalu:

```bash
cp .env.example .env.local     # isi DATABASE_URL dan kunci API
pnpm prisma generate
pnpm db:push && pnpm db:seed   # seed = baseline DCGMI-A1.0 (8-15-43)
pnpm dev
```

Seed menyiapkan baseline provisional 8 domain / 15 aspek / 43 indikator dengan
distribusi `7-5-6-6-4-5-4-6`, enam provider AI, dan dua konfigurasi panel
(FGD_6 dan DELPHI_8).

**Seed sengaja membuat `G1_BASELINE` gagal.** Hanya indikator C01 yang punya
paket penilaian lengkap sebagai contoh; 42 sisanya menunggu rubrik dan
persyaratan bukti. FGD tidak dapat dimulai sampai gate itu lulus. Itu bukan bug.

---

## Peta dokumen

Baca berurutan. Setiap agen AI yang bekerja di repo ini **wajib** membaca `AGENTS.md` lebih dulu.

| Dokumen                                                          | Isi                                                      |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                                         | Instruksi kerja untuk Claude Code                        |
| [`AGENTS.md`](AGENTS.md)                                         | Kontrak rekayasa yang mengikat semua agen coding         |
| [`SPECIFICATION.md`](SPECIFICATION.md)                           | Spesifikasi fungsional lengkap                           |
| [`docs/00-SETUP.md`](docs/00-SETUP.md)                           | **Mulai di sini** — scaffold Next.js, shadcn, dependensi |
| [`docs/01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md)             | Struktur folder, boundary, alur data                     |
| [`docs/02-DATA-MODEL.md`](docs/02-DATA-MODEL.md)                 | Skema Prisma lengkap                                     |
| [`docs/03-API-CONTRACTS.md`](docs/03-API-CONTRACTS.md)           | Route handler dan server action                          |
| [`docs/04-AI-PANEL.md`](docs/04-AI-PANEL.md)                     | Persona, provider, orkestrasi FGD                        |
| [`docs/05-METHOD-RULES.md`](docs/05-METHOD-RULES.md)             | Aturan FGD, Delphi/CVI, AHP, scoring + test vector       |
| [`docs/06-UI-NAVIGATION.md`](docs/06-UI-NAVIGATION.md)           | Inventaris menu dan CRUD                                 |
| [`docs/07-RESEARCH-INTEGRITY.md`](docs/07-RESEARCH-INTEGRITY.md) | Pagar integritas riset                                   |
| [`docs/08-ROADMAP.md`](docs/08-ROADMAP.md)                       | Milestone M0–M8                                          |
| [`docs/09-PROMPTS.md`](docs/09-PROMPTS.md)                       | Pustaka prompt                                           |
| [`docs/10-TESTING.md`](docs/10-TESTING.md)                       | Strategi pengujian                                       |

---

## Lisensi & data

Repositori internal tim peneliti. CV pakar, transkrip, dan identitas panelis tunduk pada R1–V1.7 §3.13 (etika dan tata kelola data). Jangan commit berkas identitas ke git.
