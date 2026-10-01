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

**Terimplementasi (26 Sep 2026)** — `app/(app)/artefak/artifact-actions.ts`, izin `artifact:write`, repositori `lib/db/repository/artifact-edit.ts`:

```ts
// Semua form membawa meta: reason ≥5 (wajib), suggestionId? (tugas revisi), exceptionDecision? (C20b/C42)
updateContentAction(formData { indicatorId; name; operationalDefinition; assessmentObject; boundaryNote; sources (baris) })  // RUMUS_ULANG
saveRubricAction(formData { indicatorId; label-1..5; descriptor-1..5 })   // checkRubric: temuan blocking → VALIDATION_ERROR
saveEvidenceAction(formData { indicatorId; evidenceId?; remove?; kind; minimumFor; mandatory; description })  // TAMBAH | RUMUS_ULANG | HAPUS
addIndicatorAction(formData { aspectId; code /^C\d{2,3}[a-z]?$/; name; operationalDefinition })  // kode unik per versi; C20b/C42 tidak dipakai ulang
setDeletedAction(formData { indicatorId; deleted: 1|0 })   // soft delete (Indicator.deletedAt) / pulihkan
moveIndicatorAction(formData { indicatorId; targetAspectId })   // PINDAH, dalam versi yang sama
updateGroupAction(formData { type: Domain|Aspect; id; name; rationale; sdgTags? })
compareVersionsAction(fromId, toId) → DiffEntry[]   // console:read; lib/artifact/diff.ts
```

- Hanya versi berstatus `DRAFT` yang dapat disunting (versi turunan A1.1 dst.); A1.0 dan versi lain → `GATE_BLOCKED` (`NOT_EDITABLE`).
- Indikator controlled exception menuntut `exceptionDecision` ≥10 karakter → tanpa itu `CONTROLLED_EXCEPTION`. `decisionSource` ChangeLogEntry memuat keputusan tersebut.
- `impactNote` menyimpan nilai lama. Bila `suggestionId` diisi, tugas revisi ditandai diterapkan dalam transaksi yang sama.
- Setelah setiap suntingan, G1_BASELINE versi tersebut dievaluasi ulang (PENDING/FAILED, tidak pernah PASSED otomatis).
- `GABUNG`/`PECAH` belum tersedia.

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

```ts
// app/(app)/forms/gform-actions.ts — ADMIN (instrument:manage); FormData { formId, file (.xlsx ≤ 5 MB) }
previewGoogleImportAction(formData)   // tidak menulis apa pun; → { preview, fileSha256, fileName }
commitGoogleImportAction(formData & { expectedSha256, confirmed: "yes" })
  // VALIDATION_ERROR bila berkas berbeda dari pratinjau; CONFLICT bila data berubah sejak pratinjau
  // → { imported, declined }; AuditEvent FORM_IMPORT_GOOGLE
```

`GET /api/forms/[slug]/export` (ADMIN) → XLSX `Build_Info`, `DataEntry`, `Supplement`, `QC` (port `normalize_()` + `safeCell_()`), menulis `AuditEvent` `FORM_EXPORT`.

### FGD (M5, terimplementasi 26 Sep 2026)

```ts
// app/(app)/fgd/fgd-actions.ts — simulation:run (TESTER/ADMIN)
createFgdSessionAction(formData { configId; mode; crossTalkRounds 0–2; seed?; stages[]; domains[] })
  // GATE_BLOCKED bila G1_BASELINE belum PASSED; panel FGD_6 wajib lolos validasi komposisi
runNextItemAction(sessionId) → RunOutcome   // satu komponen per panggilan; ITEM_DONE | STAGE_DONE | SESSION_DONE | STOPPED_SPECIAL | FAILED | NOTHING
sessionControlAction(sessionId, "PAUSE" | "CANCEL" | "RETRY_FAILED")
saveAdoptionAction(formData { suggestionId; adopted: yes|no|""; reason })   // validateSuggestionAdoption (Tabel 3.5 baris terakhir)

// app/(app)/panel/panel-actions.ts — panel:manage
addGatewayModelAction(formData { modelId: "keluarga/model"; label })   // hanya keluarga docs/07 §5
loadGatewayCatalogAction()   // getAvailableModels, disaring ke keluarga yang disetujui
setPanelRolesAction(formData { configId; facilitatorModelId; notetakerModelId })
```

