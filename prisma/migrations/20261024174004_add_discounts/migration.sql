-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountReason" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountReason" TEXT;
