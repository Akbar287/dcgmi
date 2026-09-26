-- CreateEnum
CREATE TYPE "DataOrigin" AS ENUM ('SIMULATED', 'REAL');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('BASELINE', 'FGD', 'DELPHI_CVI', 'CONTENT_LOCK', 'AHP', 'SCORING', 'PILOT');

-- CreateEnum
CREATE TYPE "GateStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'REOPENED');

-- CreateEnum
CREATE TYPE "ArtifactStatus" AS ENUM ('DRAFT', 'PROVISIONAL', 'CONTENT_LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PersonaBriefStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ExpertField" AS ENUM ('IT_GOVERNANCE', 'MANAJEMEN_PT', 'SPBE', 'SUSTAINABILITY');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('NORMATIF', 'IMPLEMENTASI', 'OPERASIONAL', 'HASIL', 'PERBAIKAN');

-- CreateEnum
CREATE TYPE "FgdPositionType" AS ENUM ('TERIMA', 'TERIMA_DENGAN_REVISI', 'TOLAK');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('TAMBAH', 'HAPUS', 'GABUNG', 'PECAH', 'PINDAH', 'RUMUS_ULANG');

-- CreateEnum
CREATE TYPE "FgdDecisionType" AS ENUM ('REVISI', 'PEMBAHASAN_KHUSUS', 'TIDAK_SEPAKAT', 'PERTAHANKAN_SEMENTARA', 'TERIMA');

-- CreateEnum
CREATE TYPE "DelphiDecision" AS ENUM ('PERTAHANKAN', 'REVISI_NILAI_ULANG', 'HAPUS_DARI_INTI', 'BARU', 'TIDAK_SELESAI');

-- CreateEnum
CREATE TYPE "MissingKind" AS ENUM ('NONE', 'TIDAK_ADA_KAPABILITAS', 'MISSING_ADMINISTRATIF');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'DRY_RUN', 'HOLD', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "RunMode" AS ENUM ('STEP', 'AUTO');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "ArtifactVersion" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "ArtifactStatus" NOT NULL DEFAULT 'DRAFT',
    "parentId" TEXT,
    "note" TEXT,
    "contentLockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtifactVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rationale" TEXT,
    "sdgTags" TEXT[],
    "slrStrings" TEXT[],

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aspect" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rationale" TEXT,

    CONSTRAINT "Aspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" TEXT NOT NULL,
    "aspectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "operationalDefinition" TEXT,
    "assessmentObject" TEXT,
    "boundaryNote" TEXT,
    "sources" TEXT[],
    "isControlledException" BOOLEAN NOT NULL DEFAULT false,
    "exceptionNote" TEXT,

    CONSTRAINT "Indicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricLevel" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "descriptor" TEXT NOT NULL,
    "cumulative" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RubricLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRequirement" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "minimumFor" INTEGER,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,

    CONSTRAINT "EvidenceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeLogEntry" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetCode" TEXT NOT NULL,
    "action" "ActionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "decisionSource" TEXT NOT NULL,
    "impactNote" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateRecord" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "status" "GateStatus" NOT NULL DEFAULT 'PENDING',
    "unmet" TEXT[],
    "warnings" TEXT[],
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "GateRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expert" (
    "id" TEXT NOT NULL,
    "panelCode" TEXT NOT NULL,
    "displayName" TEXT,
    "field" "ExpertField" NOT NULL,
    "affiliation" TEXT,
    "coiDeclared" BOOLEAN NOT NULL DEFAULT false,
    "coiNote" TEXT,
    "inFgd" BOOLEAN NOT NULL DEFAULT false,
    "inDelphi" BOOLEAN NOT NULL DEFAULT false,
    "inAhp" BOOLEAN NOT NULL DEFAULT false,
    "cvFileKey" TEXT,

    CONSTRAINT "Expert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonaBrief" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "expertiseAreas" TEXT[],
    "yearsExperience" INTEGER,
    "institutionType" TEXT,
    "researchFocus" TEXT[],
    "methodStance" TEXT,
    "vocabularyHints" TEXT[],
    "emphasisBias" TEXT,
    "deidFindings" JSONB,
    "status" "PersonaBriefStatus" NOT NULL DEFAULT 'DRAFT',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "systemPrompt" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,

    CONSTRAINT "PersonaBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "baseUrl" TEXT,
    "envKeyName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelProfile" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "contextWindow" INTEGER,
    "inputCostPer1k" DECIMAL(10,6),
    "outputCostPer1k" DECIMAL(10,6),

    CONSTRAINT "ModelProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "panelSize" INTEGER NOT NULL,
    "facilitatorModelId" TEXT,
    "notetakerModelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PanelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelSeat" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "expertId" TEXT,
    "modelProfileId" TEXT NOT NULL,
    "field" "ExpertField" NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "seed" INTEGER,
    "isNewMember" BOOLEAN NOT NULL DEFAULT false,
    "contextScope" TEXT NOT NULL DEFAULT 'FULL',

    CONSTRAINT "PanelSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FgdSession" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'SIMULATED',
    "mode" "RunMode" NOT NULL DEFAULT 'STEP',
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "agendaPreset" TEXT NOT NULL DEFAULT 'CORONG_11',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "FgdSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FgdStage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',

    CONSTRAINT "FgdStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FgdItem" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetCode" TEXT NOT NULL,

    CONSTRAINT "FgdItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FgdUtterance" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "seatIndex" INTEGER,
    "turn" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "modelId" TEXT,
    "promptHash" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FgdUtterance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FgdPosition" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "position" "FgdPositionType" NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "FgdPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FgdSuggestion" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "action" "ActionType" NOT NULL,
    "quote" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "adopted" BOOLEAN,
    "notAdoptedReason" TEXT,

    CONSTRAINT "FgdSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FgdDecisionRecord" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "decision" "FgdDecisionType" NOT NULL,
    "tally" JSONB NOT NULL,
    "ruleFired" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FgdDecisionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelphiRound" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'SIMULATED',
    "roundNumber" INTEGER NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "panelSize" INTEGER NOT NULL,
    "scaleSCviAve" DOUBLE PRECISION,

    CONSTRAINT "DelphiRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelphiRating" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "relevance" INTEGER,
    "clarityFlag" BOOLEAN NOT NULL DEFAULT false,
    "clarityNote" TEXT,
    "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'SIMULATED',

    CONSTRAINT "DelphiRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelphiItemResult" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "iCvi" DOUBLE PRECISION NOT NULL,
    "median" DOUBLE PRECISION NOT NULL,
    "iqr" DOUBLE PRECISION NOT NULL,
    "validRaters" INTEGER NOT NULL,
    "decision" "DelphiDecision" NOT NULL,
    "reason" TEXT,

    CONSTRAINT "DelphiItemResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AhpSession" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'SIMULATED',
    "scope" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "aggregation" TEXT NOT NULL DEFAULT 'GEOMETRIC_MEAN',

    CONSTRAINT "AhpSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AhpMatrix" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "parentCode" TEXT,
    "size" INTEGER NOT NULL,
    "cells" JSONB NOT NULL,
    "lambdaMax" DOUBLE PRECISION,
    "ci" DOUBLE PRECISION,
    "cr" DOUBLE PRECISION,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "revisionOf" TEXT,

    CONSTRAINT "AhpMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AhpWeight" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "parentCode" TEXT,
    "targetCode" TEXT NOT NULL,
    "seatIndex" INTEGER,
    "weight" DOUBLE PRECISION NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AhpWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensitivityScenario" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mutation" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "rankChanged" BOOLEAN NOT NULL,

    CONSTRAINT "SensitivityScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "institutionLabel" TEXT NOT NULL,
    "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'SIMULATED',
    "assessorRef" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "rollup" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorScore" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "level" INTEGER,
    "missingKind" "MissingKind" NOT NULL DEFAULT 'NONE',
    "evidenceLocator" TEXT,
    "rationale" TEXT,

    CONSTRAINT "IndicatorScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "instructions" TEXT,
    "versionLabel" TEXT NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'HOLD',
    "stageTag" "Stage",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSection" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "nextRule" JSONB,

    CONSTRAINT "FormSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "config" JSONB,
    "branching" JSONB,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormResponse" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'SIMULATED',
    "respondentRef" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "answers" JSONB NOT NULL,
    "meta" JSONB,

    CONSTRAINT "FormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "mode" "RunMode" NOT NULL DEFAULT 'STEP',
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "stagesPlan" JSONB NOT NULL,
    "budgetUsd" DECIMAL(10,4),
    "spentUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "stage" "Stage" NOT NULL,
    "label" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "gateChecked" TEXT,
    "error" TEXT,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "RunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorKind" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelistIdentity" (
    "id" TEXT NOT NULL,
    "panelCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "institution" TEXT,
    "note" TEXT,

    CONSTRAINT "PanelistIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArtifactVersion_label_key" ON "ArtifactVersion"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_versionId_code_key" ON "Domain"("versionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Aspect_domainId_code_key" ON "Aspect"("domainId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Indicator_aspectId_code_key" ON "Indicator"("aspectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RubricLevel_indicatorId_level_key" ON "RubricLevel"("indicatorId", "level");

-- CreateIndex
CREATE INDEX "ChangeLogEntry_versionId_targetCode_idx" ON "ChangeLogEntry"("versionId", "targetCode");

-- CreateIndex
CREATE UNIQUE INDEX "GateRecord_versionId_gate_key" ON "GateRecord"("versionId", "gate");

-- CreateIndex
CREATE UNIQUE INDEX "Expert_panelCode_key" ON "Expert"("panelCode");

-- CreateIndex
CREATE UNIQUE INDEX "PersonaBrief_expertId_key" ON "PersonaBrief"("expertId");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_key_key" ON "Provider"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ModelProfile_providerId_modelId_key" ON "ModelProfile"("providerId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "PanelSeat_configId_seatIndex_key" ON "PanelSeat"("configId", "seatIndex");

-- CreateIndex
CREATE UNIQUE INDEX "FgdPosition_itemId_seatIndex_key" ON "FgdPosition"("itemId", "seatIndex");

-- CreateIndex
CREATE UNIQUE INDEX "FgdDecisionRecord_itemId_key" ON "FgdDecisionRecord"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "DelphiRound_versionId_roundNumber_key" ON "DelphiRound"("versionId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DelphiRating_roundId_indicatorId_seatIndex_key" ON "DelphiRating"("roundId", "indicatorId", "seatIndex");

-- CreateIndex
CREATE UNIQUE INDEX "DelphiItemResult_roundId_indicatorId_key" ON "DelphiItemResult"("roundId", "indicatorId");

-- CreateIndex
CREATE UNIQUE INDEX "AhpMatrix_sessionId_seatIndex_level_parentCode_key" ON "AhpMatrix"("sessionId", "seatIndex", "level", "parentCode");

-- CreateIndex
CREATE INDEX "AhpWeight_sessionId_level_parentCode_idx" ON "AhpWeight"("sessionId", "level", "parentCode");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorScore_assessmentId_indicatorId_key" ON "IndicatorScore"("assessmentId", "indicatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Form_slug_key" ON "Form"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FormField_sectionId_key_key" ON "FormField"("sectionId", "key");

-- CreateIndex
CREATE INDEX "AuditEvent_targetType_targetId_idx" ON "AuditEvent"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PanelistIdentity_panelCode_key" ON "PanelistIdentity"("panelCode");

-- AddForeignKey
ALTER TABLE "ArtifactVersion" ADD CONSTRAINT "ArtifactVersion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ArtifactVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ArtifactVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aspect" ADD CONSTRAINT "Aspect_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_aspectId_fkey" FOREIGN KEY ("aspectId") REFERENCES "Aspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricLevel" ADD CONSTRAINT "RubricLevel_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequirement" ADD CONSTRAINT "EvidenceRequirement_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLogEntry" ADD CONSTRAINT "ChangeLogEntry_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ArtifactVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateRecord" ADD CONSTRAINT "GateRecord_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ArtifactVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonaBrief" ADD CONSTRAINT "PersonaBrief_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelProfile" ADD CONSTRAINT "ModelProfile_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelSeat" ADD CONSTRAINT "PanelSeat_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PanelConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelSeat" ADD CONSTRAINT "PanelSeat_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelSeat" ADD CONSTRAINT "PanelSeat_modelProfileId_fkey" FOREIGN KEY ("modelProfileId") REFERENCES "ModelProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FgdSession" ADD CONSTRAINT "FgdSession_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ArtifactVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FgdSession" ADD CONSTRAINT "FgdSession_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PanelConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FgdStage" ADD CONSTRAINT "FgdStage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FgdSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FgdItem" ADD CONSTRAINT "FgdItem_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "FgdStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FgdUtterance" ADD CONSTRAINT "FgdUtterance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FgdItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FgdPosition" ADD CONSTRAINT "FgdPosition_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FgdItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FgdSuggestion" ADD CONSTRAINT "FgdSuggestion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FgdItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FgdDecisionRecord" ADD CONSTRAINT "FgdDecisionRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FgdItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelphiRound" ADD CONSTRAINT "DelphiRound_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ArtifactVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelphiRound" ADD CONSTRAINT "DelphiRound_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PanelConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelphiRating" ADD CONSTRAINT "DelphiRating_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "DelphiRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelphiRating" ADD CONSTRAINT "DelphiRating_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelphiItemResult" ADD CONSTRAINT "DelphiItemResult_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "DelphiRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AhpSession" ADD CONSTRAINT "AhpSession_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ArtifactVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AhpSession" ADD CONSTRAINT "AhpSession_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PanelConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AhpMatrix" ADD CONSTRAINT "AhpMatrix_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AhpSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AhpWeight" ADD CONSTRAINT "AhpWeight_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AhpSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensitivityScenario" ADD CONSTRAINT "SensitivityScenario_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AhpSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorScore" ADD CONSTRAINT "IndicatorScore_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorScore" ADD CONSTRAINT "IndicatorScore_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSection" ADD CONSTRAINT "FormSection_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "FormSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunStep" ADD CONSTRAINT "RunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
