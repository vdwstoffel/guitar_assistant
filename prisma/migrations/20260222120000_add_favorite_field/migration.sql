-- AlterTable
ALTER TABLE "Track" ADD COLUMN "favorite" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JamTrack" ADD COLUMN "favorite" BOOLEAN NOT NULL DEFAULT false;
