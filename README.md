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
- **Master-detail layout** - Persistent track list on the left, the song's Guitar Pro score on the right, and a full-width waveform player at the bottom
- **YouTube import** - Paste a YouTube URL to download and import audio directly as a jam track
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
- **Page-flip automations** - Press `P` during playback to record an automation point; the viewer advances to the next page automatically as the audio reaches each point. Lessons only — a jam track shows its Guitar Pro score instead of a PDF. An optional anticipation offset can flip the page slightly early so it's ready before the beat
- **Full-height page** - The page controls and Fit Page toggle float over the PDF instead of taking their own row, and fade in on hover (pinned on touch screens), so the page gets the viewer's entire height — worth about 6% more sheet music in fit-to-page mode

### Guitar Pro Import
- **One entry per song, two sources** - A song is a single entry in Jam Tracks that may have an audio recording, a Guitar Pro tab, or both. With both, an Audio / Tab switch picks which you hear; only one plays at a time, so there is nothing to keep in sync. **+ Add track** offers all three ways in (audio upload, YouTube, Guitar Pro), and a track that has only one source offers to add the other — including ones imported separately beforehand. **Add audio** on a tab-only song takes either a file or a YouTube link, and the recording keeps the song's existing name rather than the video's
- **Import a Guitar Pro file and practise against it** - Import a `.gp`, `.gp3`, `.gp4`, `.gp5` or `.gpx` file from the Jam Tracks section. The file plays itself — every instrument synthesised — so there is no audio recording and nothing to keep in sync, and slowing down is exact rather than time-stretched
- **Import straight from a Songsterr link** - A song with no tab offers **🎸 Import from Songsterr** beside the file picker: paste the tab's URL and the score arrives as a Guitar Pro file attached to that song, with no trip through a download site. Songsterr serves no Guitar Pro file to fetch, so the score is rebuilt from the data its own player reads — faithful, but not bit-identical, and the occasional effect Guitar Pro cannot spell is dropped. Parts the server withholds are skipped rather than failing the whole import
- **Mute your own part** - A per-track mixer with volume, mute and solo, so you can turn your own part down and play it while the rest of the band keeps going. This is the point of importing a tab rather than a recording
- **One instrument at a time** - Read whichever part you are learning and switch between them; every part stays audible whichever is on screen
- **Named practice sections** - Drag across the score to pick whole bars, name it ("Solo", "the fast bit"), and it is there next time; clicking one jumps to it and loops it
- **The same transport as the tab editor** - Play/pause with `Space`, stop, repeat, 10-200% speed saved per song, and the click and count-in with the accented downbeat
- **Two players, one keyboard** - With a song's tab showing in place of the PDF, the recording and the score are both on screen and both want `Space`. It goes to whichever you last clicked into — the waveform, a marker or the track list for the recording, anywhere in the score for the tab — and the panel that owns it is outlined so there is no guessing. A song without a tab is unchanged, and the tab editor opened over the page still takes the keyboard outright
- **On lesson exercises too** - A book exercise's tabs list (Lessons → track → **Tabs**) holds both kinds: tabs you score yourself and Guitar Pro files you import. **🎼 Import Guitar Pro** adds one, and **Practice** opens it in the same side dock the editor uses, so the score reads beside the book's PDF while the band plays underneath. Imports keep their own named sections and instrument choice, and practising one counts toward the exercise
- Read-only: writing and editing tabs is the Tabs section's job

### Tab Editor
- **Write tabs on a canvas** - The **Tabs** section opens a score you type notation into directly: click a beat to put the caret there, type a fret number, arrow around, and the tab redraws as you go. A tab opened from a track (Lessons → track → Tabs → Practice) gets the same editor, so the tab stays attached to the piece you are practising. That same list also holds imported Guitar Pro files — see **Guitar Pro Import**
- **Side-by-side with the book** - Opened from a track, the editor docks to one side of the window rather than covering it, so the book PDF you are transcribing from stays readable and scrollable beside it. Drag the panel's inner edge to resize, flip it to the other side, or expand it to the whole window; the choice is remembered
- **AlphaTex source pane** - The score and its AlphaTex source are two views of one document, editable from either side. The source pane shows parse diagnostics inline; an unparseable draft is still saved rather than lost
- **Playback** - Play/pause (`Space`), stop, repeat, and the same 10-200% practice speed control used elsewhere, saved per tab
- **Metronome, count-in and volume** - A click track and a count-in bar (on by default), each switched on separately and sharing one level, plus a volume for the tab's own playback so you can balance the two. The first beat of each bar is accented — the same click as the others, just louder. Count-in works with the click off, for counting yourself in and then playing to silence. All remembered in the browser (a listening preference, not part of the tab)
- **Drag to pick a practice section** - Drag across the score to select bars to repeat, snapped to whole bars. The section survives clicking and editing inside it — the only way to clear it is the toolbar chip's `✕`
- **Tempo and tuning** - Both are written into the tab itself (and are undoable). Tuning covers the usual six-string alternates: Drop D, Drop C, DADGAD, open tunings, and whole/half-step down
- **Repeat bars** - Mark a section with real repeat barlines (`𝄆 … 𝄇 ×N`), written into the tab and played back that many times. Put the caret in the bar the section starts on and press `𝄆 Repeat start`, then in the bar it ends on and press `𝄇 Repeat end` — the bars in between need no selecting
- **Triplets** - Press `Triplet` (or `u`) to turn the caret's beat and the next two into one group; the bar grows if it needs to, and pressing again takes the whole group apart
- **Techniques** - Hammer-on/pull-off, slide, palm mute, vibrato, dead and ghost notes, tap, harmonic, let ring, bends (full, half, release, pre-bend), and ties
- **Keyboard-first** - Every command has a key; press `?` for the full list

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
3. Select a track in the list; its Guitar Pro score reads on the right while the recording plays. A song with no tab offers **🎼 Import a Guitar Pro file** or **🎸 Import from Songsterr**, which takes a tab URL directly

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

