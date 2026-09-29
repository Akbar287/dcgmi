-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "pilotRole" TEXT,
ADD COLUMN     "pilotRunId" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'SCORING';

-- CreateTable
CREATE TABLE "PilotRun" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "dataOrigin" "DataOrigin" NOT NULL DEFAULT 'SIMULATED',
    "profileIds" TEXT[],
    "assessorA" TEXT NOT NULL,
    "assessorB" TEXT NOT NULL,
    "seed" INTEGER NOT NULL DEFAULT 0,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotDeclaration" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reference" TEXT,
    "date" TEXT,
    "note" TEXT,
    "declaredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PilotDeclaration_versionId_kind_idx" ON "PilotDeclaration"("versionId", "kind");

