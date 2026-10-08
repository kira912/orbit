-- CreateEnum
CREATE TYPE "MapReportKind" AS ENUM ('danger', 'accident', 'traffic', 'roadwork', 'closed', 'other');

-- CreateTable
CREATE TABLE "MapReport" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "MapReportKind" NOT NULL,
    "note" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "lastConfirmedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "MapReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MapReport_circleId_expiresAt_idx" ON "MapReport"("circleId", "expiresAt");

-- AddForeignKey
ALTER TABLE "MapReport" ADD CONSTRAINT "MapReport_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapReport" ADD CONSTRAINT "MapReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

