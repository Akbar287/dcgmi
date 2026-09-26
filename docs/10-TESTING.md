# 10 — Strategi Pengujian

## Piramida

| Lapis | Alat | Cakupan |
|---|---|---|
| Unit — metodologis | Vitest | `lib/method/**` — **wajib 100%** cabang |
| Unit — utilitas | Vitest | validasi, format, de-identifikasi |
| Integrasi | Vitest + Prisma (DB uji) | repository, gate, origin, transaksi change log |
| Orkestrator | Vitest + `MOCK_AI=1` | alur FGD/Delphi/AHP tanpa memanggil provider |
| E2E | Playwright | jalur pengguna kritis |
| Rekalkulasi | Python + NumPy | pemeriksaan silang independen |

---

## `pnpm method:verify`

Menjalankan seluruh test vector di `docs/05-METHOD-RULES.md` dan menghasilkan laporan ringkas. Gagal di sini memblokir semua pekerjaan lain.

```
FGD decision rules      F1–F9    ✓ 9/9
CVI item decisions      C1–C7    ✓ 7/7
S-CVI scale             S-CVI    ✓ 1/1
AHP priority & CR       A1–A5    ✓ 5/5
Scoring aggregation     S1–S5    ✓ 5/5
```

Vector yang paling sering diimplementasikan salah dan harus selalu diperiksa:

- **C3** — I-CVI 0,750 **tidak** lolos. Ambangnya 0,78, bukan 0,75.
- **C7** — penilai valid 7 dari rencana 8 → ronde dihentikan, bukan ambang disesuaikan.
- **S3** — `MISSING_ADMINISTRATIF` menghasilkan `null`, bukan rerata dari sisa indikator.
- **A3** — matriks tidak konsisten ditolak, tidak diperbaiki otomatis.
- **F7** — `≥2 tolak` menang atas `≥4 non-terima` dalam urutan evaluasi.

---

## Uji integritas (wajib, e2e)

| Uji | Harapan |
|---|---|
| Agregasi campuran origin | `OriginMismatchError` dilempar |
| AHP sebelum content lock | `GateError` dengan daftar `unmet` |
| Ekspor run simulasi | Watermark ada di CSV, XLSX, JSON, dan PDF |
| Hapus `C20b` tanpa keputusan versi | Ditolak `CONTROLLED_EXCEPTION` |
| `G1_BASELINE` dengan indikator tanpa rubrik | Gate gagal, `INDICATOR_WITHOUT_RUBRIC` |
| Prompt kursi `isNewMember` pada Delphi R1 | Tidak memuat penanda konteks FGD |
| `PersonaBrief` memuat nama | Tidak dapat di-`APPROVED` |
| Mutasi artefak gagal di tengah | Transaksi batal, `ChangeLogEntry` tidak tertinggal |

---

## Rekalkulasi independen

`scripts/recompute.py` membaca ekspor JSON satu run dan menghitung ulang I-CVI, median, IQR, bobot AHP, CR, dan skor agregat dengan NumPy — tanpa melihat kode TypeScript. Toleransi perbedaan: `1e-6`.

```bash
pnpm export:run --id <runId> --out tmp/run.json
python scripts/recompute.py tmp/run.json --check
```

Ini memenuhi persyaratan "jejak komputasional" dan "rekalkulasi independen" pada R1–V1.7 §3.14 dan Tabel 3.10.

---

## Data uji

- `prisma/seed.ts` — baseline A1.0 (8–15–43)
- `tests/fixtures/artifact-minimal.json` — 2 domain, 3 aspek, 5 indikator; cepat untuk uji alur
- `tests/fixtures/ai-responses/` — keluaran model terekam untuk `MOCK_AI=1`, deterministik
- `tests/fixtures/delphi-ratings.csv` — matriks rating yang jawabannya sudah dihitung tangan

Fixture AI direkam sekali dari panggilan nyata lalu dibekukan. Jangan regenerasi tanpa alasan — determinisme fixture adalah yang membuat uji orkestrator berguna.

---

## CI

```yaml
on: [push, pull_request]
jobs:
  verify:
    - pnpm install --frozen-lockfile
    - pnpm typecheck
    - pnpm lint
    - pnpm method:verify      # gerbang keras
    - pnpm test:unit
    - pnpm test:integration   # dengan layanan postgres
    - pnpm build
    - pnpm test:e2e           # MOCK_AI=1
```

CI **tidak pernah** memanggil provider AI sungguhan.
