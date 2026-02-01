# Guitar Assistant

A web application for managing and practicing guitar exercises, method books, and tracks with audio playback, PDF viewing, markers, and a built-in metronome.

## Features

- **Library Management** - Organize your guitar books and exercises by author, with automatic metadata scanning from audio files
- **Audio Player** - Full-featured player with waveform visualization (WaveSurfer.js), playback speed control, and loop regions
- **PDF Viewer** - View sheet music/tablature PDFs alongside audio playback, with automatic page linking to tracks
- **Markers** - Add timestamped markers to tracks for quick navigation to specific sections
- **Metronome** - Built-in practice metronome with tempo and time signature controls
- **Fretboard Visualizer** - Interactive guitar fretboard reference
- **Video Playlists** - Manage YouTube video playlists for lessons and tutorials
- **Progress Tracking** - Mark tracks as completed and filter books by "in progress" status
- **Track Tempo** - Store tempo information per track for practice reference

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd guitar_assistant

# Install dependencies
npm install

# Initialize the database
npx prisma generate
npx prisma db push

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Adding Music

Upload music through the UI - the application automatically organizes files into the correct folder structure (`music/Author/Book/`) based on the metadata you provide during upload.

Supported formats: MP3, FLAC, WAV. You can also upload PDF files for sheet music/tablature which will be linked to the book.

## Docker Deployment

Docker deployment includes Ghostscript for PDF processing.

```bash
docker-compose up
```

Or build manually:

```bash
docker build -t guitar-assistant .
docker run -p 3000:3000 -v ./music:/app/music -v ./prisma:/app/prisma guitar-assistant
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `file:./prisma/guitar_assistant.db` |
| `MUSIC_DIR` | Music directory path (Docker) | `./music` |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **Database**: SQLite with Prisma ORM
- **Audio**: WaveSurfer.js for waveform visualization
- **PDF**: react-pdf for document viewing
- **Metadata**: music-metadata for audio file parsing

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## License

Private project.
