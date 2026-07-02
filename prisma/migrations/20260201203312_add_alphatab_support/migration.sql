/*
  Warnings:

  - You are about to drop the `Album` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Artist` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Song` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `songId` on the `Marker` table. All the data in the column will be lost.
  - Added the required column `trackId` to the `Marker` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Album_name_artistId_key";

-- DropIndex
DROP INDEX "Artist_name_key";

-- DropIndex
DROP INDEX "Song_filePath_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Album";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Artist";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Song";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "pdfPath" TEXT,
    "inProgress" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Book_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "trackNumber" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "duration" REAL NOT NULL,
    "bookId" TEXT NOT NULL,
    "pdfPage" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "tempo" INTEGER,
    "timeSignature" TEXT NOT NULL DEFAULT '4/4',
    CONSTRAINT "Track_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JamTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "duration" REAL NOT NULL,
    "pdfPath" TEXT,
    "tabPath" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "tempo" INTEGER,
    "timeSignature" TEXT NOT NULL DEFAULT '4/4',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "JamTrackMarker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "timestamp" REAL NOT NULL,
    "jamTrackId" TEXT NOT NULL,
    CONSTRAINT "JamTrackMarker_jamTrackId_fkey" FOREIGN KEY ("jamTrackId") REFERENCES "JamTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TabSyncPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "audioTime" REAL NOT NULL,
    "tabTick" INTEGER NOT NULL,
    "barIndex" INTEGER,
    "jamTrackId" TEXT NOT NULL,
    CONSTRAINT "TabSyncPoint_jamTrackId_fkey" FOREIGN KEY ("jamTrackId") REFERENCES "JamTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Marker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "timestamp" REAL NOT NULL,
    "trackId" TEXT NOT NULL,
    CONSTRAINT "Marker_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Marker" ("id", "name", "timestamp") SELECT "id", "name", "timestamp" FROM "Marker";
DROP TABLE "Marker";
ALTER TABLE "new_Marker" RENAME TO "Marker";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Author_name_key" ON "Author"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Book_name_authorId_key" ON "Book"("name", "authorId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_filePath_key" ON "Track"("filePath");

-- CreateIndex
CREATE UNIQUE INDEX "JamTrack_filePath_key" ON "JamTrack"("filePath");

-- CreateIndex
CREATE INDEX "TabSyncPoint_jamTrackId_idx" ON "TabSyncPoint"("jamTrackId");
