-- AlterTable
ALTER TABLE "FgdDecisionRecord" ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedById" TEXT;

-- AlterTable
ALTER TABLE "FgdSuggestion" ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "appliedById" TEXT,
ADD COLUMN     "appliedNote" TEXT;

-- AlterTable
ALTER TABLE "Indicator" ADD COLUMN     "deletedAt" TIMESTAMP(3);

