-- CreateTable
CREATE TABLE "JamTrackPdf" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "jamTrackId" TEXT NOT NULL,
    CONSTRAINT "JamTrackPdf_jamTrackId_fkey" FOREIGN KEY ("jamTrackId") REFERENCES "JamTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PageSyncPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timeInSeconds" REAL NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "jamTrackPdfId" TEXT NOT NULL,
    CONSTRAINT "PageSyncPoint_jamTrackPdfId_fkey" FOREIGN KEY ("jamTrackPdfId") REFERENCES "JamTrackPdf" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "JamTrackPdf_filePath_key" ON "JamTrackPdf"("filePath");

-- CreateIndex
CREATE INDEX "JamTrackPdf_jamTrackId_idx" ON "JamTrackPdf"("jamTrackId");

-- CreateIndex
CREATE INDEX "PageSyncPoint_jamTrackPdfId_idx" ON "PageSyncPoint"("jamTrackPdfId");

-- Migrate existing PDF data: for each JamTrack with a non-null pdfPath,
-- create a JamTrackPdf record with name "Sheet Music"
INSERT INTO "JamTrackPdf" ("id", "name", "filePath", "sortOrder", "jamTrackId")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))) AS "id",
    'Sheet Music' AS "name",
    "pdfPath" AS "filePath",
    0 AS "sortOrder",
    "id" AS "jamTrackId"
FROM "JamTrack"
WHERE "pdfPath" IS NOT NULL;

-- Drop TabSyncPoint table
DROP TABLE IF EXISTS "TabSyncPoint";

-- Recreate JamTrack without pdfPath and tabPath columns
-- SQLite doesn't support DROP COLUMN well, so we recreate the table
CREATE TABLE "new_JamTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "duration" REAL NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "tempo" INTEGER,
    "timeSignature" TEXT NOT NULL DEFAULT '4/4',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_JamTrack" ("id", "title", "filePath", "duration", "completed", "tempo", "timeSignature", "createdAt")
SELECT "id", "title", "filePath", "duration", "completed", "tempo", "timeSignature", "createdAt"
FROM "JamTrack";

-- Drop old table and rename new one
DROP TABLE "JamTrack";
ALTER TABLE "new_JamTrack" RENAME TO "JamTrack";

-- Recreate unique index on filePath
CREATE UNIQUE INDEX "JamTrack_filePath_key" ON "JamTrack"("filePath");
