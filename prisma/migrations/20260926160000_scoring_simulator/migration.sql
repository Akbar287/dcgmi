-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "error" TEXT,
ADD COLUMN     "modelProfileId" TEXT,
ADD COLUMN     "profileId" TEXT,
ADD COLUMN     "seed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "weightsSessionId" TEXT;

-- AlterTable
ALTER TABLE "IndicatorScore" ADD COLUMN     "error" TEXT,
ADD COLUMN     "levelCap" INTEGER,
ADD COLUMN     "modelId" TEXT,
ADD COLUMN     "promptHash" TEXT,
ADD COLUMN     "promptId" TEXT,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "satisfiedEvidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tokensIn" INTEGER,
ADD COLUMN     "tokensOut" INTEGER;

-- CreateTable
CREATE TABLE "InstitutionProfile" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecomputeCheck" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "exportSha256" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "diffCount" INTEGER NOT NULL,
    "report" JSONB NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecomputeCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionProfile_label_key" ON "InstitutionProfile"("label");

-- CreateIndex
CREATE INDEX "RecomputeCheck_versionId_createdAt_idx" ON "RecomputeCheck"("versionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InstitutionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

