/*
  Warnings:

  - You are about to drop the column `archivedAt` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `archivedAt` on the `ProductVariant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "archivedAt";

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "archivedAt";
