-- CreateEnum
CREATE TYPE "PrintJobKind" AS ENUM ('VENTA', 'PRESUPUESTO');

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" UUID NOT NULL,
    "kind" "PrintJobKind" NOT NULL,
    "saleId" UUID,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedAt" TIMESTAMP(3),

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrintJob_printedAt_createdAt_idx" ON "PrintJob"("printedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
