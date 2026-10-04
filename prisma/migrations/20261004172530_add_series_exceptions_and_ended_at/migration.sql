-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "endedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TaskOccurrence" ADD COLUMN     "isException" BOOLEAN NOT NULL DEFAULT false;

-- sprint-19-tasks.md S19-01 — tasks deactivated before this sprint get an
-- end date, so they show up under Tasks → Ended. updatedAt is the closest
-- thing to it they have.
UPDATE "Task" SET "endedAt" = "updatedAt" WHERE "active" = false;
