-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT,
    "jamTrackId" TEXT,
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSeconds" REAL NOT NULL,
    "playbackSpeed" INTEGER NOT NULL DEFAULT 100,
    "completedSession" BOOLEAN NOT NULL DEFAULT false,
    "trackTitle" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeSession_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeSession_jamTrackId_fkey" FOREIGN KEY ("jamTrackId") REFERENCES "JamTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PracticeSession_trackId_idx" ON "PracticeSession"("trackId");

-- CreateIndex
CREATE INDEX "PracticeSession_jamTrackId_idx" ON "PracticeSession"("jamTrackId");

-- CreateIndex
CREATE INDEX "PracticeSession_startTime_idx" ON "PracticeSession"("startTime");