```ts
// app/(app)/fgd/apply-actions.ts — "Terapkan ke A1.1", artifact:write
resolveSpecialAction(formData { decisionId; note ≥10 })   // catatan resolusi PEMBAHASAN_KHUSUS (AuditEvent FGD_SPECIAL_RESOLVED)
deriveVersionAction(formData { label; note? })   // GATE_BLOCKED bila G2_FGD induk belum PASSED; CONFLICT bila label dipakai
  // salinan penuh DRAF (tanpa indikator terhapus), ChangeLogEntry TAMBAH ArtifactVersion, AuditEvent VERSION_DERIVE; versi aktif pindah ke turunan
markRevisionTaskAction(formData { suggestionId; done: 1|0; note? })   // hanya pada versi DRAF turunan
```

### Gate

```ts
evaluateGate(input: { versionId: string; gate: GateKey })
  → { status: GateStatus; unmet: string[] }

passGate(input: { versionId: string; gate: GateKey; note: string })   // ADMIN saja
// Terimplementasi: app/(app)/gate-actions.ts → passGateAction(formData { gate, note ≥10 })
// Syarat dihitung ulang dari DB saat ditekan; gate sebelumnya wajib PASSED; GATE_BLOCKED + details = unmet.
// Evaluator tersedia: G1_BASELINE dan G2_FGD (lib/db/repository/gates.ts; G2 lewat lib/db/repository/fgd-gate.ts → evaluateFgdGate). Impor otomatis hanya menulis PENDING/FAILED.
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

**Terimplementasi (M4, 26 Sep 2026):** `app/(app)/panel/panel-actions.ts` → `updateSeatAction` (TESTER/ADMIN `panel:manage`; menolak bidang pakar ≠ kursi dan pakar ganda dalam satu panel), `pingModelAction` (MOCK_AI=1: cek konfigurasi saja; selain itu prompt "ping" tanpa persona/CV/artefak; `AuditEvent MODEL_PING`). Validasi komposisi dihitung di server saat halaman Kursi dirender.

### Persona

```ts
uploadCv(input: { expertId: string; file: File })       // → cvFileKey
extractPersona(input: { expertId: string })             // generateObject; hasil DRAFT
approvePersona(input: { expertId: string })             // ADMIN; menolak bila filter de-id gagal
renderPersonaPrompt(input: { expertId: string })        // simpan systemPrompt + promptVersion
```

**Terimplementasi (M4):** `app/(app)/experts/expert-actions.ts` → `saveExpertAction`, `savePersonaAction` (isi manual; de-identifikasi + render prompt setiap simpan; edit persona APPROVED → DRAFT), `setPersonaStatusAction` (DRAFT→REVIEWED: `panel:manage`; →APPROVED/RETIRED: ADMIN `persona:approve`, de-identifikasi diulang, gagal = `VALIDATION_ERROR` dengan `details` temuan), `saveIdentityAction`/`deleteIdentityAction` (ADMIN). Semua menulis `AuditEvent`; payload tidak memuat identitas. `uploadCv` dan `extractPersona` belum dibangun (keputusan peneliti).

```ts
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

**Terimplementasi (M6, 26 Sep 2026)** — `app/(app)/delphi/delphi-actions.ts`, repositori `lib/db/repository/delphi-rounds.ts`, orkestrator `lib/delphi/run-round.ts`:

```ts
createDelphiRoundAction(formData { configId; seed? })      // simulation:run → redirect /delphi/ronde/[id]
  // planNextRound: versi DRAF turunan, G1 & G2 PASSED, ronde sebelumnya final, ≤ MAX_ROUNDS;
  // R1 = semua butir, R2/R3 = keputusan terakhir REVISI_NILAI_ULANG; peringatan NOT_REVISED_SINCE_Rn
runNextDelphiItemAction(roundId) → DelphiRunOutcome       // satu butir × 8 kursi per panggilan
  // ITEM_DONE | ROUND_DONE | DEVIATION (penilai valid ≠ 8 → ronde FAILED, tanpa hasil) | BLOCKED | NOTHING
delphiRoundControlAction(roundId, "PAUSE" | "RETRY")      // RETRY hanya memanggil ulang kursi yang gagal
reviewDelphiItemAction(formData { resultId; clarityCritical: yes|no|""; constructConflict?; note? })  // artifact:write
  // keputusan dihitung ulang dengan computeItemCvi; HAPUS_DARI_INTI tanpa catatan ditolak
finalizeDelphiRoundAction(formData { roundId })           // menolak bila penanda kejelasan belum ditinjau / hapus tanpa alasan
```

