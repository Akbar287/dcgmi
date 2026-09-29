-- CreateTable
CREATE TABLE "ReportJob" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "modelId" TEXT NOT NULL,
    "chapters" JSONB NOT NULL,
    "pdf" BYTEA,
    "pdfSha256" TEXT,
    "pages" INTEGER,
    "error" TEXT,
    "budgetUsd" DECIMAL(10,4),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReportJob_pkey" PRIMARY KEY ("id")
);

