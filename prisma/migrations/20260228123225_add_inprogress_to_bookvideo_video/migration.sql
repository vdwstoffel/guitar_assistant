-- AlterTable: Add inProgress to BookVideo
ALTER TABLE "BookVideo" ADD COLUMN "inProgress" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add completed and inProgress to Video
ALTER TABLE "Video" ADD COLUMN "completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Video" ADD COLUMN "inProgress" BOOLEAN NOT NULL DEFAULT false;
