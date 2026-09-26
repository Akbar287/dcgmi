-- AlterTable
ALTER TABLE "DelphiItemResult" ADD COLUMN     "clarityCritical" BOOLEAN,
ADD COLUMN     "clarityFlags" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "constructConflict" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "researcherNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "DelphiRating" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "latencyMs" INTEGER,
ADD COLUMN     "modelId" TEXT,
ADD COLUMN     "promptHash" TEXT,
ADD COLUMN     "promptId" TEXT,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "tokensIn" INTEGER,
ADD COLUMN     "tokensOut" INTEGER;

-- AlterTable
ALTER TABLE "DelphiRound" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "error" TEXT,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedById" TEXT,
ADD COLUMN     "scopeCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "seed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "startedAt" TIMESTAMP(3);

