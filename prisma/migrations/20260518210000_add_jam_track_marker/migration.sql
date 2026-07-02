-- CreateTable
CREATE TABLE "JamTrackMarker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "timestamp" REAL NOT NULL,
    "jamTrackId" TEXT NOT NULL,
    CONSTRAINT "JamTrackMarker_jamTrackId_fkey" FOREIGN KEY ("jamTrackId") REFERENCES "JamTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "JamTrackMarker_jamTrackId_idx" ON "JamTrackMarker"("jamTrackId");
