-- AlterTable
ALTER TABLE "PracticeSession" ADD COLUMN "bookVideoId" TEXT REFERENCES "BookVideo"("id") ON DELETE CASCADE;

-- CreateIndex
CREATE INDEX "PracticeSession_bookVideoId_idx" ON "PracticeSession"("bookVideoId");
