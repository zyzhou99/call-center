-- AlterTable
ALTER TABLE "PendingApproval" ADD COLUMN "inputAvatarUrl" TEXT;
ALTER TABLE "PendingApproval" ADD COLUMN "inputChannelIdentifier" TEXT;
ALTER TABLE "PendingApproval" ADD COLUMN "inputDisplayName" TEXT;
ALTER TABLE "PendingApproval" ADD COLUMN "inputPhoneNumber" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "Session" ADD COLUMN "channelIdentifier" TEXT;
ALTER TABLE "Session" ADD COLUMN "email" TEXT;
ALTER TABLE "Session" ADD COLUMN "phoneNumber" TEXT;
ALTER TABLE "Session" ADD COLUMN "wechatOpenId" TEXT;
ALTER TABLE "Session" ADD COLUMN "wechatUnionId" TEXT;

-- AlterTable
ALTER TABLE "VipGuest" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "VipGuest" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "VipGuest" ADD COLUMN "firstName" TEXT;
ALTER TABLE "VipGuest" ADD COLUMN "lastName" TEXT;
ALTER TABLE "VipGuest" ADD COLUMN "profilePhotoUrl" TEXT;

-- CreateIndex
CREATE INDEX "Session_channelIdentifier_idx" ON "Session"("channelIdentifier");
