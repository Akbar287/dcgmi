# AGENTS.md — Kontrak Rekayasa

Dokumen ini mengikat **setiap agen coding** yang bekerja di repositori ini (Claude Code, Cursor, Copilot, Codex, dan lainnya). `CLAUDE.md` adalah lapisan tambahan khusus Claude Code, bukan pengganti dokumen ini.

---

## 1. Konteks satu paragraf

DDC adalah perangkat lunak pendukung penelitian DCGMI. Ia mensimulasikan panel pakar dengan agen AI untuk **menguji instrumen** sebelum instrumen itu dipakai pada pakar manusia. Aplikasi ini tidak menghasilkan temuan penelitian. Setiap keputusan teknis harus menjaga agar batas itu tidak pernah kabur.

---

## 2. Lima aturan yang tidak boleh dilanggar

1. **Pemisahan origin.** Setiap model data yang menyimpan penilaian, transkrip, skor, atau bobot wajib punya kolom `dataOrigin: DataOrigin`. Tidak ada fungsi agregasi yang boleh menerima campuran `SIMULATED` dan `REAL`. Pelanggaran = error runtime, bukan warning.
2. **Gate tidak boleh di-bypass.** Urutan tahap adalah `BASELINE → FGD → DELPHI_CVI → CONTENT_LOCK → AHP → SCORING → PILOT`. Tahap N+1 menolak berjalan bila gate tahap N belum `PASSED`. Tidak ada flag `--force` di kode produksi.
3. **Ambang metodologis adalah konstanta terkunci.** Nilai seperti `I_CVI_MIN = 0.78`, `S_CVI_AVE_MIN = 0.90`, `IQR_MAX = 1`, `MEDIAN_MIN = 3`, `CR_MAX = 0.10` hanya boleh ada di `lib/method/constants.ts`. Dilarang menuliskannya ulang secara literal di tempat lain, dan dilarang mengubahnya tanpa entri di `CHANGELOG-METHOD.md`.
4. **Tidak ada angka hasil yang di-hardcode.** Semua skor, bobot, I-CVI, dan CR harus lahir dari perhitungan atas data yang tersimpan. Dilarang menaruh contoh hasil di kode sebagai fallback atau placeholder.
5. **Audit trail wajib.** Setiap mutasi pada artefak (domain/aspek/indikator/rubrik/bobot) menulis satu baris `ChangeLogEntry` dalam transaksi yang sama. Tanpa itu, mutasi ditolak.

---

## 3. Stack dan versi

| Lapisan             | Pilihan                         | Catatan                                                                    |
| ------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| Framework           | Next.js 16, App Router          | Turbopack default; `cookies()`/`headers()` async-only                      |
| Bahasa              | TypeScript, `strict: true`      | `any` dilarang; pakai `unknown` + penyempitan tipe                         |
| Styling             | Tailwind CSS v4                 | Token warna di `app/globals.css`                                           |
| Komponen            | shadcn/ui                       | Ditambahkan lewat CLI, lalu boleh diubah; tidak di-wrap ulang tanpa alasan |
| Animasi             | Motion (`motion/react`)         | Penerus Framer Motion. Hormati `prefers-reduced-motion`                    |
| Tabel               | TanStack Table v8               | Semua tabel data melalui `<DataTable/>` bersama                            |
| Data fetching klien | TanStack Query v5               | Hanya untuk state yang benar-benar klien                                   |
| ORM                 | Prisma                          | PostgreSQL 16                                                              |
| Validasi            | Zod                             | Satu skema dipakai bersama form, action, dan API                           |
| Form                | React Hook Form + `zodResolver` |                                                                            |
| AI                  | Vercel AI SDK v7 (`ai`)         | Butuh Node 22+ dan ESM. `generateObject` untuk keluaran terstruktur        |
| Uji                 | Vitest (unit), Playwright (e2e) |                                                                            |

---

## 4. Struktur folder

