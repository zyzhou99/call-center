/*
  Warnings:

  - You are about to drop the column `inputBirthdayMd` on the `PendingApproval` table. All the data in the column will be lost.
  - You are about to drop the column `prefCulturePrivacy` on the `VipGuest` table. All the data in the column will be lost.
  - You are about to drop the column `prefDining` on the `VipGuest` table. All the data in the column will be lost.
  - You are about to drop the column `prefOther` on the `VipGuest` table. All the data in the column will be lost.
  - You are about to drop the column `prefStay` on the `VipGuest` table. All the data in the column will be lost.
  - You are about to drop the column `prefTransport` on the `VipGuest` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vipNumber" TEXT NOT NULL,
    "vipGuestId" TEXT,
    "inputPreferredName" TEXT,
    "version" TEXT NOT NULL,
    "entryMode" TEXT NOT NULL,
    "scanChannel" TEXT NOT NULL,
    "riskLevel" TEXT,
    "matchHint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "kfUrl" TEXT,
    "sessionId" TEXT,
    "assignedAgentId" TEXT,
    "assignedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingApproval_vipGuestId_fkey" FOREIGN KEY ("vipGuestId") REFERENCES "VipGuest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PendingApproval" ("assignedAgentId", "assignedAt", "createdAt", "entryMode", "id", "inputPreferredName", "kfUrl", "reason", "scanChannel", "sessionId", "status", "updatedAt", "version", "vipGuestId", "vipNumber") SELECT "assignedAgentId", "assignedAt", "createdAt", "entryMode", "id", "inputPreferredName", "kfUrl", "reason", "scanChannel", "sessionId", "status", "updatedAt", "version", "vipGuestId", "vipNumber" FROM "PendingApproval";
DROP TABLE "PendingApproval";
ALTER TABLE "new_PendingApproval" RENAME TO "PendingApproval";
CREATE INDEX "PendingApproval_status_createdAt_idx" ON "PendingApproval"("status", "createdAt");
CREATE INDEX "PendingApproval_vipNumber_idx" ON "PendingApproval"("vipNumber");
CREATE TABLE "new_VipGuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vipNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "preferredName" TEXT,
    "birthdayMd" TEXT,
    "stayPreference" TEXT,
    "stayRestriction" TEXT,
    "diningPreference" TEXT,
    "diningRestriction" TEXT,
    "transportPreference" TEXT,
    "transportRestriction" TEXT,
    "culturePrivacyPreference" TEXT,
    "culturePrivacyRestriction" TEXT,
    "otherPreference" TEXT,
    "otherRestriction" TEXT,
    "tier" TEXT,
    "room" TEXT,
    "checkInDate" DATETIME,
    "checkOutDate" DATETIME,
    "segment" TEXT,
    "statusLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VipGuest" ("birthdayMd", "checkInDate", "checkOutDate", "createdAt", "fullName", "id", "preferredName", "room", "segment", "statusLabel", "tier", "updatedAt", "vipNumber") SELECT "birthdayMd", "checkInDate", "checkOutDate", "createdAt", "fullName", "id", "preferredName", "room", "segment", "statusLabel", "tier", "updatedAt", "vipNumber" FROM "VipGuest";
DROP TABLE "VipGuest";
ALTER TABLE "new_VipGuest" RENAME TO "VipGuest";
CREATE UNIQUE INDEX "VipGuest_vipNumber_key" ON "VipGuest"("vipNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
