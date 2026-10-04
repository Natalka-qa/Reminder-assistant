-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('NONE', 'OFFSET', 'MORNING_OF', 'EVENING_BEFORE');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "hasTime" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminderKind" "ReminderKind" NOT NULL DEFAULT 'OFFSET';