```
app/
  (marketing)/                 # halaman publik
  (app)/                       # area terautentikasi
    artefak/                   # registry domain/aspek/indikator
    forms/                     # form builder + responses
    experts/                   # registry pakar + persona
    panel/                     # konfigurasi AI panel
    fgd/                       # simulator FGD
    delphi/                    # ronde Delphi + CVI
    ahp/                       # pairwise + bobot
    scoring/                   # scoring engine
    runs/                      # pipeline runner + monitor
    audit/                     # change log & export
    settings/                  # provider, kunci, ambang, i18n
  f/[slug]/                    # runner formulir publik
  api/
components/                    # atomic design
  ui/                          # shadcn (primitif, tidak di-wrap ulang)
  atoms/                       # badge origin/status/exception, nilai tunggal
  molecules/                   # page heading, notice, empty state, gate chip, pemilih
  organisms/                   # sidebar, topbar, banner simulasi, data-table/ (DataTable generik)
  templates/                   # app shell, kerangka halaman section
lib/
  ai/                          # provider registry, persona, orkestrator
  method/                      # constants.ts, cvi.ts, ahp.ts, scoring.ts, gates.ts
  db/                          # prisma client + repository
  validation/                  # skema Zod
  export/
prisma/
  schema.prisma
  seed.ts                      # baseline DCGMI-A1.0
docs/
tests/
```

**Boundary:** `lib/method/*` adalah kode murni — tidak boleh mengimpor Prisma, React, atau apa pun dari `app/`. Ini yang membuatnya bisa diuji dan diaudit secara independen (syarat R1–V1.7 §3.14: jejak komputasional).

---

## 5. Konvensi kode

- Server Action untuk mutasi; Route Handler hanya untuk streaming AI, webhook, dan ekspor berkas.
- Satu file = satu tanggung jawab. Komponen > 200 baris dipecah.
- Nama file `kebab-case.ts`, komponen `PascalCase`, fungsi `camelCase`.
- Error: lempar `MethodError`, `GateError`, atau `OriginMismatchError` dari `lib/errors.ts`. Jangan lempar string.
- Semua teks antarmuka melalui `lib/i18n` (`id` default, `en` opsional). Jangan hardcode string Indonesia di JSX.
- Komentar menjelaskan **mengapa**, bukan apa. Aturan metodologis wajib menyertakan rujukan pasal, contoh: `// R1-V1.7 §3.8.2: 6/8 = 0,75 tidak memenuhi I-CVI >= 0,78`.

---

## 6. Alur kerja agen

Sebelum menulis kode apa pun:

0. Kalau repo belum di-scaffold, ikuti `docs/00-SETUP.md` lebih dulu.
1. Baca `SPECIFICATION.md` bagian yang relevan.
2. Baca `docs/05-METHOD-RULES.md` bila menyentuh FGD, Delphi, CVI, AHP, atau scoring.
3. Baca `docs/02-DATA-MODEL.md` bila menyentuh skema.
4. Periksa apakah sudah ada utilitas yang melakukan hal itu di `lib/`.

Saat mengerjakan:

- Tulis uji lebih dahulu untuk apa pun di `lib/method/`. Test vector tersedia di `docs/05-METHOD-RULES.md`.
- Migrasi Prisma: `pnpm db:migrate --name deskripsi_singkat`. Jangan edit migrasi yang sudah ada.
- Jalankan `pnpm check` (typecheck + lint + test) sebelum menyatakan selesai.

Yang **tidak** boleh dilakukan tanpa persetujuan eksplisit dari peneliti:

- Mengubah nilai ambang metodologis apa pun.
- Mengubah struktur baseline 8–15–43 lewat seed (perubahan struktur hanya boleh lewat alur FGD/Delphi di dalam aplikasi).
- Menghapus atau menomori ulang kode `C20b` dan `C42` — keduanya _controlled exceptions_ menurut R1–V1.7 CH-08.
- Menambah provider AI baru yang mengirim CV pakar ke pihak ketiga yang belum terdaftar di `docs/07-RESEARCH-INTEGRITY.md`.
- Menonaktifkan watermark ekspor.

---

## 7. Perintah

```bash
pnpm dev                 # server pengembangan
pnpm check               # typecheck + lint + unit test  ← wajib sebelum commit
pnpm test:unit           # Vitest
pnpm test:e2e            # Playwright
pnpm db:push             # sinkron skema (dev)
pnpm db:migrate          # buat migrasi
pnpm db:seed             # seed baseline DCGMI-A1.0
pnpm db:studio           # Prisma Studio
pnpm method:verify       # jalankan seluruh test vector metodologis
```

`pnpm method:verify` adalah gerbang wajib. Jika gagal, jangan lanjutkan pekerjaan lain.

---

## 8. Commit

Conventional Commits. Scope mengikuti nama modul.

```
feat(ahp): hitung consistency ratio dengan tabel RI Saaty
fix(cvi): perbaiki pembulatan I-CVI pada panel berukuran ganjil
docs(method): tambahkan test vector sensitivitas
chore(db): migrasi kolom dataOrigin pada DelphiRating
```

Perubahan yang menyentuh `lib/method/` wajib mencantumkan pasal rujukan di badan commit.
