/*
  Warnings:

  - Added the required column `direction` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "VipGuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vipNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "preferredName" TEXT,
    "tier" TEXT,
    "room" TEXT,
    "checkInDate" DATETIME,
    "checkOutDate" DATETIME,
    "segment" TEXT,
    "statusLabel" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
    "payload" JSONB NOT NULL,
    "direction" TEXT NOT NULL,
    "text" TEXT,
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("createdAt", "externalUserId", "id", "msgId", "msgType", "openKfid", "origin", "payload", "sendTime", "sessionId") SELECT "createdAt", "externalUserId", "id", "msgId", "msgType", "openKfid", "origin", "payload", "sendTime", "sessionId" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE UNIQUE INDEX "Message_msgId_key" ON "Message"("msgId");
CREATE INDEX "Message_openKfid_externalUserId_sendTime_idx" ON "Message"("openKfid", "externalUserId", "sendTime");
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "openKfid" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'wechat',
    "lastMsgAt" DATETIME,
    "lastMsgPreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "vipNumber" TEXT,
    "vipGuestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_vipGuestId_fkey" FOREIGN KEY ("vipGuestId") REFERENCES "VipGuest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("createdAt", "externalUserId", "id", "lastMsgAt", "lastMsgPreview", "openKfid", "unreadCount", "updatedAt") SELECT "createdAt", "externalUserId", "id", "lastMsgAt", "lastMsgPreview", "openKfid", "unreadCount", "updatedAt" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE INDEX "Session_openKfid_lastMsgAt_idx" ON "Session"("openKfid", "lastMsgAt");
CREATE INDEX "Session_vipNumber_idx" ON "Session"("vipNumber");
CREATE UNIQUE INDEX "Session_openKfid_externalUserId_key" ON "Session"("openKfid", "externalUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "VipGuest_vipNumber_key" ON "VipGuest"("vipNumber");
