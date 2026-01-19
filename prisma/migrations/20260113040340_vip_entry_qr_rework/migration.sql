/*
  Warnings:

  - A unique constraint covering the columns `[qrCode]` on the table `VipGuest` will be added. If there are existing duplicate values, this will fail.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vipNumber" TEXT,
    "vipGuestId" TEXT,
    "inputPreferredName" TEXT,
    "inputBirthdayMd" TEXT,
    "inputChannelIdentifier" TEXT,
    "inputDisplayName" TEXT,
    "inputAvatarUrl" TEXT,
    "inputPhoneNumber" TEXT,
    "version" TEXT NOT NULL,
    "entryMode" TEXT NOT NULL,
    "scanChannel" TEXT NOT NULL,
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
INSERT INTO "new_PendingApproval" ("assignedAgentId", "assignedAt", "createdAt", "entryMode", "id", "inputAvatarUrl", "inputBirthdayMd", "inputChannelIdentifier", "inputDisplayName", "inputPhoneNumber", "inputPreferredName", "kfUrl", "reason", "scanChannel", "sessionId", "status", "updatedAt", "version", "vipGuestId", "vipNumber") SELECT "assignedAgentId", "assignedAt", "createdAt", "entryMode", "id", "inputAvatarUrl", "inputBirthdayMd", "inputChannelIdentifier", "inputDisplayName", "inputPhoneNumber", "inputPreferredName", "kfUrl", "reason", "scanChannel", "sessionId", "status", "updatedAt", "version", "vipGuestId", "vipNumber" FROM "PendingApproval";
DROP TABLE "PendingApproval";
ALTER TABLE "new_PendingApproval" RENAME TO "PendingApproval";
CREATE INDEX "PendingApproval_status_createdAt_idx" ON "PendingApproval"("status", "createdAt");
CREATE INDEX "PendingApproval_vipNumber_idx" ON "PendingApproval"("vipNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "VipGuest_qrCode_key" ON "VipGuest"("qrCode");