G3 dievaluasi oleh `evaluateDelphiGate` (docs/05 §6) dan diluluskan Admin lewat `passGateAction`.

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

**Terimplementasi (26 Sep 2026)** — `app/(app)/ahp/ahp-actions.ts` (simulation:run), repositori `lib/db/repository/ahp-sessions.ts`, orkestrator `lib/ahp/run-matrix.ts`:

```ts
createAhpSessionAction(formData { configId; seed?; scope-<kursi>: BOTH|DOMAIN|ASPECT; scenarios: "D3 -0.05\n…" })
  // planAhpSession: versi CONTENT_LOCKED, G4 PASSED, tidak ada sesi terbuka, G5 belum PASSED;
  // panel FGD_6/DELPHI_8 siap; setiap grup matriks punya kursi pengisi → redirect /ahp/sesi/[id]
runNextAhpMatrixAction(sessionId) → AhpRunOutcome   // satu matriks kursi per panggilan: MATRIX_DONE | SESSION_DONE | FAILED | BLOCKED | NOTHING
  // CR >= CR_MAX → RETURNED + percobaan baru berisi pasangan paling tidak konsisten; setelah 2 peninjauan → RETURNED_UNRESOLVED
  // matriks terakhir → agregasi geometris per grup (AIJ, hanya ACCEPTED), bobot individual semua kursi, skenario sensitivitas
ahpSessionControlAction(sessionId, "PAUSE" | "RETRY")
```

### Content lock (G4)

```ts
// app/(app)/delphi/delphi-actions.ts — gate:pass (ADMIN)
lockContentAction(formData { label; note ≥10 })
  // evaluateContentLockGate atas versi Delphi aktif; membuat versi CONTENT_LOCKED tanpa butir HAPUS_DARI_INTI/TIDAK_SELESAI,
  // ChangeLogEntry TAMBAH + HAPUS per butir yang tidak ikut, G1–G3 dicatat diwarisi + G4 PASSED, versi sumber → PROVISIONAL,
  // AuditEvent CONTENT_LOCK; versi aktif pindah ke versi terkunci
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

**Terimplementasi (26 Sep 2026)** — `app/(app)/scoring/scoring-actions.ts` (simulation:run), repositori `lib/db/repository/scoring-runs.ts`, orkestrator `lib/scoring/run-item.ts`:

```ts
saveProfileAction(formData { id?; label; description ≥40 })     // profil institusi FIKTIF; label diberi awalan [FIKTIF]; profil yang sudah dipakai tidak dapat diubah
createAssessmentAction(formData { profileId; modelProfileId; seed? })
  // planAssessment: versi CONTENT_LOCKED, G5 PASSED (bobot agregat sesi G5), G6 belum PASSED → redirect /scoring/asesmen/[id]
runNextScoreAction(assessmentId) → ScoringRunOutcome           // satu indikator per panggilan; level > evidenceLevelCap ditolak (bukan dipangkas)
  // indikator terakhir → computeIndex dengan bobot G5; rollup menyimpan profil domain, komposit PROVISIONAL, laporan data hilang, dan input
