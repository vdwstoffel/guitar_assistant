# Guitar Assistant

A web application for managing and practicing guitar exercises, method books, and play-along tracks. Features audio playback with waveform visualization, synchronized PDF sheet music viewing, markers, a metronome, and music theory tools.

## Features

### Library Management
- **Author / Book / Track hierarchy** - Organize exercises by author and book, with chapters for structure
- **Automatic metadata scanning** - Audio file metadata is parsed to populate titles, durations, and organization
- **File upload** - Upload audio files, PDFs, and videos through the application UI
- **Progress tracking** - Mark tracks and videos as completed; filter books by "In Progress" status
- **Per-video volume** - Lesson videos each remember their own volume level, saved to the database rather than shared across every video
- **Per-video playback speed** - Lesson videos have the same 10-200% speed control as tracks (presets, 1% steppers, direct entry), saved per video
- **Reset book progress** - "Edit Book Info" → "Reset Progress" returns every track and video in a book to the default state (clears completed / in-progress). Last-played dates and favourites are preserved
- **Book covers** - Album art extracted from audio metadata

### Jam Tracks
Standalone play-along tracks (backing tracks, songs) that live outside the book hierarchy:
- **Master-detail layout** - Persistent track list on the left, tabbed PDF viewer on the right, and a full-width waveform player at the bottom
- **YouTube import** - Paste a YouTube URL to download and import audio directly as a jam track
- **Multiple named PDFs per track** - Attach as many PDFs as you like (e.g., "Rhythm Guitar", "Lead Guitar"), each with a custom name; switch between them via tabs; upload or rename at any time
- **Page-flip automations** - Press `P` during playback to record a page-flip event at the current position (defaults to the currently visible PDF page); automations advance the PDF automatically during playback. Shared with Lessons, with an optional anticipation offset so the page turns slightly before the beat
- **Markers** - Timestamp annotations shown directly on the waveform for quick navigation

### Audio Player
- **Waveform visualization** - Powered by WaveSurfer.js
- **Playback speed control** - Slow down or speed up for practice (saved per track)
- **Markers** - Timestamp annotations shown on the waveform and in a markers bar; click a marker to jump to it (with an optional lead-in and beat-based count-in). Any marker can be set as a **stop point** so playback halts there
- **A/B loop** - Set loop start/end points to repeat a section continuously, and **save named loops** per track to re-apply later
- **Per-track volume & LUFS normalization** - Consistent loudness across tracks
- **Audio output routing** - Route audio to any connected output device
- **Keyboard shortcuts** - Space (play/pause), `M` (add marker), `A` (cycle A/B loop), `P` (add page-flip automation at current position), `←` (restart), `+`/`-` (volume), `?` (shortcuts help)

### PDF Viewer
- Sheet music / tablature displayed alongside audio playback
- **Page-flip automations** - Press `P` during playback to record an automation point; the viewer advances to the next page automatically as the audio reaches each point. Works in both Lessons (books/tracks) and Jam Tracks. An optional anticipation offset can flip the page slightly early so it's ready before the beat
- Single-PDF mode for books/tracks, multi-PDF tabbed mode for jam tracks
- **Full-height page** - The page controls and Fit Page toggle float over the PDF instead of taking their own row, and fade in on hover (pinned on touch screens), so the page gets the viewer's entire height — worth about 6% more sheet music in fit-to-page mode

### Practice Tools
- **Metronome** - Adjustable BPM (20-300), time signature support (4/4, 3/4, 2/4, 6/8), visual beat indicator, volume control
- **Fretboard Visualizer** - Interactive guitar fretboard with scale/key overlays, note trainer, a Practice Exercise generator (auto-generated tabs), and a per-scale/key **Songs** panel (add a YouTube URL → downloaded audio you can play along to). Each song remembers its own volume in the database, since YouTube sources vary a lot in loudness. With no scale selected the panel lists every song, and picking one opens its key and scale on the fretboard
- **Circle of Fifths** - Major/minor keys, key signatures, diatonic chords, scale notes
- **PDF Concatenation** - Append pages to existing book PDFs incrementally

### Videos Tab
- **Local download & offline playback** - Paste a YouTube URL; yt-dlp downloads the video to the server so it plays back fully offline with no streaming dependency
- **Markers** - Add timestamp annotations to any video for quick jump-to-section navigation; each marker supports a lead-in buffer so playback starts a few seconds before the mark
- **A/B loop** - Set loop start/end between any two markers to repeat a section continuously for focused practice
- **Playback speed control** - The same 10-200% control used for tracks, saved per video so it survives a reload
- **Per-video volume** - Each video remembers its own volume level, saved to the database so it persists across sessions and devices
- **Audio output routing** - Route video audio to any connected output device
- **Custom categories** - Organize videos into collapsible category sections (Warmup, Tutorial, etc.)
- **Drag-and-drop reordering** - Reorganize both categories and videos within categories

### Recordings
- Capture yourself playing guitar straight from the browser to review later
- Pick the input device (laptop mic, USB mic, audio interface) each time
- Live duration and input-level meter while recording
- Recordings are saved server-side under `music/Recordings/` and stream via the existing audio pipeline
- Rename, play back, and delete recordings from the **Recordings** tab
- The recorder panel in the top bar plays back your most recent take in one click, so you can review a run without leaving the page

## Getting Started

### Docker (Recommended)

```bash
docker compose up -d
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
3. Select a track in the list; use the PDF panel to upload one or more named PDFs (e.g., "Rhythm Guitar", "Lead Guitar") and switch between them via tabs
4. Press `P` during playback to record page-flip automations — the viewer will flip pages automatically on future plays

## Docker Deployment

```bash
# Using Docker Compose (v2)
docker compose up -d

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
