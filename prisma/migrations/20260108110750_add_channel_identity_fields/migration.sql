/*
  Warnings:

  - You are about to drop the column `prefCulturePrivacy` on the `VipGuest` table. All the data in the column will be lost.
  - You are about to drop the column `prefDining` on the `VipGuest` table. All the data in the column will be lost.
  - You are about to drop the column `prefOther` on the `VipGuest` table. All the data in the column will be lost.
  - You are about to drop the column `prefStay` on the `VipGuest` table. All the data in the column will be lost.
  - You are about to drop the column `prefTransport` on the `VipGuest` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VipGuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vipNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "preferredName" TEXT,
    "birthdayMd" TEXT,
    "preferance" TEXT,
    "restriction" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "profilePhotoUrl" TEXT,
    "tier" TEXT,
    "room" TEXT,
    "checkInDate" DATETIME,
    "checkOutDate" DATETIME,
    "segment" TEXT,
    "statusLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VipGuest" ("birthdayMd", "checkInDate", "checkOutDate", "contactEmail", "contactPhone", "createdAt", "firstName", "fullName", "id", "lastName", "preferredName", "profilePhotoUrl", "room", "segment", "statusLabel", "tier", "updatedAt", "vipNumber") SELECT "birthdayMd", "checkInDate", "checkOutDate", "contactEmail", "contactPhone", "createdAt", "firstName", "fullName", "id", "lastName", "preferredName", "profilePhotoUrl", "room", "segment", "statusLabel", "tier", "updatedAt", "vipNumber" FROM "VipGuest";
DROP TABLE "VipGuest";
ALTER TABLE "new_VipGuest" RENAME TO "VipGuest";
CREATE UNIQUE INDEX "VipGuest_vipNumber_key" ON "VipGuest"("vipNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
