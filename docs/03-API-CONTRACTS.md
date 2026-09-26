# 03 — Kontrak API

Mutasi memakai **Server Action**. Route Handler dipakai hanya untuk streaming AI, ekspor berkas, webhook, dan endpoint publik formulir.

Semua masukan divalidasi Zod di `lib/validation/`. Skema yang sama dipakai form klien dan server — satu definisi, bukan dua.

---

## 1. Bentuk hasil yang seragam

```ts
type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };
```

Kode error yang dikenal:

| Kode | Arti |
|---|---|
| `GATE_BLOCKED` | Gate prasyarat belum lulus; `details.unmet` memuat daftarnya |
| `ORIGIN_MISMATCH` | Percobaan mencampur `SIMULATED` dan `REAL` |
| `METHOD_ERROR` | Pelanggaran aturan perhitungan (mis. bobot tidak berjumlah 1) |
| `CONTROLLED_EXCEPTION` | Mutasi menyentuh `C20b`/`C42` tanpa keputusan versi |
| `PANEL_SIZE_DEVIATION` | Jumlah penilai valid tidak sesuai rencana |
| `FORBIDDEN` | Peran tidak mencukupi |
| `VALIDATION_ERROR` | Zod gagal |
| `CONFLICT` | Entitas unik sudah ada (mis. email pengguna) |
| `LAST_ADMIN` | Perubahan akan meninggalkan sistem tanpa Admin aktif |
| `NOT_READY` | Form belum memenuhi syarat kesiapan/verifikasi isi |
| `NOT_ACTIVE` | Form tidak sedang menerima respons |
| `ALREADY_SUBMITTED` | Respons untuk kode ini sudah dikirim (tidak dapat diubah) |

---

## 2. Server Actions

### Artefak

```ts
createArtifactVersion(input: { label: string; parentId?: string; note?: string })
updateDomain(input: { id: string; name?: string; rationale?: string; sdgTags?: string[] })
createIndicator(input: CreateIndicatorInput)            // memicu ChangeLogEntry
deleteIndicator(input: { id: string; reason: string })  // menolak C20b/C42 tanpa versionDecision
upsertRubricLevels(input: { indicatorId: string; levels: RubricLevelInput[] })  // wajib 1..5 lengkap
upsertEvidenceRequirements(input: { indicatorId: string; items: EvidenceInput[] })
diffVersions(input: { fromId: string; toId: string })   // read-only
```

Setiap mutasi artefak berjalan dalam satu transaksi Prisma bersama penulisan `ChangeLogEntry`. Bila salah satu gagal, keduanya batal.

### Pengguna (ADMIN saja)

```ts
createUserAction(formData: { email; name?; role: 'ADMIN'|'TESTER'|'PAKAR'; password? })  // CONFLICT bila email ada
updateUserRoleAction(formData: { userId; role })        // LAST_ADMIN bila Admin aktif terakhir diturunkan
setUserActiveAction(formData: { userId; active })       // tidak boleh menonaktifkan diri sendiri
setUserPasswordAction(formData: { userId; password })   // minimal 12 karakter, disimpan sebagai hash scrypt
```

Setiap action menulis `AuditEvent` (`USER_*`) dalam transaksi yang sama; payload tidak pernah memuat kata sandi. Login menulis `AUTH_SIGN_IN`.

### Form pra-reviu pakar

```ts
// app/pakar/[slug]/actions.ts — peran PAKAR dengan panelCode; form ACTIVE; kode ada di snapshot
saveDraftAction(slug, answers, pageIndex)   // hanya setelah "Bersedia"; draf REAL, satu per kode
submitAction(slug, answers)                 // VALIDATION_ERROR (details = AnswerIssue[]) | ALREADY_SUBMITTED | NOT_ACTIVE
declineAction(slug)                         // "Tidak bersedia": hanya pilihan + waktu, tanpa kode

// app/(app)/forms/form-actions.ts — ADMIN (instrument:manage)
toggleFormAction(formData: { formId; open })   // NOT_READY bila productionReadiness_/verifikasi isi gagal
setUserPanelCodeAction(formData: { userId; panelCode })   // CONFLICT bila kode sudah dipakai
```

`GET /api/forms/[slug]/export` (ADMIN) → XLSX `Build_Info`, `DataEntry`, `Supplement`, `QC` (port `normalize_()` + `safeCell_()`), menulis `AuditEvent` `FORM_EXPORT`.

### Gate

```ts
evaluateGate(input: { versionId: string; gate: GateKey })
  → { status: GateStatus; unmet: string[] }

passGate(input: { versionId: string; gate: GateKey; note: string })   // ADMIN saja
// Terimplementasi: app/(app)/gate-actions.ts → passGateAction(formData { gate, note ≥10 })
// Syarat dihitung ulang dari DB saat ditekan; gate sebelumnya wajib PASSED; GATE_BLOCKED + details = unmet.
// Evaluator tersedia: G1_BASELINE (lib/db/repository/gates.ts). Impor otomatis hanya menulis PENDING/FAILED.
reopenGates(input: { versionId: string; gates: GateKey[]; reason: string })
```

### Panel

```ts
createPanelConfig(input: { name: string; preset: 'FGD_6'|'DELPHI_8'|'CUSTOM'; panelSize: number })
upsertSeat(input: { configId: string; seatIndex: number; expertId?: string;
                    modelProfileId: string; field: ExpertField;
                    temperature?: number; seed?: number; isNewMember?: boolean })
validatePanelComposition(input: { configId: string })
  → { ok: boolean; issues: string[] }   // komposisi bidang vs preset, korelasi model
testProvider(input: { modelProfileId: string })
```

