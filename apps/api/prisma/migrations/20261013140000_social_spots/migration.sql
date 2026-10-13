-- CreateEnum
CREATE TYPE "SpotCategory" AS ENUM ('viewpoint', 'photo', 'secret_place', 'cafe_bar', 'nature', 'culture', 'food', 'activity', 'chill');

-- CreateEnum
CREATE TYPE "SpotVisibility" AS ENUM ('public', 'circle');

-- CreateTable
CREATE TABLE "Spot" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "SpotCategory" NOT NULL DEFAULT 'secret_place',
    "visibility" "SpotVisibility" NOT NULL DEFAULT 'circle',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "circleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotLike" (
    "id" TEXT NOT NULL,
    "spotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpotLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotComment" (
    "id" TEXT NOT NULL,
    "spotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpotComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotSaved" (
    "id" TEXT NOT NULL,
    "spotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpotSaved_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Spot_circleId_visibility_idx" ON "Spot"("circleId", "visibility");
CREATE INDEX "Spot_createdById_idx" ON "Spot"("createdById");
CREATE INDEX "Spot_latitude_longitude_idx" ON "Spot"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "SpotLike_spotId_userId_key" ON "SpotLike"("spotId", "userId");
CREATE INDEX "SpotLike_userId_idx" ON "SpotLike"("userId");

-- CreateIndex
CREATE INDEX "SpotComment_spotId_createdAt_idx" ON "SpotComment"("spotId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpotSaved_spotId_userId_key" ON "SpotSaved"("spotId", "userId");
CREATE INDEX "SpotSaved_userId_idx" ON "SpotSaved"("userId");

-- AddForeignKey
ALTER TABLE "Spot" ADD CONSTRAINT "Spot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Spot" ADD CONSTRAINT "Spot_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotLike" ADD CONSTRAINT "SpotLike_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpotLike" ADD CONSTRAINT "SpotLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotComment" ADD CONSTRAINT "SpotComment_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpotComment" ADD CONSTRAINT "SpotComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotSaved" ADD CONSTRAINT "SpotSaved_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpotSaved" ADD CONSTRAINT "SpotSaved_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
