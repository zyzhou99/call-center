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
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "openKfid" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "lastMsgAt" DATETIME,
    "lastMsgPreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
    "payload" JSONB NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "KfSyncState_openKfid_key" ON "KfSyncState"("openKfid");

-- CreateIndex
CREATE INDEX "Session_openKfid_lastMsgAt_idx" ON "Session"("openKfid", "lastMsgAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_openKfid_externalUserId_key" ON "Session"("openKfid", "externalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_msgId_key" ON "Message"("msgId");

-- CreateIndex
CREATE INDEX "Message_openKfid_externalUserId_sendTime_idx" ON "Message"("openKfid", "externalUserId", "sendTime");
