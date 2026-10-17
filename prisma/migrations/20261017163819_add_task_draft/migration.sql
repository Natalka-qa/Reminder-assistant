-- CreateTable
CREATE TABLE "TaskDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT,
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "options" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskDraft_userId_idx" ON "TaskDraft"("userId");

-- CreateIndex
CREATE INDEX "TaskDraft_createdAt_idx" ON "TaskDraft"("createdAt");

-- AddForeignKey
ALTER TABLE "TaskDraft" ADD CONSTRAINT "TaskDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

