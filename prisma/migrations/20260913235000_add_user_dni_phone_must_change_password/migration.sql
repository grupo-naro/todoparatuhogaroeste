-- AlterTable
ALTER TABLE "User" ADD COLUMN "dni" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_dni_key" ON "User"("dni");