assessmentControlAction(assessmentId, "PAUSE" | "RETRY" | "CANCEL")
uploadRecomputeReportAction(formData { report: File })        // diterima hanya bila exportSha256 = SHA-256 ekspor saat ini; toleransi ≤ 1e-6
```

Route handler `GET /api/export/recompute` (console:read): ekspor deterministik versi aktif — `delphiItems` (versi Delphi dalam garis turunan), `ahpMatrices`, `ahpAggregates`, `assessments` — dengan `_warning` + `_dataOrigin` dan nama berkas `SIM_recompute_<label>.json`; header `X-Export-SHA256`.

### Pilot (G7)

```ts
// app/(app)/scoring/scoring-actions.ts
createPilotAction(formData { profileIds[]; assessorA; assessorB; seed? })   // simulation:run; G6 PASSED; A ≠ B; asesmen purpose=PILOT
runPilotStepAction(runId) → ScoringRunOutcome | { kind: "PILOT_DONE" }
declarePilotAction(formData { kind: ETHICS (reference, date) | ACCESS (note) })   // gate:pass (Admin); AuditEvent PILOT_DECLARE_*
// G7 dievaluasi evaluatePilotGate (lib/method/pilot.ts) atas pasangan A/B run pilot terakhir; diluluskan lewat passGateAction.
```

### Laporan lengkap G1–G7

```ts
// app/(app)/audit/report-actions.ts
createReportAction(formData { budget? })                 // simulation:run; ReportJob untuk versi aktif + garis turunannya → redirect /audit/laporan/[id]
advanceReportAction(jobId)                               // simulation:run; menarasikan satu bab PENDING per panggilan (ledger kind REPORT, anggaran job); semua bab → REVIEW
editChapterAction(formData { jobId; key; narrative ≥20 }) // artifact:write; bab kembali DRAFT, ditandai "disunting peneliti"
chapterOpAction(jobId, key, "APPROVE" | "REGENERATE")    // APPROVE: gate:pass (Admin); REGENERATE: simulation:run; PDF yang sudah dibangun dibuang bila bab berubah
buildReportAction(formData { jobId })                    // simulation:run; ditolak kecuali 10/10 bab APPROVED; menyimpan PDF, SHA-256, jumlah halaman; AuditEvent REPORT_BUILD
```

Route handler `GET /api/report/[jobId]` (console:read): mengirim PDF tersimpan sebagai `Laporan_G1-G7_<label>.pdf`, header `X-Report-SHA256`, AuditEvent `EXPORT_REPORT`. Isi PDF dibangun dari basis data (tabel lengkap, bukan ringkasan); narasi AI hanya pengantar tiap bab.

### Formulir

```ts
createForm / updateForm / duplicateForm / setFormStatus
upsertSection / upsertField / reorderFields
validateBranching(input: { formId: string })   → { ok: boolean; cycles: string[][] }
exportGoogleFormsScript(input: { formId: string })  → { appsScript: string; json: string }
importGoogleFormsCsv(input: { formId: string; file: File; mapping: Record<string,string> })
```

**Terimplementasi (26 Sep 2026)** — `app/(app)/forms/builder-actions.ts`, repositori `lib/db/repository/form-builder.ts`, logika murni `lib/forms/*`:

```ts
createFormAction(formData { slug; title; purpose; stageTag? })        // artifact:write; status DRAFT; terikat versi aktif
updateFormMetaAction(formData { formId; title; purpose; instructions?; stageTag?; respondents })
saveSectionAction(formData { formId; sectionId?; title; description?; next: NEXT|SUBMIT|<order> })
sectionOpAction(formId, sectionId, "UP"|"DOWN"|"DELETE")   // urutan & target lompatan dipetakan ulang
saveFieldAction(formData { formId; sectionId; fieldId?; key; type; label; helpText?; required; options; min/max/labels; elements; clarity; branch-<i> })
fieldOpAction(formId, fieldId, "UP"|"DOWN"|"DELETE")
setFormStatusAction(formId, DRAFT|DRY_RUN|HOLD|ACTIVE|CLOSED)   // ACTIVE/CLOSED: instrument:manage (Admin)
  // ACTIVE ditolak bila checkStructure (siklus, target lompatan, seksi tak terjangkau, seksi kosong, pilihan < 2), tanpa responden, atau gate tahap belum lulus
dryRunSaveAction / dryRunSubmitAction(formId, answers)   // hanya DRY_RUN; respondentRef UJI:<userId>; SIMULATED; tidak pernah dihitung
// app/pakar/[slug]/generic-actions.ts — instrument:fill; kode dari akun, bukan dari peramban; REAL sejak penulisan pertama
genericSaveAction(slug, answers, sectionOrder) / genericSubmitAction(slug, answers)   // submit memvalidasi seksi yang benar-benar dilalui
```

Struktur hanya dapat diubah pada DRAFT/DRY_RUN/HOLD dan sebelum ada respons REAL; formulir DELPHI dibuat dari artefak dan tidak disunting manual.

**Delphi pakar manusia (REAL)** — `app/(app)/delphi/delphi-actions.ts`, `lib/db/repository/delphi-real.ts`:

```ts
createRealRoundAction(formData { configId: DELPHI_8; seatCodes: 8 kode })   // instrument:manage
  // planNextRound(version, "REAL"): satu versi = satu origin (DELPHI_ORIGIN_CONFLICT); kode terikat akun Pakar aktif;
  // ronde 2/3 wajib kode & urutan sama; membuat DelphiRound REAL + formulir DELPHI (HOLD, stageTag DELPHI_CVI)
computeRealRoundAction(formData { roundId })   // artifact:write; formulir harus CLOSED; kursi i ↔ seatCodes[i];
  // kode tanpa respons atau menolak → relevance null (tidak diimputasi) → ronde berhenti bila penilai valid ≠ 8
```

### Run

```ts
createPipelineRun(input: { name: string; versionId: string; configId: string;
                           stagesPlan: StagePlan[]; mode: RunMode; budgetUsd?: number })
estimateRunCost(input: { runId: string })  → { tokens: number; usd: number; breakdown: ... }
startRun / pauseRun / resumeRun / cancelRun (input: { runId: string })
```

**Terimplementasi (26 Sep 2026)** — `app/(app)/runs/pipeline-actions.ts` (simulation:run), `lib/pipeline/advance.ts`, `lib/db/repository/pipeline.ts`:

```ts
createRunAction(formData { name; mode; fgdConfigId; crossTalkRounds; delphiConfigId; ahpConfigId; assessorModelId; profileIds[]; seed?; budget? })
  // versi aktif sebagai sumber FGD; agenda penuh, cakupan AHP BOTH, skenario bawaan → redirect /runs/jalur/[id]
advanceRunAction(runId) → AdvanceOutcome   // satu unit kerja: WORKED | WAITING(reason) | STEP_DONE | DONE | FAILED | STOPPED
  // FGD → DERIVE → DELPHI (R1–R3) → LOCK → AHP → SCORING; tidak pernah meluluskan gate atau mengambil keputusan peneliti
runControlAction(runId, "PAUSE" | "CANCEL" | "RETRY")
```

Anggaran & harga — `app/(app)/settings/budget-actions.ts`:

```ts
setMonthlyCapAction(formData { cap? })                 // users:manage (Admin)
setModelPriceAction(formData { modelProfileId; input; output })   // panel:manage; priceSource = MANUAL
refreshCatalogPricesAction()                            // panel:manage; katalog Gateway → CATALOG, tidak menimpa MANUAL
// Semua form pembuatan sesi (FGD, Delphi, AHP, asesmen) menerima `budget` opsional (USD).
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
| `/api/events?ref=<FgdSession\|DelphiRound\|AhpSession\|Assessment\|PipelineRun>:<id>` | GET | **Terimplementasi:** SSE `status`, `call` (baris ledger), `end`; `Last-Event-ID` = waktu panggilan terakhir |
| `/api/export/table?module&section&format=csv\|xlsx\|json\|pdf` | GET | **Terimplementasi:** ekspor tabel section mana pun, watermark docs/07 P4 (tidak dapat dimatikan) |
| `/api/export/recompute` | GET | **Terimplementasi:** ekspor deterministik untuk `scripts/recompute.py` (versi aktif) |
| `/api/export/reproduction` | GET | **Terimplementasi:** ZIP paket reproduksibilitas versi aktif + garis turunannya, dengan manifest SHA-256 |
| `/api/report/[jobId]` | GET | **Terimplementasi:** PDF laporan lengkap G1–G7 yang sudah disetujui per bab (`Laporan_G1-G7_<label>.pdf`; tanpa watermark sejak 29 Sep 2026 atas keputusan peneliti) |
| `/api/report/[jobId]/docx` | GET | **Terimplementasi:** versi Word (.docx) laporan yang sama, dibangun saat diunduh dari bab yang sudah disetujui (tanpa panggilan model); tanpa watermark, catatan simulasi, atau awalan `SIM_` atas keputusan peneliti 29 Sep 2026; AuditEvent `EXPORT_REPORT_DOCX` |
| `/api/report/[jobId]/part/[key]?format=pdf\|docx` | GET | **Terimplementasi:** satu bab laporan (`intro`, `g1`, `g2`, `derive`, `g3`…`g7`, `closing`) sebagai berkas tersendiri dengan sampul dan daftar isinya, `Laporan_<label>_<nn>_<bab>.<ext>`; AuditEvent `EXPORT_REPORT_PART` |
| `/api/report/[jobId]/parts` | GET | **Terimplementasi:** ZIP seluruh bab dalam Word dan PDF (`pdf/…`, `word/…`); AuditEvent `EXPORT_REPORT_PARTS` |
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
