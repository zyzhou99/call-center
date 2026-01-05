-- CreateTable
CREATE TABLE "KfSyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "openKfid" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "cursor" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "VipGuest" (
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
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
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

-- CreateTable
CREATE TABLE "Message" (
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
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "vipGuestId" TEXT NOT NULL,
    "vipNumber" TEXT NOT NULL,
    "preferredName" TEXT,
    "birthday" DATETIME,
    "platform" TEXT,
    "userAgent" TEXT,
    "browserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "contactIdentifier" TEXT,
    "conversationId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingApproval_vipGuestId_fkey" FOREIGN KEY ("vipGuestId") REFERENCES "VipGuest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "KfSyncState_openKfid_key" ON "KfSyncState"("openKfid");

-- CreateIndex
CREATE UNIQUE INDEX "VipGuest_vipNumber_key" ON "VipGuest"("vipNumber");

-- CreateIndex
CREATE INDEX "Session_openKfid_lastMsgAt_idx" ON "Session"("openKfid", "lastMsgAt");

-- CreateIndex
CREATE INDEX "Session_vipNumber_idx" ON "Session"("vipNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Session_openKfid_externalUserId_key" ON "Session"("openKfid", "externalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_msgId_key" ON "Message"("msgId");

-- CreateIndex
CREATE INDEX "Message_openKfid_externalUserId_sendTime_idx" ON "Message"("openKfid", "externalUserId", "sendTime");

-- CreateIndex
CREATE INDEX "PendingApproval_vipNumber_status_idx" ON "PendingApproval"("vipNumber", "status");

-- CreateIndex
CREATE INDEX "PendingApproval_mode_status_idx" ON "PendingApproval"("mode", "status");
