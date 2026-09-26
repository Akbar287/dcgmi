# 02 — Model Data

Skema Prisma acuan. Nama tabel mengikuti istilah naskah R1–V1.7 agar jejak audit mudah dibaca penguji.

```prisma
generator client { provider = "prisma-client-js" }
datasource db    { provider = "postgresql"; url = env("DATABASE_URL") }

// ─────────────────────────── ENUM ───────────────────────────

enum DataOrigin      { SIMULATED REAL }
enum Stage           { BASELINE FGD DELPHI_CVI CONTENT_LOCK AHP SCORING PILOT }
enum GateStatus      { PENDING PASSED FAILED REOPENED }
enum ArtifactStatus  { DRAFT PROVISIONAL CONTENT_LOCKED ARCHIVED }
enum ExpertField     { IT_GOVERNANCE MANAJEMEN_PT SPBE SUSTAINABILITY }
enum EvidenceKind    { NORMATIF IMPLEMENTASI OPERASIONAL HASIL PERBAIKAN }
enum FgdPositionType { TERIMA TERIMA_DENGAN_REVISI TOLAK }
enum ActionType      { TAMBAH HAPUS GABUNG PECAH PINDAH RUMUS_ULANG }
enum FgdDecisionType { REVISI PEMBAHASAN_KHUSUS TIDAK_SEPAKAT PERTAHANKAN_SEMENTARA TERIMA }
enum DelphiDecision  { PERTAHANKAN REVISI_NILAI_ULANG HAPUS_DARI_INTI BARU TIDAK_SELESAI }
enum MissingKind     { NONE TIDAK_ADA_KAPABILITAS MISSING_ADMINISTRATIF }
enum FormStatus      { DRAFT DRY_RUN HOLD ACTIVE CLOSED }
enum RunMode         { STEP AUTO }
enum RunStatus       { QUEUED RUNNING PAUSED COMPLETED FAILED CANCELLED }
enum Role            { ADMIN TESTER PAKAR }   // dulu OWNER EDITOR VIEWER

// ───────────────────── ARTEFAK & VERSI ──────────────────────

model ArtifactVersion {
  id          String          @id @default(cuid())
  label       String          @unique          // "DCGMI-A1.0", "DCGMI-A1.1", "DCGMI-A2.0"
  status      ArtifactStatus  @default(DRAFT)
  parentId    String?
  parent      ArtifactVersion?  @relation("VersionLineage", fields: [parentId], references: [id])
  children    ArtifactVersion[] @relation("VersionLineage")
  note        String?
  contentLockedAt DateTime?
  createdAt   DateTime        @default(now())

  domains     Domain[]
  changeLog   ChangeLogEntry[]
  gates       GateRecord[]
  fgdSessions FgdSession[]
  delphiRounds DelphiRound[]
  ahpSessions AhpSession[]
}

model Domain {
  id         String  @id @default(cuid())
  versionId  String
  version    ArtifactVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  code       String          // "D1"
  order      Int
  name       String
  rationale  String?
  sdgTags    String[]        // ["SDG4","SDG9","SDG16","SDG17"]
  slrStrings String[]        // ["S1","S3","S5"]
  aspects    Aspect[]
  @@unique([versionId, code])
}

model Aspect {
  id         String @id @default(cuid())
  domainId   String
  domain     Domain @relation(fields: [domainId], references: [id], onDelete: Cascade)
  code       String          // "A01"
  order      Int
  name       String
  rationale  String?
  indicators Indicator[]
  @@unique([domainId, code])
}

model Indicator {
  id                  String @id @default(cuid())
  aspectId            String
  aspect              Aspect @relation(fields: [aspectId], references: [id], onDelete: Cascade)
  code                String          // "C01" … "C42", "C20b"
  order               Int
  name                String

  // Paket penilaian (R1-V1.7 §3.6.1) — wajib lengkap sebelum G1
  operationalDefinition String?
  assessmentObject      String?
  boundaryNote          String?
  sources               String[]

  isControlledException Boolean @default(false)   // C20b, C42
  exceptionNote         String?

  rubricLevels RubricLevel[]
  evidence     EvidenceRequirement[]
  delphiRatings DelphiRating[]
  scores       IndicatorScore[]
  @@unique([aspectId, code])
}

model RubricLevel {
  id          String @id @default(cuid())
  indicatorId String
  indicator   Indicator @relation(fields: [indicatorId], references: [id], onDelete: Cascade)
  level       Int       // 1..5
  label       String    // Initial, Developing, Defined, Managed, Optimized
  descriptor  String
  cumulative  Boolean @default(true)
  @@unique([indicatorId, level])
}

model EvidenceRequirement {
  id          String @id @default(cuid())
  indicatorId String
  indicator   Indicator @relation(fields: [indicatorId], references: [id], onDelete: Cascade)
  kind        EvidenceKind
  minimumFor  Int?        // level minimum yang dipenuhi bukti ini
  mandatory   Boolean @default(false)
  description String
}

model ChangeLogEntry {
  id             String   @id @default(cuid())
  versionId      String
  version        ArtifactVersion @relation(fields: [versionId], references: [id])
  targetType     String   // Domain | Aspect | Indicator | RubricLevel | Weight
  targetCode     String
  action         ActionType
  reason         String
  decisionSource String   // "FGD-S1-C12" | "DELPHI-R2" | "MANUAL"
  impactNote     String?
  actorId        String?
  createdAt      DateTime @default(now())
  @@index([versionId, targetCode])
}

// ───────────────────────── GATE ─────────────────────────────

model GateRecord {
  id            String     @id @default(cuid())
  versionId     String
  version       ArtifactVersion @relation(fields: [versionId], references: [id])
  gate          String     // G1_BASELINE … G7_PILOT
  status        GateStatus @default(PENDING)
  unmet         String[]   // daftar syarat yang belum terpenuhi
  decidedById   String?
  decidedAt     DateTime?
  note          String?
  @@unique([versionId, gate])
}

// ──────────────────── PAKAR & PERSONA ───────────────────────

model Expert {
  id            String      @id @default(cuid())
  panelCode     String      @unique   // "P1" — kode yang dipakai di analisis
  displayName   String?               // boleh kosong / disamarkan
  field         ExpertField
  affiliation   String?
  coiDeclared   Boolean     @default(false)
  coiNote       String?
  inFgd         Boolean     @default(false)
  inDelphi      Boolean     @default(false)
  inAhp         Boolean     @default(false)
  cvFileKey     String?               // kunci objek di bucket privat
  persona       PersonaBrief?
  seats         PanelSeat[]
}

/// Profil kompetensi TER-DE-IDENTIFIKASI yang dikirim ke provider.
/// Tidak boleh memuat nama, institusi, gelar, atau penanda unik.
model PersonaBrief {
  id              String  @id @default(cuid())
  expertId        String  @unique
  expert          Expert  @relation(fields: [expertId], references: [id], onDelete: Cascade)
  expertiseAreas  String[]
  yearsExperience Int?
  institutionType String?
  researchFocus   String[]
  methodStance    String?
  vocabularyHints String[]
  emphasisBias    String?
  approved        Boolean @default(false)
  approvedById    String?
  approvedAt      DateTime?
  systemPrompt    String            // hasil render, disimpan agar reproducible
  promptVersion   String
}

// ──────────────────── PANEL AI ──────────────────────────────

model Provider {
  id            String  @id @default(cuid())
  key           String  @unique     // "openai" | "deepseek" | "qwen" | "anthropic" | "custom-1"
  label         String
  baseUrl       String?
  envKeyName    String              // nama variabel lingkungan, BUKAN nilainya
  enabled       Boolean @default(true)
  models        ModelProfile[]
}

model ModelProfile {
  id          String   @id @default(cuid())
  providerId  String
  provider    Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  modelId     String              // "gpt-4o", "deepseek-chat", "qwen-max"
  label       String
  contextWindow Int?
  inputCostPer1k  Decimal? @db.Decimal(10,6)
  outputCostPer1k Decimal? @db.Decimal(10,6)
  seats       PanelSeat[]
  @@unique([providerId, modelId])
}

model PanelConfig {
  id          String      @id @default(cuid())
  name        String
  preset      String      // "FGD_6" | "DELPHI_8" | "CUSTOM"
  panelSize   Int
  facilitatorModelId String?
  notetakerModelId   String?
  seats       PanelSeat[]
  fgdSessions FgdSession[]
  delphiRounds DelphiRound[]
  ahpSessions AhpSession[]
  createdAt   DateTime @default(now())
}

model PanelSeat {
  id            String  @id @default(cuid())
  configId      String
  config        PanelConfig @relation(fields: [configId], references: [id], onDelete: Cascade)
  seatIndex     Int              // 1..N — "Pakar 1"
  label         String
  expertId      String?
  expert        Expert? @relation(fields: [expertId], references: [id])
  modelProfileId String
  modelProfile  ModelProfile @relation(fields: [modelProfileId], references: [id])
  field         ExpertField
  temperature   Float   @default(0.7)
  seed          Int?
  isNewMember   Boolean @default(false)   // kursi "pakar baru" pada Delphi-8
  contextScope  String  @default("FULL")  // FULL | ARTIFACT_ONLY
  @@unique([configId, seatIndex])
}

// ──────────────────────── FGD ───────────────────────────────

model FgdSession {
  id          String @id @default(cuid())
  versionId   String
  version     ArtifactVersion @relation(fields: [versionId], references: [id])
  configId    String
  config      PanelConfig     @relation(fields: [configId], references: [id])
  dataOrigin  DataOrigin @default(SIMULATED)
  mode        RunMode    @default(STEP)
  status      RunStatus  @default(QUEUED)
  agendaPreset String    @default("CORONG_11")
  startedAt   DateTime?
  endedAt     DateTime?
  stages      FgdStage[]
}

model FgdStage {
  id         String @id @default(cuid())
  sessionId  String
  session    FgdSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  order      Int
  key        String   // PEMBUKAAN, VALIDASI_MASALAH, STRUKTUR_DOMAIN, ...
  title      String
  status     RunStatus @default(QUEUED)
  items      FgdItem[]
}

model FgdItem {
  id          String @id @default(cuid())
  stageId     String
  stage       FgdStage @relation(fields: [stageId], references: [id], onDelete: Cascade)
  targetType  String   // Domain | Aspect | Indicator | Rubric | Formula | Weighting
  targetCode  String
  utterances  FgdUtterance[]
  positions   FgdPosition[]
  suggestions FgdSuggestion[]
  decision    FgdDecisionRecord?
}

model FgdUtterance {
  id        String @id @default(cuid())
  itemId    String
  item      FgdItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  speaker   String   // "FACILITATOR" | "SEAT_3" | "NOTETAKER"
  seatIndex Int?
  turn      Int
  content   String
  modelId   String?
  promptHash String?
  tokensIn  Int?
  tokensOut Int?
  latencyMs Int?
  createdAt DateTime @default(now())
}

model FgdPosition {
  id        String @id @default(cuid())
  itemId    String
  item      FgdItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  seatIndex Int
  position  FgdPositionType
  reason    String
  @@unique([itemId, seatIndex])
}

model FgdSuggestion {
  id           String @id @default(cuid())
  itemId       String
  item         FgdItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  seatIndex    Int
  action       ActionType
  quote        String
  rationale    String
  adopted      Boolean?
  notAdoptedReason String?   // wajib bila adopted = false (Tabel 3.5)
}

model FgdDecisionRecord {
  id        String @id @default(cuid())
  itemId    String @unique
  item      FgdItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  decision  FgdDecisionType
  tally     Json      // { TERIMA: n, TERIMA_DENGAN_REVISI: n, TOLAK: n }
  ruleFired String    // "GE4_NON_TERIMA" | "GE2_TOLAK" | "SPLIT_3_3" | ...
  note      String?
  createdAt DateTime @default(now())
}

// ───────────────────── DELPHI / CVI ─────────────────────────

model DelphiRound {
  id          String @id @default(cuid())
  versionId   String
  version     ArtifactVersion @relation(fields: [versionId], references: [id])
  configId    String
  config      PanelConfig @relation(fields: [configId], references: [id])
  dataOrigin  DataOrigin @default(SIMULATED)
  roundNumber Int        // 1..3
  status      RunStatus  @default(QUEUED)
  panelSize   Int        // penyebut aktual — selalu ditampilkan bersama I-CVI
  ratings     DelphiRating[]
  results     DelphiItemResult[]
  scaleSCviAve Float?
  @@unique([versionId, roundNumber])
}

model DelphiRating {
  id           String @id @default(cuid())
  roundId      String
  round        DelphiRound @relation(fields: [roundId], references: [id], onDelete: Cascade)
  indicatorId  String
  indicator    Indicator @relation(fields: [indicatorId], references: [id])
  seatIndex    Int
  relevance    Int?      // 1..4 — null = tidak menilai, TIDAK diimputasi
  clarityFlag  Boolean   @default(false)
  clarityNote  String?
  dataOrigin   DataOrigin @default(SIMULATED)
  @@unique([roundId, indicatorId, seatIndex])
}

model DelphiItemResult {
  id          String @id @default(cuid())
  roundId     String
  round       DelphiRound @relation(fields: [roundId], references: [id], onDelete: Cascade)
  indicatorId String
  iCvi        Float
  median      Float
  iqr         Float
  validRaters Int       // penyebut aktual
  decision    DelphiDecision
  reason      String?
  @@unique([roundId, indicatorId])
}

// ──────────────────────── AHP ───────────────────────────────

model AhpSession {
  id           String @id @default(cuid())
  versionId    String
  version      ArtifactVersion @relation(fields: [versionId], references: [id])
  configId     String
  config       PanelConfig @relation(fields: [configId], references: [id])
  dataOrigin   DataOrigin @default(SIMULATED)
  scope        String     // "DOMAIN" | "ASPECT" | "BOTH"
  status       RunStatus  @default(QUEUED)
  aggregation  String     @default("GEOMETRIC_MEAN")
  matrices     AhpMatrix[]
  weights      AhpWeight[]
  sensitivity  SensitivityScenario[]
}

model AhpMatrix {
  id         String @id @default(cuid())
  sessionId  String
  session    AhpSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  seatIndex  Int
  level      String     // "DOMAIN" | "ASPECT"
  parentCode String?    // kode domain bila level = ASPECT
  size       Int
  cells      Json       // number[][] upper triangle + resiprokal
  lambdaMax  Float?
  ci         Float?
  cr         Float?
  accepted   Boolean @default(false)   // false bila CR >= 0.10 → dikembalikan ke kursi
  revisionOf String?
  @@unique([sessionId, seatIndex, level, parentCode])
}

model AhpWeight {
  id         String @id @default(cuid())
  sessionId  String
  session    AhpSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  level      String
  parentCode String?
  targetCode String     // D1 / A01
  seatIndex  Int?       // null = bobot agregat panel
  weight     Float
  @@index([sessionId, level, parentCode])
}

model SensitivityScenario {
  id         String @id @default(cuid())
  sessionId  String
  session    AhpSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name       String
  mutation   Json       // { targetCode, delta } atau { dropIndicator }
  result     Json       // perubahan skor, urutan domain, kategori
  rankChanged Boolean
}

// ─────────────────────── SCORING ────────────────────────────

model Assessment {
  id           String @id @default(cuid())
  versionId    String
  institutionLabel String            // disamarkan, mis. "PT-A"
  dataOrigin   DataOrigin @default(SIMULATED)
  assessorRef  String                // kode asesor / kursi
  status       RunStatus @default(QUEUED)
  scores       IndicatorScore[]
  rollup       Json?                 // skor aspek, domain, komposit
  createdAt    DateTime @default(now())
}

model IndicatorScore {
  id             String @id @default(cuid())
  assessmentId   String
  assessment     Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  indicatorId    String
  indicator      Indicator  @relation(fields: [indicatorId], references: [id])
  level          Int?       // 1..5, null bila missing
  missingKind    MissingKind @default(NONE)
  evidenceLocator String?
  rationale      String?
  @@unique([assessmentId, indicatorId])
}

// ──────────────── FORM BUILDER & RESPONS ────────────────────

model Form {
  id          String @id @default(cuid())
  slug        String @unique
  title       String
  purpose     String
  instructions String?
  versionLabel String              // "FRM-DELPHI-R1-v1.2"
  status      FormStatus @default(HOLD)
  stageTag    Stage?
  sections    FormSection[]
  responses   FormResponse[]
  createdAt   DateTime @default(now())
}

model FormSection {
  id        String @id @default(cuid())
  formId    String
  form      Form @relation(fields: [formId], references: [id], onDelete: Cascade)
  order     Int
  title     String
  description String?
  nextRule  Json?       // percabangan
  fields    FormField[]
}

model FormField {
  id         String @id @default(cuid())
  sectionId  String
  section    FormSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  order      Int
  key        String      // stabil, dipakai sebagai header ekspor
  type       String      // SHORT_TEXT PARAGRAPH SINGLE MULTI DROPDOWN LINEAR
                         // RELEVANCE_4 PAIRWISE_SAATY FILE DATE INFO
  label      String
  helpText   String?
  required   Boolean @default(false)
  options    Json?
  config     Json?       // mis. { indicatorCode: "C12" } atau { pair: ["D1","D3"] }
  branching  Json?
  @@unique([sectionId, key])
}

model FormResponse {
  id          String @id @default(cuid())
  formId      String
  form        Form @relation(fields: [formId], references: [id], onDelete: Cascade)
  dataOrigin  DataOrigin @default(SIMULATED)
  respondentRef String?   // kode panelis, bukan identitas
  submittedAt DateTime?
  completed   Boolean @default(false)
  answers     Json
  meta        Json?       // durasi, user agent, jumlah revisi
}

// ────────────────── RUN & AUDIT & AKUN ──────────────────────

model PipelineRun {
  id          String @id @default(cuid())
  name        String
  versionId   String
  configId    String
  mode        RunMode   @default(STEP)
  status      RunStatus @default(QUEUED)
  stagesPlan  Json
  budgetUsd   Decimal?  @db.Decimal(10,4)
  spentUsd    Decimal   @default(0) @db.Decimal(10,4)
  startedAt   DateTime?
  endedAt     DateTime?
  steps       RunStep[]
}

model RunStep {
  id        String @id @default(cuid())
  runId     String
  run       PipelineRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  order     Int
  stage     Stage
  label     String
  status    RunStatus @default(QUEUED)
  gateChecked String?
  error     String?
  tokensIn  Int @default(0)
  tokensOut Int @default(0)
  costUsd   Decimal @default(0) @db.Decimal(10,4)
  startedAt DateTime?
  endedAt   DateTime?
}

model AuditEvent {
  id         String   @id @default(cuid())
  actorId    String?
  actorKind  String   // USER | AGENT | SYSTEM
  action     String
  targetType String?
  targetId   String?
  payload    Json?
  createdAt  DateTime @default(now())
  @@index([targetType, targetId])
  @@index([createdAt])
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String?
  role         Role      @default(PAKAR)   // least privilege; Admin menetapkan peran
  passwordHash String?                    // scrypt; null = hanya login Google
  image        String?
  active       Boolean   @default(true)
  lastLoginAt  DateTime?
  panelCode    String?   @unique          // kode pakar (P01…) yang diikat Admin; respons hanya menyimpan kode
  createdAt    DateTime  @default(now())
}

/// Pemetaan kode panelis ke identitas. Akses hanya ADMIN (R1-V1.7 §3.13.2).
model PanelistIdentity {
  id         String @id @default(cuid())
  panelCode  String @unique
  fullName   String
  email      String?
  institution String?
  note       String?
}
```

