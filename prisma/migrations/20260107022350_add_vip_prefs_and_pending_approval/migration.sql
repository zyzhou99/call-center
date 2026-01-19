/*
  Warnings:

  - You are about to drop the column `notes` on the `VipGuest` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "PendingApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vipNumber" TEXT NOT NULL,
    "vipGuestId" TEXT,
    "inputPreferredName" TEXT,
    "inputBirthdayMd" TEXT,
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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "msgId" TEXT NOT NULL,
    "openKfid" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "origin" TEXT,
    "msgType" TEXT NOT NULL,
    "sendTime" DATETIME NOT NULL,
    "payload" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "text" TEXT,
    "hasSensitive" BOOLEAN NOT NULL DEFAULT false,
    "sensitiveHits" TEXT,
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("createdAt", "direction", "externalUserId", "id", "msgId", "msgType", "openKfid", "origin", "payload", "sendTime", "sessionId", "text") SELECT "createdAt", "direction", "externalUserId", "id", "msgId", "msgType", "openKfid", "origin", "payload", "sendTime", "sessionId", "text" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE UNIQUE INDEX "Message_msgId_key" ON "Message"("msgId");
CREATE INDEX "Message_openKfid_externalUserId_sendTime_idx" ON "Message"("openKfid", "externalUserId", "sendTime");
CREATE TABLE "new_VipGuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vipNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "preferredName" TEXT,
    "birthdayMd" TEXT,
    "prefStay" TEXT,
    "prefDining" TEXT,
    "prefTransport" TEXT,
    "prefCulturePrivacy" TEXT,
    "prefOther" TEXT,
    "tier" TEXT,
    "room" TEXT,
    "checkInDate" DATETIME,
    "checkOutDate" DATETIME,
    "segment" TEXT,
    "statusLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VipGuest" ("checkInDate", "checkOutDate", "createdAt", "fullName", "id", "preferredName", "room", "segment", "statusLabel", "tier", "updatedAt", "vipNumber") SELECT "checkInDate", "checkOutDate", "createdAt", "fullName", "id", "preferredName", "room", "segment", "statusLabel", "tier", "updatedAt", "vipNumber" FROM "VipGuest";
DROP TABLE "VipGuest";
ALTER TABLE "new_VipGuest" RENAME TO "VipGuest";
CREATE UNIQUE INDEX "VipGuest_vipNumber_key" ON "VipGuest"("vipNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PendingApproval_status_createdAt_idx" ON "PendingApproval"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PendingApproval_vipNumber_idx" ON "PendingApproval"("vipNumber");
