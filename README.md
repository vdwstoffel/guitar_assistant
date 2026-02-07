# Guitar Assistant

A web application for managing and practicing guitar exercises, method books, and play-along tracks. Features audio playback with waveform visualization, synchronized PDF sheet music viewing, markers, a metronome, and music theory tools.

## Features

### Library Management
- **Author / Book / Track hierarchy** - Organize exercises by author and book, with chapters for structure
- **Automatic metadata scanning** - Audio file metadata is parsed to populate titles, durations, and organization
- **File upload** - Upload audio files, PDFs, and videos through the application UI
- **Progress tracking** - Mark tracks and videos as completed; filter books by "In Progress" status
- **Book covers** - Album art extracted from audio metadata

### Jam Tracks
Standalone play-along tracks (backing tracks, songs) that live outside the book hierarchy:
- **YouTube import** - Paste a YouTube URL to download and import audio directly as a jam track
- **Multi-PDF support** - Attach multiple named PDFs per track (e.g., "Rhythm Guitar", "Lead Guitar") displayed in a tabbed viewer
- **Automatic page-flipping** - Page sync points map audio timestamps to PDF pages for hands-free page turns during playback
- **Markers** - Timestamp annotations for quick navigation to sections

### Audio Player
- **Waveform visualization** - Powered by WaveSurfer.js
- **Playback speed control** - Slow down or speed up for practice
- **Markers bar** - Visual marker timeline for quick navigation

### PDF Viewer
- Sheet music / tablature displayed alongside audio playback
- Automatic page linking per track
- Single-PDF mode for books, multi-PDF tabbed mode for jam tracks

### Practice Tools
- **Metronome** - Adjustable BPM (20-300), time signature support (4/4, 3/4, 2/4, 6/8), visual beat indicator, volume control
- **Fretboard Visualizer** - Interactive guitar fretboard reference
- **Circle of Fifths** - Major/minor keys, key signatures, diatonic chords, scale notes
- **PDF Concatenation** - Append pages to existing book PDFs incrementally

### Video Playlists
- Manage YouTube video playlists for lessons and tutorials
- Upload book-specific videos, optionally linked to chapters or PDF pages

## Getting Started

### Docker (Recommended)

```bash
docker-compose up -d
```

This starts the full application with all dependencies (Ghostscript for PDF processing, ffmpeg for audio/video, yt-dlp for YouTube imports).

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Local Development

Prerequisites: Node.js 20+, npm

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Note: Some features (PDF conversion, YouTube import) require system dependencies only available in the Docker image.

### Adding Content

**All content should be uploaded through the application UI** rather than manually copying files.

#### Books & Exercises
1. Click "Upload Files" in the sidebar
2. Select audio files (MP3, FLAC, WAV, OGG, M4A, AAC)
3. Click "Scan Library" to process and organize files by metadata
4. Optionally add PDFs and videos to books

#### Jam Tracks
1. Navigate to "Jam Tracks" in the sidebar
2. Click "Upload Files" to add local audio, or "YouTube" to import from a URL
3. Add PDF sheet music via the "Add PDF" button on each track
4. Set up page sync points for automatic page-flipping during playback

## Docker Deployment

```bash
# Using docker-compose
docker-compose up -d

# Or build manually
docker build -t guitar-assistant .
docker run -p 3000:3000 -v ./music:/app/music -v ./prisma:/app/prisma guitar-assistant
```

The Docker image includes:
- Ghostscript for PDF conversion/processing
- ffmpeg for audio/video processing
- yt-dlp + Python 3 for YouTube audio downloads

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `file:./prisma/guitar_assistant.db` |
| `MUSIC_DIR` | Music directory path | `./music` |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **Database**: SQLite with Prisma ORM
- **Audio**: WaveSurfer.js for waveform visualization
- **PDF**: react-pdf for document viewing
- **Metadata**: music-metadata for audio file parsing
- **YouTube**: yt-dlp for audio download and conversion

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## License

Private project.
