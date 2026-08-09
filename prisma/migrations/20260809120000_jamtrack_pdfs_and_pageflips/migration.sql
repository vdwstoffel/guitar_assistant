-- New tables
CREATE TABLE "JamTrackPdf" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "jamTrackId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JamTrackPdf_jamTrackId_fkey" FOREIGN KEY ("jamTrackId") REFERENCES "JamTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "JamTrackPdf_jamTrackId_idx" ON "JamTrackPdf"("jamTrackId");

CREATE TABLE "JamTrackPageFlip" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "timestamp" REAL NOT NULL,
  "pdfPage" INTEGER NOT NULL,
  "jamTrackPdfId" TEXT NOT NULL,
  CONSTRAINT "JamTrackPageFlip_jamTrackPdfId_fkey" FOREIGN KEY ("jamTrackPdfId") REFERENCES "JamTrackPdf" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "JamTrackPageFlip_jamTrackPdfId_idx" ON "JamTrackPageFlip"("jamTrackPdfId");

CREATE TABLE "TrackPageFlip" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "timestamp" REAL NOT NULL,
  "pdfPage" INTEGER NOT NULL,
  "trackId" TEXT NOT NULL,
  CONSTRAINT "TrackPageFlip_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TrackPageFlip_trackId_idx" ON "TrackPageFlip"("trackId");

-- Data migration: existing marker page-flips -> TrackPageFlip
INSERT INTO "TrackPageFlip" ("id", "timestamp", "pdfPage", "trackId")
SELECT lower(
  hex(randomblob(4)) || '-' ||
  hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', 1 + (abs(random()) % 4), 1) ||
  substr(hex(randomblob(2)), 2) || '-' ||
  hex(randomblob(6))
), "timestamp", "pdfPage", "trackId"
FROM "Marker"
WHERE "pdfPage" IS NOT NULL;

-- Drop Marker.pdfPage (table recreate)
CREATE TABLE "new_Marker" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "timestamp" REAL NOT NULL,
  "trackId" TEXT NOT NULL,
  CONSTRAINT "Marker_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Marker" ("id", "name", "timestamp", "trackId")
SELECT "id", "name", "timestamp", "trackId" FROM "Marker";
DROP TABLE "Marker";
ALTER TABLE "new_Marker" RENAME TO "Marker";
CREATE INDEX "Marker_trackId_idx" ON "Marker"("trackId");

-- Drop JamTrack.gpFilePath (table recreate, preserving all other columns)
CREATE TABLE "new_JamTrack" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "duration" REAL NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "inProgress" BOOLEAN NOT NULL DEFAULT false,
  "favorite" BOOLEAN NOT NULL DEFAULT false,
  "lastPlayedAt" DATETIME,
  "completedAt" DATETIME,
  "tempo" INTEGER,
  "timeSignature" TEXT NOT NULL DEFAULT '4/4',
  "playbackSpeed" INTEGER,
  "volume" INTEGER,
  "lufs" REAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_JamTrack" ("id","title","filePath","duration","completed","inProgress","favorite","lastPlayedAt","completedAt","tempo","timeSignature","playbackSpeed","volume","lufs","createdAt")
SELECT "id","title","filePath","duration","completed","inProgress","favorite","lastPlayedAt","completedAt","tempo","timeSignature","playbackSpeed","volume","lufs","createdAt" FROM "JamTrack";
DROP TABLE "JamTrack";
ALTER TABLE "new_JamTrack" RENAME TO "JamTrack";
CREATE UNIQUE INDEX "JamTrack_filePath_key" ON "JamTrack"("filePath");
