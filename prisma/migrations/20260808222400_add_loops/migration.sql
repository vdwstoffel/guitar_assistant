-- CreateTable
CREATE TABLE "Loop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startTime" REAL NOT NULL,
    "endTime" REAL NOT NULL,
    "trackId" TEXT NOT NULL,
    CONSTRAINT "Loop_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JamTrackLoop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startTime" REAL NOT NULL,
    "endTime" REAL NOT NULL,
    "jamTrackId" TEXT NOT NULL,
    CONSTRAINT "JamTrackLoop_jamTrackId_fkey" FOREIGN KEY ("jamTrackId") REFERENCES "JamTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Loop_trackId_idx" ON "Loop"("trackId");

-- CreateIndex
CREATE INDEX "JamTrackLoop_jamTrackId_idx" ON "JamTrackLoop"("jamTrackId");
