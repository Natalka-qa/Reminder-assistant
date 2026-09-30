-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultReminderMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;
