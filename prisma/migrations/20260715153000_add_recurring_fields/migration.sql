-- AlterTable: Add recurring transaction fields and baseAmount to Transaction
ALTER TABLE "Transaction" ADD COLUMN "baseAmount" DOUBLE PRECISION;
ALTER TABLE "Transaction" ADD COLUMN "frequency" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "nextRunDate" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "parentRecurringId" TEXT;

-- AlterColumn: Set default for isRecurring
ALTER TABLE "Transaction" ALTER COLUMN "isRecurring" SET DEFAULT false;

-- CreateIndex
CREATE INDEX "Transaction_isRecurring_nextRunDate_idx" ON "Transaction"("isRecurring", "nextRunDate");
