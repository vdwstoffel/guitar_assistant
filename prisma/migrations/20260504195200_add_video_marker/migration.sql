-- CreateTable
CREATE TABLE "VideoMarker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "timestamp" REAL NOT NULL,
    "videoId" TEXT NOT NULL,
    CONSTRAINT "VideoMarker_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VideoMarker_videoId_idx" ON "VideoMarker"("videoId");
