-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JamTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "duration" REAL NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "inProgress" BOOLEAN NOT NULL DEFAULT false,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "tempo" INTEGER,
    "timeSignature" TEXT NOT NULL DEFAULT '4/4',
    "playbackSpeed" INTEGER,
    "volume" INTEGER,
    "lufs" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_JamTrack" ("completed", "createdAt", "duration", "favorite", "filePath", "id", "playbackSpeed", "tempo", "timeSignature", "title", "volume") SELECT "completed", "createdAt", "duration", "favorite", "filePath", "id", "playbackSpeed", "tempo", "timeSignature", "title", "volume" FROM "JamTrack";
DROP TABLE "JamTrack";
ALTER TABLE "new_JamTrack" RENAME TO "JamTrack";
CREATE UNIQUE INDEX "JamTrack_filePath_key" ON "JamTrack"("filePath");
CREATE TABLE "new_PracticeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT,
    "jamTrackId" TEXT,
    "bookVideoId" TEXT,
    "videoId" TEXT,
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSeconds" REAL NOT NULL,
    "playbackSpeed" INTEGER NOT NULL DEFAULT 100,
    "completedSession" BOOLEAN NOT NULL DEFAULT false,
    "trackTitle" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeSession_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeSession_jamTrackId_fkey" FOREIGN KEY ("jamTrackId") REFERENCES "JamTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeSession_bookVideoId_fkey" FOREIGN KEY ("bookVideoId") REFERENCES "BookVideo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeSession_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PracticeSession" ("bookVideoId", "completedSession", "createdAt", "durationSeconds", "id", "jamTrackId", "playbackSpeed", "startTime", "trackId", "trackTitle", "videoId") SELECT "bookVideoId", "completedSession", "createdAt", "durationSeconds", "id", "jamTrackId", "playbackSpeed", "startTime", "trackId", "trackTitle", "videoId" FROM "PracticeSession";
DROP TABLE "PracticeSession";
ALTER TABLE "new_PracticeSession" RENAME TO "PracticeSession";
CREATE INDEX "PracticeSession_trackId_idx" ON "PracticeSession"("trackId");
CREATE INDEX "PracticeSession_jamTrackId_idx" ON "PracticeSession"("jamTrackId");
CREATE INDEX "PracticeSession_bookVideoId_idx" ON "PracticeSession"("bookVideoId");
CREATE INDEX "PracticeSession_videoId_idx" ON "PracticeSession"("videoId");
CREATE INDEX "PracticeSession_startTime_idx" ON "PracticeSession"("startTime");
CREATE TABLE "new_Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "trackNumber" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "duration" REAL NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pdfPage" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "inProgress" BOOLEAN NOT NULL DEFAULT false,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "tempo" INTEGER,
    "timeSignature" TEXT NOT NULL DEFAULT '4/4',
    "playbackSpeed" INTEGER,
    "volume" INTEGER,
    "lufs" REAL,
    CONSTRAINT "Track_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Track_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Track" ("bookId", "chapterId", "completed", "duration", "favorite", "filePath", "id", "pdfPage", "playbackSpeed", "sortOrder", "tempo", "timeSignature", "title", "trackNumber", "volume") SELECT "bookId", "chapterId", "completed", "duration", "favorite", "filePath", "id", "pdfPage", "playbackSpeed", "sortOrder", "tempo", "timeSignature", "title", "trackNumber", "volume" FROM "Track";
DROP TABLE "Track";
ALTER TABLE "new_Track" RENAME TO "Track";
CREATE UNIQUE INDEX "Track_filePath_key" ON "Track"("filePath");
CREATE INDEX "Track_bookId_idx" ON "Track"("bookId");
CREATE INDEX "Track_chapterId_idx" ON "Track"("chapterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
