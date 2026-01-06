/*
  Warnings:

  - You are about to drop the column `notes` on the `VipGuest` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VipGuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vipNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "preferredName" TEXT,
    "tier" TEXT,
    "birthday" DATETIME,
    "room" TEXT,
    "checkInDate" DATETIME,
    "checkOutDate" DATETIME,
    "segment" TEXT,
    "statusLabel" TEXT,
    "mobilePhone" TEXT,
    "whatsappNumber" TEXT,
    "wechatId" TEXT,
    "wechatOpenId" TEXT,
    "email" TEXT,
    "primaryLanguage" TEXT,
    "preferredChannel" TEXT,
    "stayPreference" TEXT,
    "diningPreference" TEXT,
    "transportPreference" TEXT,
    "culturePrivacyPreference" TEXT,
    "otherPreferences" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VipGuest" ("birthday", "checkInDate", "checkOutDate", "createdAt", "fullName", "id", "preferredName", "room", "segment", "statusLabel", "tier", "updatedAt", "vipNumber") SELECT "birthday", "checkInDate", "checkOutDate", "createdAt", "fullName", "id", "preferredName", "room", "segment", "statusLabel", "tier", "updatedAt", "vipNumber" FROM "VipGuest";
DROP TABLE "VipGuest";
ALTER TABLE "new_VipGuest" RENAME TO "VipGuest";
CREATE UNIQUE INDEX "VipGuest_vipNumber_key" ON "VipGuest"("vipNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
