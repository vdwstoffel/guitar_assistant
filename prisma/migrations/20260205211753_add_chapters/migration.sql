-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BookVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "title" TEXT,
    "filePath" TEXT NOT NULL,
    "duration" REAL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "trackNumber" INTEGER,
    "pdfPage" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "bookId" TEXT NOT NULL,
    "chapterId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookVideo_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookVideo_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BookVideo" ("bookId", "completed", "createdAt", "duration", "filePath", "filename", "id", "pdfPage", "sortOrder", "title", "trackNumber") SELECT "bookId", "completed", "createdAt", "duration", "filePath", "filename", "id", "pdfPage", "sortOrder", "title", "trackNumber" FROM "BookVideo";
DROP TABLE "BookVideo";
ALTER TABLE "new_BookVideo" RENAME TO "BookVideo";
CREATE UNIQUE INDEX "BookVideo_filePath_key" ON "BookVideo"("filePath");
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
    "tempo" INTEGER,
    "timeSignature" TEXT NOT NULL DEFAULT '4/4',
    CONSTRAINT "Track_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Track_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Track" ("bookId", "completed", "duration", "filePath", "id", "pdfPage", "tempo", "timeSignature", "title", "trackNumber") SELECT "bookId", "completed", "duration", "filePath", "id", "pdfPage", "tempo", "timeSignature", "title", "trackNumber" FROM "Track";
DROP TABLE "Track";
ALTER TABLE "new_Track" RENAME TO "Track";
CREATE UNIQUE INDEX "Track_filePath_key" ON "Track"("filePath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
