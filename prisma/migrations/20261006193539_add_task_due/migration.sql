-- AlterEnum
ALTER TYPE "ReminderKind" ADD VALUE 'BEFORE_DUE';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "dueMinutes" INTEGER;
