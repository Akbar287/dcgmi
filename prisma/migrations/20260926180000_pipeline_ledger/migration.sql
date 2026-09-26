-- AlterTable
ALTER TABLE "AhpSession" ADD COLUMN     "budgetUsd" DECIMAL(10,4),
ADD COLUMN     "runId" TEXT;

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "budgetUsd" DECIMAL(10,4),
ADD COLUMN     "runId" TEXT;

-- AlterTable
ALTER TABLE "DelphiRound" ADD COLUMN     "budgetUsd" DECIMAL(10,4),
ADD COLUMN     "runId" TEXT;

-- AlterTable
ALTER TABLE "FgdSession" ADD COLUMN     "budgetUsd" DECIMAL(10,4),
ADD COLUMN     "runId" TEXT;

-- AlterTable
ALTER TABLE "PipelineRun" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "waitReason" TEXT;

-- AlterTable
ALTER TABLE "RunStep" ADD COLUMN     "detail" JSONB,
ADD COLUMN     "refId" TEXT,
ADD COLUMN     "refType" TEXT,
ADD COLUMN     "versionId" TEXT,
ADD COLUMN     "waitReason" TEXT;

-- CreateTable
CREATE TABLE "ModelCall" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "runId" TEXT,
    "versionId" TEXT,
    "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'SIMULATED',
    "modelId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "latencyMs" INTEGER,
    "costUsd" DECIMAL(12,6),
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,

    CONSTRAINT "ModelCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ModelCall_refType_refId_idx" ON "ModelCall"("refType", "refId");

-- CreateIndex
CREATE INDEX "ModelCall_runId_idx" ON "ModelCall"("runId");

-- CreateIndex
CREATE INDEX "ModelCall_createdAt_idx" ON "ModelCall"("createdAt");

