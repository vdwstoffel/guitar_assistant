-- CreateIndex
CREATE INDEX "BookVideo_bookId_idx" ON "BookVideo"("bookId");

-- CreateIndex
CREATE INDEX "BookVideo_chapterId_idx" ON "BookVideo"("chapterId");

-- CreateIndex
CREATE INDEX "Chapter_bookId_idx" ON "Chapter"("bookId");

-- CreateIndex
CREATE INDEX "JamTrackMarker_jamTrackId_idx" ON "JamTrackMarker"("jamTrackId");

-- CreateIndex
CREATE INDEX "Marker_trackId_idx" ON "Marker"("trackId");

-- CreateIndex
CREATE INDEX "Track_bookId_idx" ON "Track"("bookId");

-- CreateIndex
CREATE INDEX "Track_chapterId_idx" ON "Track"("chapterId");
