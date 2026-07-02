-- CreateTable
CREATE TABLE "BackingTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "youtubeUrl" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "rootNote" TEXT NOT NULL,
    "scaleType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BackingTrack_youtubeUrl_key" ON "BackingTrack"("youtubeUrl");