### Persona

```ts
uploadCv(input: { expertId: string; file: File })       // → cvFileKey
extractPersona(input: { expertId: string })             // generateObject; hasil DRAFT
approvePersona(input: { expertId: string })             // ADMIN; menolak bila filter de-id gagal
renderPersonaPrompt(input: { expertId: string })        // simpan systemPrompt + promptVersion
```

### FGD

```ts
createFgdSession(input: { versionId: string; configId: string;
                          mode: RunMode; agendaPreset: string })
  // memanggil assertGate('G1_BASELINE')

startFgdStage(input: { stageId: string })
recordFgdDecision(input: { itemId: string })            // menerapkan aturan Tabel 3.5
adoptSuggestion(input: { suggestionId: string; adopted: boolean; notAdoptedReason?: string })
  // menolak bila adopted === false dan notAdoptedReason kosong
applyRevisionMatrix(input: { sessionId: string; newLabel: string })
  → ArtifactVersion                                     // membuat A1.1
```

### Delphi

```ts
createDelphiRound(input: { versionId: string; configId: string; roundNumber: 1|2|3 })
  // assertGate('G2_FGD'); ronde 2 hanya memuat butir belum selesai

submitDelphiRatings(input: { roundId: string; seatIndex: number;
                             ratings: { indicatorId: string; relevance: number|null;
                                        clarityFlag: boolean; clarityNote?: string }[] })

computeDelphiResults(input: { roundId: string })
  → { items: DelphiItemResult[]; sCviAve: number; panelDeviation?: string }
  // menghentikan dan melaporkan bila validRaters != panelSize

buildRoundFeedback(input: { roundId: string; seatIndex: number })
  → { own: number; median: number; iqr: number; distribution: number[] }   // tanpa identitas
```

### AHP

```ts
createAhpSession(input: { versionId: string; configId: string;
                          scope: 'DOMAIN'|'ASPECT'|'BOTH';
                          scenarios: SensitivityInput[] })
  // assertGate('G4_CONTENT_LOCK')

submitPairwise(input: { sessionId: string; seatIndex: number; level: 'DOMAIN'|'ASPECT';
                        parentCode?: string; pairs: PairJudgement[] })
  → { lambdaMax: number; ci: number; cr: number; accepted: boolean }

returnMatrixToSeat(input: { matrixId: string })          // CR >= 0.10
aggregateWeights(input: { sessionId: string })           // rata-rata geometris atas sel
runSensitivity(input: { sessionId: string })
```

### Penskoran

```ts
createAssessment(input: { versionId: string; institutionLabel: string; assessorRef: string })
  // assertGate('G5_AHP')
upsertIndicatorScore(input: { assessmentId: string; indicatorId: string;
                              level?: number; missingKind: MissingKind;
                              evidenceLocator?: string; rationale?: string })
computeAssessment(input: { assessmentId: string })
  → { domainProfile: Record<string, number|null>;
      composite: number|null; compositeStatus: 'PROVISIONAL';
      missingReport: MissingEntry[] }
```

### Formulir

```ts
createForm / updateForm / duplicateForm / setFormStatus
upsertSection / upsertField / reorderFields
validateBranching(input: { formId: string })   → { ok: boolean; cycles: string[][] }
exportGoogleFormsScript(input: { formId: string })  → { appsScript: string; json: string }
importGoogleFormsCsv(input: { formId: string; file: File; mapping: Record<string,string> })
```

### Run

```ts
createPipelineRun(input: { name: string; versionId: string; configId: string;
                           stagesPlan: StagePlan[]; mode: RunMode; budgetUsd?: number })
estimateRunCost(input: { runId: string })  → { tokens: number; usd: number; breakdown: ... }
startRun / pauseRun / resumeRun / cancelRun (input: { runId: string })
```

---

## 3. Route Handlers

| Route | Metode | Fungsi |
|---|---|---|
| `/api/ai/fgd/stream` | POST | SSE transkrip FGD langsung |
| `/api/ai/delphi/stream` | POST | SSE progres ronde |
| `/api/runs/[id]/events` | GET | SSE status pipeline |
| `/api/export/[kind]` | POST | Menghasilkan CSV/XLSX/JSON/PDF berwatermark |
| `/api/export/reproduction/[runId]` | GET | ZIP paket reproduksibilitas |
| `/api/forms/[slug]/submit` | POST | Pengiriman formulir publik (rate-limited) |
| `/api/forms/[slug]/autosave` | POST | Simpan otomatis jawaban parsial |
| `/api/files/signed-url` | POST | URL bertanda tangan untuk CV/lampiran |
| `/api/health` | GET | Kesehatan aplikasi dan basis data |

Endpoint publik (`/api/forms/*`) memakai rate limiting dan tidak pernah mengembalikan data internal apa pun selain definisi formulir yang berstatus `ACTIVE` atau `DRY_RUN`.

---

## 4. Konvensi

- Setiap action yang mengubah data memanggil `getCurrentUser()` + `can()`/`assertPermission()` (`lib/auth/`) lalu `assertGate()` sebelum apa pun. Peran dibaca dari basis data, bukan dari JWT.
- Setiap action yang mengubah data menulis `AuditEvent`.
- Tidak ada action yang menerima `dataOrigin` dari klien. Nilai itu ditentukan server berdasarkan konteks eksekusi (orkestrator AI → `SIMULATED`; form intake pakar → `REAL`).
- Revalidasi cache memakai tag. **Next.js 16 mewajibkan argumen kedua** berupa profil `cacheLife`: `revalidateTag('artifact:' + versionId, 'max')`. Bentuk satu argumen sudah deprecated dan menghasilkan error TypeScript.
