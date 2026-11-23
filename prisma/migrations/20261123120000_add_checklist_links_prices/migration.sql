-- AlterTable
ALTER TABLE "Checklist" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR';

-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "url" TEXT;
