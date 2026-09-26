-- AlterTable
ALTER TABLE "FgdItem" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "error" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "FgdPosition" ADD COLUMN     "proposedAction" "ActionType";

-- AlterTable
ALTER TABLE "FgdSession" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "seed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settings" JSONB;

-- AlterTable
ALTER TABLE "FgdUtterance" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'ARGUE',
ADD COLUMN     "promptId" TEXT,
ADD COLUMN     "promptVersion" TEXT;

