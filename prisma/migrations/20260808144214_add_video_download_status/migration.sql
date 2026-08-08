-- AlterTable
ALTER TABLE "Video" ADD COLUMN "duration" REAL;
ALTER TABLE "Video" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Video" ADD COLUMN "errorMessage" TEXT;
