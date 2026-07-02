/*
  Warnings:

  - You are about to drop the column `alphaTex` on the `GuitarTab` table. All the data in the column will be lost.
  - You are about to drop the column `tuning` on the `GuitarTab` table. All the data in the column will be lost.
  - Added the required column `filePath` to the `GuitarTab` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GuitarTab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "tempo" INTEGER,
    "timeSignature" TEXT,
    "duration" REAL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_GuitarTab" ("createdAt", "id", "tempo", "timeSignature", "title", "updatedAt") SELECT "createdAt", "id", "tempo", "timeSignature", "title", "updatedAt" FROM "GuitarTab";
DROP TABLE "GuitarTab";
ALTER TABLE "new_GuitarTab" RENAME TO "GuitarTab";
CREATE UNIQUE INDEX "GuitarTab_filePath_key" ON "GuitarTab"("filePath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
