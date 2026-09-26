-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "sourceSha256" TEXT;

-- AlterTable
ALTER TABLE "FormResponse" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "panelCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FormResponse_formId_respondentRef_key" ON "FormResponse"("formId", "respondentRef");

-- CreateIndex
CREATE UNIQUE INDEX "User_panelCode_key" ON "User"("panelCode");

