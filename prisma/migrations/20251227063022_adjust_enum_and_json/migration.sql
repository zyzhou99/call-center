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
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("createdAt", "direction", "externalUserId", "id", "msgId", "msgType", "openKfid", "origin", "payload", "sendTime", "sessionId", "text") SELECT "createdAt", "direction", "externalUserId", "id", "msgId", "msgType", "openKfid", "origin", "payload", "sendTime", "sessionId", "text" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE UNIQUE INDEX "Message_msgId_key" ON "Message"("msgId");
CREATE INDEX "Message_openKfid_externalUserId_sendTime_idx" ON "Message"("openKfid", "externalUserId", "sendTime");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
