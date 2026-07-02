-- AlterTable
ALTER TABLE "PracticeSession" ADD COLUMN "videoId" TEXT;

-- CreateIndex
CREATE INDEX "PracticeSession_videoId_idx" ON "PracticeSession"("videoId");