## HTTPS on the Local Network

Caddy serves the app over HTTPS at `https://192.168.129.11`, which is what makes
microphone recording work (browsers only expose `getUserMedia` on a secure
origin). It signs its certificates with its own private CA, so the first visit
from any machine shows:

> **Your connection is not private** — `NET::ERR_CERT_AUTHORITY_INVALID`

Nothing is wrong with the certificate. The machine simply does not know the
authority that signed it. Trust that authority once per machine and the warning
is gone for good — clicking "Advanced → Proceed" is not equivalent, because
browsers re-prompt and keep the origin flagged.

**The quickest route:** click through the warning once, open **Tools**, and copy
the command shown under "Trust this server's certificate". That card detects the
visitor's OS and fills in the live fingerprint, so there is nothing to look up.
The per-platform instructions below are the same thing written out.

### Windows

In an **elevated** PowerShell (right-click → Run as administrator):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-ca.ps1
```

No admin rights? `-CurrentUser` installs it for your account only, which Chrome,
Edge and Brave all honour:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-ca.ps1 -CurrentUser
```

Chrome, Edge and Brave share the Windows root store, so one run covers them all.
Firefox reads it too, because `security.enterprise_roots.enabled` defaults to
true on Windows.

If the Windows machine does not have this repository checked out, paste this
into an elevated PowerShell instead — it does the same thing, fingerprint check
included:

```powershell
$f = Join-Path $env:TEMP 'ga-ca.crt'
Invoke-WebRequest http://192.168.129.11/rootca.crt -OutFile $f -UseBasicParsing
$c = New-Object Security.Cryptography.X509Certificates.X509Certificate2 $f
$h = -join ([Security.Cryptography.SHA256]::Create().ComputeHash($c.RawData) | ForEach-Object { $_.ToString('X2') })
if ($h -ne '1AFC17066F2ECFD976D7866F36CAD7E413CF67EA727574D76A56639A48BE5367') { throw "FINGERPRINT MISMATCH: $h" }
$s = New-Object Security.Cryptography.X509Certificates.X509Store('Root','LocalMachine')
$s.Open('ReadWrite'); $s.Add($c); $s.Close()
"Installed. Fingerprint verified: $h"
```

Swap `'LocalMachine'` for `'CurrentUser'` to install without admin rights.

### Linux / macOS

```bash
./scripts/install-ca.sh                 # system store + every browser found
./scripts/install-ca.sh --skip-system   # browsers only, no root required
```

Browsers on Linux each keep a private NSS database and ignore the system store,
so the script walks them individually: Chrome, Chromium and Brave (deb, snap and
flatpak builds alike) plus every Firefox profile. It needs `certutil`:

```bash
sudo apt install libnss3-tools
```

Re-run it after installing a new browser or creating a new Firefox profile — it
is idempotent.

### Phones and tablets

Open `http://192.168.129.11/rootca.crt` in the device's browser. Android offers
to install it directly; on iOS, install the downloaded profile under
**Settings → General → VPN & Device Management**, then enable it under
**Settings → General → About → Certificate Trust Settings**.

### After installing

Fully quit and reopen the browser — closing the tab is not enough, since
browsers cache TLS failures for the life of a session.

### What invalidates it

Both scripts pin the CA's SHA-256 fingerprint, so the plain-HTTP download cannot
be swapped by anyone else on the network. Two things break every installed copy
at once and need every machine re-run:

- **Destroying the `caddy_data` volume.** Caddy mints a brand-new CA. A backup
  of the current one lives at `~/.local/share/guitar-assistant/caddy-ca/`, with
  restore instructions in the `README.txt` beside it — restoring it avoids the
  re-run entirely.
- **Changing the host's LAN IP.** Certificates are bound to it. Pin the address
  with a DHCP reservation on the router, and update `Caddyfile` plus the
  `$HostAddress`/`GUITAR_ASSISTANT_HOST` defaults in both scripts if it does move.

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
