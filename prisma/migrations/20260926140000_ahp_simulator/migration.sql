-- DropIndex
DROP INDEX "AhpMatrix_sessionId_seatIndex_level_parentCode_key";

-- AlterTable
ALTER TABLE "AhpMatrix" ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "elements" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "error" TEXT,
ADD COLUMN     "pairs" JSONB,
ADD COLUMN     "returnedPairs" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "tokensIn" INTEGER,
ADD COLUMN     "tokensOut" INTEGER,
ALTER COLUMN "cells" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AhpSession" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "error" TEXT,
ADD COLUMN     "seed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "AhpMatrix_sessionId_seatIndex_level_parentCode_attempt_key" ON "AhpMatrix"("sessionId", "seatIndex", "level", "parentCode", "attempt");

