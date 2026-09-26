# 01 — Arsitektur

## Prinsip

1. **Kode metodologis murni dan terisolasi.** `lib/method/` tidak mengimpor Prisma, React, atau `app/`. Masukannya struktur data biasa, keluarannya struktur data biasa. Ini syarat agar perhitungan dapat diuji dan diaudit independen (R1–V1.7 §3.14).
2. **Gate di server.** Pemeriksaan gate tidak pernah hanya di UI. Setiap server action memanggil `assertGate()` sebelum mutasi.
3. **Origin melekat pada data, bukan pada tampilan.** Pemisahan simulasi/nyata ditegakkan di lapisan repository.
4. **Orkestrasi AI terpisah dari domain.** `lib/ai/` tidak tahu aturan CVI; `lib/method/` tidak tahu ada model bahasa.

---

## Lapisan

```
┌─────────────────────────────────────────────────────┐
│  app/  — Server Components, Server Actions, Routes  │
├─────────────────────────────────────────────────────┤
│  lib/db/repository/  — akses data + penegakan origin│
├──────────────────────┬──────────────────────────────┤
│  lib/method/         │  lib/ai/                     │
│  (murni, tanpa I/O)  │  (provider, persona, orkes.) │
├──────────────────────┴──────────────────────────────┤
│  Prisma · PostgreSQL · Blob storage                 │
└─────────────────────────────────────────────────────┘
```

Aturan impor yang ditegakkan ESLint (`import/no-restricted-paths`):

| Dari | Tidak boleh mengimpor |
|---|---|
| `lib/method/**` | `@prisma/client`, `react`, `next/*`, `app/**`, `lib/ai/**`, `lib/db/**` |
| `lib/ai/**` | `lib/method/**` |
| `components/**` | `lib/db/**` |

---

## Alur data: satu sesi FGD

```
Peneliti → buat FgdSession (artifactVersionId, panelConfigId, agendaPreset)
              │
              ▼
        assertGate(G1_BASELINE)
              │
              ▼
   Orchestrator (lib/ai/fgd-orchestrator.ts)
      │
      ├─ untuk tiap AgendaStage
      │    ├─ untuk tiap Component dalam stage
      │    │    ├─ facilitator.present(component)      → FgdUtterance
      │    │    ├─ seats.map(seat => seat.argue(...))  → FgdUtterance[]   (paralel)
      │    │    ├─ crossTalk (opsional, N putaran)     → FgdUtterance[]
      │    │    ├─ seats.map(seat => seat.vote(...))   → FgdPosition[]    (generateObject)
      │    │    └─ notetaker.extract(...)              → FgdSuggestion[]
      │    │
      │    └─ applyFgdDecisionRule(positions)          → FgdDecision   ← lib/method (murni)
      │
      ▼
  RevisionMatrix  →  ArtifactVersion A1.1 (draf)  →  review peneliti  →  commit + ChangeLogEntry
```

Semua penulisan memakai `dataOrigin: SIMULATED`.

---

## Alur data: Delphi → AHP

```
FGD selesai → assertGate(G2_FGD)
   ↓
DelphiRound r1: 8 kursi × 43 indikator → DelphiRating[]
   ↓ lib/method/cvi.ts
computeItemCvi() → { iCvi, median, iqr, n }  per indikator
decideItem()     → PERTAHANKAN | REVISI | HAPUS
   ↓
r2 (hanya butir belum selesai) → r3 (bila perlu)
   ↓
computeScaleCvi() → S-CVI/Ave ≥ 0.90 ?
   ↓ assertGate(G3_DELPHI)
Admin menekan CONTENT LOCK → ArtifactVersion A2.0, status CONTENT_LOCKED
   ↓ assertGate(G4_CONTENT_LOCK)
AHP: matriks domain (8×8) + matriks aspek per domain
   ↓ lib/method/ahp.ts
priorityVector() → CI → CR
CR ≥ 0.10 ? → kembalikan ke kursi, jangan perbaiki otomatis
   ↓
aggregateGeometric() → bobot panel
sensitivity(scenarios) → laporan
```

---

## Orkestrasi AI

`lib/ai/`:

```
provider-registry.ts   # id provider → factory model (Vercel AI SDK)
persona.ts             # PersonaBrief → system prompt kursi
seat.ts                # satu kursi pakar: argue(), respond(), vote()
facilitator.ts
notetaker.ts
fgd-orchestrator.ts
delphi-orchestrator.ts
ahp-orchestrator.ts
mock/                  # fixture untuk MOCK_AI=1
```

**Keluaran terstruktur.** Voting, ekstraksi saran, rating Delphi, dan matriks pairwise memakai `generateObject` dengan skema Zod. Tidak ada parsing teks bebas untuk angka. Bila model gagal memenuhi skema setelah 2 percobaan, langkah ditandai `FAILED` dan run berhenti — tidak diisi nilai default.

**Paralelisme.** Kursi berjalan paralel dalam satu komponen dengan batas konkurensi (`p-limit`, default 4). Antar-komponen berurutan karena konteks berakumulasi.

**Isolasi konteks.** Kursi "pakar baru" pada preset Delphi-8 memakai `contextScope: 'ARTIFACT_ONLY'`; orkestrator secara fisik tidak menyertakan transkrip atau distribusi FGD dalam prompt mereka pada ronde 1 (§3.8.1).

---

## Penegakan origin

```ts
// lib/db/repository/base.ts
export function assertSingleOrigin(rows: { dataOrigin: DataOrigin }[]) {
  const kinds = new Set(rows.map(r => r.dataOrigin));
  if (kinds.size > 1) throw new OriginMismatchError([...kinds]);
}
```

Setiap fungsi agregasi di repository memanggilnya sebelum menghitung. Uji e2e memastikan pelanggaran benar-benar melempar.

---

## Penyimpanan berkas

| Jenis | Lokasi | Akses |
|---|---|---|
| CV pakar | Bucket privat `cv/` | URL bertanda tangan, berlaku 15 menit, hanya Admin/Tester |
| Lampiran respons formulir | Bucket privat `uploads/` | Sama |
| Ekspor | Dibuat sesaat, tidak disimpan permanen | |
| Pemetaan kode↔identitas | Tabel `PanelistIdentity`, terpisah dari tabel analisis | Hanya Admin |

---

## Runtime

Node 22+ (AI SDK 7 memerlukannya). Next.js 16 memakai Turbopack secara default untuk `next dev` dan `next build`; jangan menambahkan konfigurasi webpack kustom kecuali benar-benar perlu, karena build akan gagal untuk mencegah salah konfigurasi.

## Deployment

Vercel (Next.js) + Neon/Supabase (PostgreSQL) + Vercel Blob atau S3. Variabel lingkungan hanya di server. Preview deployment **wajib** memakai basis data terpisah dan `MOCK_AI=1` agar tidak membakar kuota.