---

## Catatan indeks dan integritas

- `@@unique([versionId, code])` pada Domain/Aspect/Indicator mencegah duplikasi kode dalam satu versi.
- `DelphiRating.relevance` sengaja nullable. **Jangan** memberi nilai default. Null berarti tidak menilai dan harus mengurangi penyebut, bukan menurunkan skor (§3.8.3).
- `AhpMatrix.accepted` default `false`. Matriks hanya masuk agregasi setelah `cr < 0.10`.
- Setiap tabel yang memuat penilaian memiliki `dataOrigin`. Tambahkan pada tabel baru apa pun tanpa kecuali.
- `FgdSuggestion.notAdoptedReason` divalidasi di aplikasi: wajib terisi bila `adopted = false`.

---

## Seed

`prisma/seed.ts` memuat baseline **DCGMI-A1.0**: 8 domain, 15 aspek, 43 indikator dengan distribusi `7–5–6–6–4–5–4–6`, kode `C01`–`C42` ditambah `C20b`, plus penanda `isControlledException` pada `C20b` dan `C42`.

Seed **tidak** mengisi rubrik lengkap secara otomatis kecuali sumbernya tersedia; indikator tanpa rubrik ditandai sehingga `G1_BASELINE` gagal sampai dilengkapi. Ini disengaja — gate harus punya gigi.
