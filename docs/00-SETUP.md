# 00 — Setup & Instalasi

Paket yang Anda terima berisi `lib/method/`, `prisma/`, `scripts/`, dan dokumen. Belum ada Next.js, shadcn, atau dependensi UI. Dokumen ini menjelaskan cara menyambungnya.

**Diverifikasi 25 September 2026.** Versi bergerak cepat — perintah di bawah memakai `@latest`, bukan pin versi, supaya tidak cepat usang.

---

## 0. Prasyarat

```bash
node -v    # butuh >= 22
pnpm -v    # butuh >= 9
```

Node 22 wajib karena **AI SDK 7 memerlukan Node 22+ dan ESM**. Next.js 16 sendiri hanya butuh Node 20, tapi AI SDK yang menentukan batas bawahnya.

---

## 1. Scaffold Next.js di folder baru

Jangan menjalankan `create-next-app` di atas folder yang sudah ada — ia akan menimpa `package.json` dan `tsconfig.json` Anda. Scaffold di folder baru, lalu pindahkan pekerjaan yang sudah jadi ke dalamnya.

```bash
pnpm create next-app@latest dcgmi-app \
  --typescript --tailwind --eslint --app \
  --no-src-dir --import-alias "@/*" --use-pnpm
```

Next.js 16 memakai Turbopack sebagai bundler default, jadi tidak ada flag `--turbopack` lagi.

---

## 2. Pindahkan pekerjaan yang sudah ada

```bash
cp -r dcgmi-console/lib      dcgmi-app/
cp -r dcgmi-console/prisma   dcgmi-app/
cp -r dcgmi-console/scripts  dcgmi-app/
cp -r dcgmi-console/docs     dcgmi-app/
cp dcgmi-console/AGENTS.md dcgmi-console/CLAUDE.md dcgmi-console/SPECIFICATION.md \
   dcgmi-console/README.md dcgmi-console/CHANGELOG-METHOD.md \
   dcgmi-console/.env.example dcgmi-console/vitest.config.ts  dcgmi-app/
cd dcgmi-app
```

**Jangan** menyalin `package.json` dan `tsconfig.json` lama. Keduanya digabung manual di langkah 5 dan 6.

---

## 3. shadcn/ui

```bash
pnpm dlx shadcn@latest init
```

CLI-nya bernama `shadcn`, bukan `shadcn-ui` (nama lama). Ia mendeteksi Tailwind v4 otomatis dan menulis token ke `app/globals.css` lewat `@theme` — **tidak ada `tailwind.config.ts`** di Tailwind v4.

Komponen yang dibutuhkan sesuai `docs/06-UI-NAVIGATION.md`:

```bash
pnpm dlx shadcn@latest add \
  button input label textarea select checkbox radio-group switch slider \
  table tabs dialog sheet drawer dropdown-menu popover tooltip hover-card \
  card badge alert alert-dialog separator scroll-area skeleton progress \
  form command accordion avatar breadcrumb sidebar sonner collapsible
```

- `table` dipakai sebagai primitif; logikanya dari TanStack Table (`docs/06` §3).
- `sonner` menggantikan komponen `toast` yang sudah usang.
- `slider` untuk matriks pairwise Saaty 1–9.
- `sidebar` untuk navigasi utama.

---

## 4. Dependensi

```bash
# Data, tabel, form, validasi
pnpm add @tanstack/react-table @tanstack/react-query \
         zod react-hook-form @hookform/resolvers
pnpm add -D @tanstack/react-query-devtools

# Animasi dan ikon
pnpm add motion lucide-react

# AI SDK 7 + provider langsung
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google \
         @ai-sdk/deepseek @ai-sdk/mistral @ai-sdk/openai-compatible

# Basis data
pnpm add @prisma/client
pnpm add -D prisma

# Utilitas
pnpm add p-limit nanoid date-fns

# Ekspor berkas (docs/07 §P4 — watermark)
pnpm add exceljs papaparse pdf-lib
pnpm add -D @types/papaparse

# Pengujian
pnpm add -D vitest @vitest/coverage-v8 tsx @types/node
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

**Catatan `motion`.** Framer Motion dirilis ulang dengan nama paket `motion`; impornya `from 'motion/react'`. Paket lama `framer-motion` masih terbit dan berfungsi, tapi pemeliharaan aktifnya di `motion`. Pakai salah satu, jangan keduanya.

**Qwen** memakai `@ai-sdk/openai-compatible` dengan base URL DashScope, bukan paket tersendiri. Lihat `docs/04-AI-PANEL.md` §3.

---

## 5. Gabungkan `package.json`

Tambahkan skrip berikut ke `package.json` hasil scaffold:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",

    "test:unit": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "method:verify": "vitest run lib/method",
    "schema:check": "tsx scripts/check-schema-invariants.ts",
    "baseline:check": "tsx prisma/validate-baseline.ts",
    "recompute": "python scripts/recompute.py",

    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",

    "check": "pnpm typecheck && pnpm schema:check && pnpm baseline:check && pnpm method:verify"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" }
}
```

`pnpm check` adalah gerbang wajib sebelum commit, sesuai `AGENTS.md` §7.

---

## 6. Gabungkan `tsconfig.json`

Tambahkan ke `tsconfig.json` hasil scaffold:

```jsonc
{
  "compilerOptions": {
    "strict": true,              // scaffold sudah true, pastikan tetap
    "types": ["vitest/globals", "node"]
  },
  "include": [
    "next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts",
    "lib/**/*", "prisma/**/*", "scripts/**/*"
  ]
}
```

---

## 7. Batas impor `lib/method`

`AGENTS.md` §4 mewajibkan `lib/method/` tetap murni. Tegakkan lewat ESLint:

```js
// eslint.config.mjs
import boundaries from 'eslint-plugin-import';

export default [
  // ...konfigurasi Next
  {
    files: ['lib/method/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@prisma/client', 'react', 'next/*', '@/app/*', '@/lib/ai/*', '@/lib/db/*'],
            message: 'lib/method harus murni — lihat AGENTS.md §4' },
        ],
      }],
    },
  },
];
```

```bash
pnpm add -D eslint-plugin-import
```

---

## 8. Basis data

Pakai Postgres lokal atau Neon/Supabase.

```bash
# lokal dengan Docker
docker run --name dcgmi-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
```

```bash
cp .env.example .env.local
# isi DATABASE_URL, mis:
# DATABASE_URL="postgresql://postgres:dev@localhost:5432/dcgmi?schema=public"

pnpm prisma generate
pnpm prisma validate        # sekarang bisa dijalankan
pnpm db:push
pnpm db:seed
```

Seed juga membuat Admin pertama dari `ADMIN_EMAIL` (dan `ADMIN_PASSWORD` bila diisi). Tanpa itu tidak ada yang dapat masuk, karena hanya email terdaftar yang diizinkan.

### Autentikasi (Auth.js v5)

| Variabel | Keterangan |
|---|---|
| `AUTH_SECRET` | Wajib. Buat dengan `npx auth secret`. `NEXTAUTH_SECRET` hanya dipakai sebagai cadangan |
| `AUTH_URL` | URL aplikasi, mis. `http://localhost:3000` |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Opsional. Tombol Google hanya muncul bila keduanya terisi. Redirect URI: `{AUTH_URL}/api/auth/callback/google` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Dipakai oleh seed, atau sendiri lewat `pnpm db:seed:admin` (aman diulang; akun yang sudah ada tidak diubah) |

Peran: **Admin** (dulu Owner), **Tester** (dulu Editor), **Pakar** (pakar manusia; hanya `/pakar`, tidak pernah melihat konsol simulasi).

### Paket penilaian A1.0 (definisi, rubrik 1–5, bukti)

```bash
pnpm artifact:import-package   # dari docs/DCGMI-Paket-Penilaian-43-Indikator.records.json; aman diulang
```

Mengisi konten 43 indikator tanpa mengubah struktur atau nama, dengan `ChangeLogEntry` per perubahan. G1 dievaluasi ulang dan tercatat `PENDING` bila syarat terpenuhi. Admin meluluskannya di Dasbor.

### Form pra-reviu pakar

```bash
pnpm instrument:import      # impor R1–V2.1.2B dari docs/R1-V2.1.2B-form-builder.gs; aman diulang
```

Form masuk berstatus `HOLD`. Admin membukanya di *Instrumen → Formulir*, mengikat kode P01–P06 ke akun Pakar di *Pengaturan → Pengguna & Peran*, dan pakar mengisi di `/pakar`.

> Setelah `prisma migrate`, **restart `pnpm dev`**. `lib/prisma.ts` menyimpan client di `globalThis`, sehingga dev server yang sudah berjalan tetap memakai client lama dan kolom baru tidak terbaca tanpa error.

Seed akan mencetak laporan gate. **`G1_BASELINE` memang akan gagal** (sampai `pnpm artifact:import-package` dijalankan) — 42 dari 43 indikator belum punya rubrik. Itu disengaja; lihat `README.md`.

---

## 9. Verifikasi

```bash
pnpm check
python scripts/recompute.py --self-test
```

Target keluaran:

```
39 model diperiksa — OK
8 domain, 15 aspek, 43 indikator (7-5-6-6-4-5-4-6) — OK
Test Files 5 passed · Tests 74 passed
OK — self-test Python cocok dengan docs/05-METHOD-RULES.md
```

---

## 10. Pertimbangkan AI Gateway

AI SDK 7 memasang **Vercel AI Gateway** sebagai default. Alih-alih mengelola enam kunci API, Anda cukup memakai satu dan memanggil model dengan string:

```ts
import { generateText } from 'ai';

const { text } = await generateText({
  model: 'anthropic/claude-opus-5.5',   // atau 'deepseek/...', 'qwen/...'
  prompt,
});
```

Ini sangat cocok dengan kebutuhan panel multi-provider: satu `AI_GATEWAY_API_KEY`, ganti provider per kursi hanya dengan mengubah string.

**Tapi periksa dulu implikasi tata kelola datanya.** Gateway berarti `PersonaBrief` melewati infrastruktur Vercel sebelum sampai ke provider. `docs/07-RESEARCH-INTEGRITY.md` §5 hanya menyetujui provider yang terdaftar; menambahkan gateway sebagai perantara adalah keputusan yang perlu dicatat di dokumen itu, bukan diputuskan diam-diam saat coding.

Kalau ragu, pakai provider langsung — `Provider.baseUrl` dan `envKeyName` di skema sudah dirancang untuk itu.

---

## Perubahan versi sejak spesifikasi ditulis

| Item | Di spesifikasi awal | Sebenarnya (Sep 2026) |
|---|---|---|
| Next.js | 15 | **16.3.x** — Turbopack default, `cookies()`/`headers()` async-only |
| Vercel AI SDK | v5 | **v7** — Node 22+, ESM, AI Gateway default |
| `revalidateTag` | satu argumen | **wajib argumen kedua** (profil `cacheLife`) |
| shadcn CLI | `shadcn-ui` | **`shadcn`** |
| Tailwind | v4 | v4 — tetap, tanpa `tailwind.config.ts` |

Yang berubah hanya lapisan kerangka kerja. `lib/method/`, skema Prisma, dan seluruh aturan metodologis tidak terpengaruh — itulah gunanya memisahkan kode murni dari kerangka kerja.
