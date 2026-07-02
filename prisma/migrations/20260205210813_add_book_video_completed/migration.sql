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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookVideo_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BookVideo" ("bookId", "createdAt", "duration", "filePath", "filename", "id", "pdfPage", "sortOrder", "title", "trackNumber") SELECT "bookId", "createdAt", "duration", "filePath", "filename", "id", "pdfPage", "sortOrder", "title", "trackNumber" FROM "BookVideo";
DROP TABLE "BookVideo";
ALTER TABLE "new_BookVideo" RENAME TO "BookVideo";
CREATE UNIQUE INDEX "BookVideo_filePath_key" ON "BookVideo"("filePath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
