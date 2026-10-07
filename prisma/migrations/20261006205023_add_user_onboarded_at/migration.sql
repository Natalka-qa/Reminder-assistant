-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3);

-- Everyone already signed up has been using the app: no first-run setup
-- for them. Only users created from now on start with null.
UPDATE "User" SET "onboardedAt" = now() WHERE "onboardedAt" IS NULL;
