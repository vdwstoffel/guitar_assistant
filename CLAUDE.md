# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Guitar/Music Assistant - a Next.js 16 web application for managing and practicing guitar exercises, books, and tracks with audio playback, PDF viewing, markers, and a metronome.

**Stack**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Prisma ORM with SQLite

## Common Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint
npm start            # Production server

# Docker
docker-compose up    # Run containerized (includes Ghostscript for PDF conversion)
```

## Architecture

### Terminology (Recent Migration)
The codebase recently migrated naming conventions:
- **Artist → Author** (e.g., book authors, instructors)
- **Album → Book** (e.g., guitar method books, exercise collections)
- **Song → Track** (individual exercises/pieces)

### Key Directories
- `src/app/api/` - API routes for library, books, tracks, markers, videos, streaming
- `src/components/` - React components (BottomPlayer.tsx is the main audio player at ~715 lines)
- `src/lib/prisma.ts` - Prisma client singleton
- `src/types/index.ts` - TypeScript interfaces for Author, Book, Track, Marker, Video
- `music/` - Local music files organized by author/book
- `prisma/` - Schema, migrations, and SQLite database

### Data Flow
1. `/api/library/scan` scans `music/` directory and populates database from audio file metadata
2. `/api/library` returns hierarchical data: Authors → Books → Tracks → Markers, plus standalone JamTracks
3. Audio/PDF files are streamed via `/api/audio/[...path]` and `/api/pdf/[...path]`

### Jam Tracks
Standalone play-along tracks (backing tracks, songs) that exist outside the Author → Book hierarchy:
- Stored in `music/JamTracks/` folder, one subfolder per track
- Each jam track can have its own PDF (stored as `sheet.pdf` in the track folder)
- API endpoints: `/api/jamtracks/`, `/api/jamtracks/[id]/`, `/api/jamtracks/[id]/markers/`, `/api/jamtracks/[id]/pdf/`

### Important: File Uploads
**All content must be uploaded through the application UI.** Do not suggest manually copying files into the music folders. The correct workflow is:
1. Use "Upload Files" button in the sidebar
2. Click "Scan Library" to process uploaded files
3. The application handles file organization automatically

### Client Routing
Single-page app with catch-all route `[[...section]]` supporting sections:
- `library` (default) - main book/track browser
- `videos` - YouTube video playlist
- `metronome` - practice metronome
- `fretboard` - guitar fretboard visualization

URL query params persist library selection state (author/book).

### Database Schema (Prisma)
- **Author** → has many Books
- **Book** → belongs to Author, has PDF path, has many Tracks
- **Track** → has audio file, duration, PDF page reference, completion status, has many Markers
- **Marker** → timestamp annotation on a Track
- **Video** → YouTube video with sort order

All models use UUID primary keys. Cascade deletes are configured on foreign keys.

## Environment
- `DATABASE_URL` - SQLite path (default: `file:./prisma/guitar_assistant.db`)
- `MUSIC_DIR` - Music directory path (used in Docker)

## Documentation
When adding new features, check if they should be documented in [README.md](README.md). Update the Features section or add new sections as appropriate.
