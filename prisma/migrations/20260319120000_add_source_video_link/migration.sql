-- Add sourceVideoId column to Track for linking extracted audio to source video
ALTER TABLE "Track" ADD COLUMN "sourceVideoId" TEXT REFERENCES "BookVideo"("id") ON DELETE SET NULL;

-- Create unique index for one-to-one relationship
CREATE UNIQUE INDEX "Track_sourceVideoId_key" ON "Track"("sourceVideoId");
