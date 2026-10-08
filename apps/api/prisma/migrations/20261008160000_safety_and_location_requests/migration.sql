-- CreateEnum
CREATE TYPE "LocationRequestStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- AlterTable
ALTER TABLE "ShareSession" ADD COLUMN     "expectedArrivalAt" TIMESTAMP(3),
ADD COLUMN     "lastOkAt" TIMESTAMP(3),
ADD COLUMN     "lateAlertAt" TIMESTAMP(3),
ADD COLUMN     "safetyAlerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "silentAlertAt" TIMESTAMP(3),
ADD COLUMN     "stalledAlertAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LocationRequest" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" "LocationRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "sessionId" TEXT,

    CONSTRAINT "LocationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocationRequest_toUserId_status_idx" ON "LocationRequest"("toUserId", "status");

-- CreateIndex
CREATE INDEX "LocationRequest_fromUserId_toUserId_status_idx" ON "LocationRequest"("fromUserId", "toUserId", "status");

-- AddForeignKey
ALTER TABLE "LocationRequest" ADD CONSTRAINT "LocationRequest_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationRequest" ADD CONSTRAINT "LocationRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationRequest" ADD CONSTRAINT "LocationRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

