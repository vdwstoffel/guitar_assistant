# Tauri Migration Plan

**Goal:** Convert Next.js + Docker app to standalone Tauri desktop application

**Estimated Timeline:** 1-2 weeks

---

## Phase 1: Project Setup (Day 1)

### 1.1 Initialize Tauri Project
- [ ] Install Tauri CLI: `npm install -g @tauri-apps/cli`
- [ ] Create Tauri app structure: `npm create tauri-app`
- [ ] Choose options:
  - Package manager: npm
  - UI template: React + TypeScript
  - Build tool: Vite (faster than webpack)

### 1.2 Port Existing Code Structure
- [ ] Copy `src/components/` to new Tauri project
- [ ] Copy `src/types/`
- [ ] Copy `src/lib/` (except Next.js specific utilities)
- [ ] Copy `prisma/` directory
- [ ] Copy `public/` assets
- [ ] Set up Tailwind CSS 4 in Vite

### 1.3 Configure Dependencies
```json
// Key packages to install
- @prisma/client
- react-pdf
- alphatab (if still using)
- All current UI dependencies
```

---

## Phase 2: Backend - Tauri Commands (Days 2-4)

Replace Next.js API routes with Tauri commands (Rust functions callable from frontend)

### 2.1 Core Library Operations

**Current:** `/api/library/*`
**New:** Tauri commands in `src-tauri/src/main.rs`

```rust
// Commands to implement:
#[tauri::command]
async fn scan_library(music_dir: String) -> Result<(), String>

#[tauri::command]
async fn get_library() -> Result<LibraryData, String>

#[tauri::command]
async fn get_author(id: String) -> Result<Author, String>

#[tauri::command]
async fn get_book(id: String) -> Result<Book, String>

#[tauri::command]
async fn get_track(id: String) -> Result<Track, String>
```

### 2.2 File Streaming

**Current:** `/api/audio/[...path]` and `/api/pdf/[...path]`
**New:** Two approaches:

**Option A (Recommended):** Tauri asset protocol
- Register custom protocol for local file access
- Frontend uses `asset://` URLs
- Tauri serves files directly

**Option B:** Base64 encoding for small files
- Read file in Rust command
- Return as base64
- Decode in frontend

### 2.3 Database Integration

**Setup Prisma with Tauri:**
```toml
# src-tauri/Cargo.toml
[dependencies]
prisma-client-rust = "0.6"
tauri = "1.5"
```

- [ ] Configure Prisma to generate Rust client (or use Node Prisma via Tauri sidecar)
- [ ] Alternative: Keep using Node Prisma via Tauri's Node integration
- [ ] Set database path to app data directory: `tauri::api::path::app_data_dir()`

### 2.4 Markers & CRUD Operations

```rust
// Marker commands
#[tauri::command]
async fn create_marker(track_id: String, time: f64, label: String) -> Result<Marker, String>

#[tauri::command]
async fn update_marker(id: String, label: String) -> Result<Marker, String>

#[tauri::command]
async fn delete_marker(id: String) -> Result<(), String>
```

### 2.5 Jam Tracks Commands

```rust
#[tauri::command]
async fn get_jam_tracks() -> Result<Vec<JamTrack>, String>

#[tauri::command]
async fn get_jam_track_pdfs(jam_track_id: String) -> Result<Vec<JamTrackPdf>, String>

#[tauri::command]
async fn get_sync_points(pdf_id: String) -> Result<Vec<PageSyncPoint>, String>
```

---

## Phase 3: Frontend Adaptation (Days 5-7)

### 3.1 Create Tauri API Layer

**Create:** `src/lib/tauri-api.ts`

```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Replace all fetch() calls with invoke()
export async function getLibrary() {
  return await invoke('get_library');
}

export async function scanLibrary(musicDir: string) {
  return await invoke('scan_library', { musicDir });
}

export async function createMarker(trackId: string, time: number, label: string) {
  return await invoke('create_marker', { trackId, time, label });
}

// ... etc for all API operations
```

### 3.2 Update Components

**Files to modify:**
- [ ] `src/app/page.tsx` - Replace fetch with invoke
- [ ] `src/components/BottomPlayer.tsx` - Update audio file loading
- [ ] `src/components/PdfViewer.tsx` - Update PDF file loading
- [ ] `src/components/AuthorSidebar.tsx` - Update data fetching
- [ ] All components using API routes

**Pattern:**
```typescript
// Before
const response = await fetch('/api/library');
const data = await response.json();

// After
import { getLibrary } from '@/lib/tauri-api';
const data = await getLibrary();
```

### 3.3 File Path Handling

**Audio/PDF Loading:**
```typescript
// Before: HTTP URLs
<audio src={`/api/audio/${trackPath}`} />

// After: Asset protocol or Tauri command
<audio src={`asset://audio/${trackPath}`} />
// OR
const audioData = await invoke('read_audio_file', { path: trackPath });
```

### 3.4 Routing

**Current:** Next.js App Router with `[[...section]]`
**New:** React Router or Tauri's built-in routing

- [ ] Install `react-router-dom`
- [ ] Convert dynamic routes to React Router
- [ ] Keep same URL structure (library, videos, metronome, fretboard)

---

## Phase 4: Database & Music Files (Day 8)

### 4.1 Database Location

**Strategy:**
```rust
// Store database in app data directory
let app_data = tauri::api::path::app_data_dir(&config);
let db_path = app_data.join("guitar_assistant.db");
```

**On first launch:**
- [ ] Check if database exists
- [ ] If not, copy from bundled resources or create new
- [ ] Run migrations

### 4.2 Music Directory Configuration

**Options:**

**Option A:** Bundle with app (larger but simpler)
- Include `music/` in Tauri resources
- Extract on first launch

**Option B:** User selects directory (recommended)
- [ ] Add "Select Music Directory" in settings
- [ ] Use Tauri's file dialog: `tauri::api::dialog::FileDialogBuilder`
- [ ] Store path in config file
- [ ] Scan on selection

### 4.3 File Upload

**Current:** Upload via API
**New:** Native file dialog

```rust
#[tauri::command]
async fn upload_files() -> Result<(), String> {
  // Open native file picker
  // Copy files to music directory
  // Trigger library scan
}
```

---

## Phase 5: Special Features (Days 9-10)

### 5.1 Video Player
- [ ] Keep YouTube embed (works as-is in Tauri)
- [ ] Or use native video player if needed

### 5.2 Metronome
- [ ] Web Audio API works in Tauri webview
- [ ] No changes needed

### 5.3 Fretboard Visualization
- [ ] Canvas/SVG rendering works as-is
- [ ] No changes needed

### 5.4 Rocksmith .psarc Import

**Challenge:** vgmstream-cli dependency

**Solution:**
- [ ] Bundle vgmstream-cli binary with Tauri
- [ ] Use Tauri's sidecar feature to execute
- [ ] Or compile vgmstream as Rust library (more complex)

```rust
#[tauri::command]
async fn import_rocksmith(psarc_path: String) -> Result<(), String> {
  // Execute bundled vgmstream-cli
  // Parse PSARC/SNG
  // Import to database
}
```

---

## Phase 6: Testing & Polish (Days 11-12)

### 6.1 Core Functionality Testing
- [ ] Library scanning
- [ ] Audio playback
- [ ] PDF viewing
- [ ] Markers CRUD
- [ ] Jam tracks with multi-PDF
- [ ] Page sync points
- [ ] Metronome
- [ ] Video player

### 6.2 Performance Verification
- [ ] Benchmark library scan (should be faster)
- [ ] Test audio streaming (no buffering)
- [ ] PDF loading speed
- [ ] Memory usage

### 6.3 Error Handling
- [ ] Missing music directory
- [ ] Corrupted database
- [ ] Missing files
- [ ] Failed imports

---

## Phase 7: Build & Distribution (Day 13)

### 7.1 Configure Tauri Build

**Edit:** `src-tauri/tauri.conf.json`

```json
{
  "package": {
    "productName": "Guitar Assistant",
    "version": "2.0.0"
  },
  "tauri": {
    "bundle": {
      "identifier": "com.guitarassistant.app",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "resources": [
        "music/",
        "tools/vgmstream-cli"
      ]
    }
  }
}
```

### 7.2 Build Commands

```bash
# Development
npm run tauri dev

# Production build
npm run tauri build

# Outputs:
# - Linux: .deb, .AppImage
# - macOS: .dmg, .app
# - Windows: .msi, .exe
```

### 7.3 First Launch Experience
- [ ] Detect first launch
- [ ] Show welcome screen
- [ ] Guide user to select music directory
- [ ] Run initial scan
- [ ] Show tutorial (optional)

---

## Migration Checklist

### Remove (No Longer Needed)
- [ ] `next.config.mjs`
- [ ] All files in `src/app/api/`
- [ ] `docker-compose.yml`
- [ ] `Dockerfile`
- [ ] Next.js specific utilities
- [ ] Server-only packages

### Keep (Reuse As-Is)
- [ ] All React components
- [ ] `src/types/index.ts`
- [ ] `src/lib/rocksmith/` parsers
- [ ] `prisma/schema.prisma`
- [ ] Database file (copy to new location)
- [ ] Tailwind config
- [ ] TypeScript config (adapt for Vite)

### New Files to Create
- [ ] `src-tauri/src/main.rs` - Tauri backend
- [ ] `src-tauri/Cargo.toml` - Rust dependencies
- [ ] `src-tauri/tauri.conf.json` - Tauri configuration
- [ ] `src/lib/tauri-api.ts` - Frontend API layer
- [ ] `src/router.tsx` - React Router setup (if needed)

---

## Risk Mitigation

### Backup Everything
```bash
# Before starting
cp -r guitar_assistant guitar_assistant_backup
cp prisma/guitar_assistant.db prisma/guitar_assistant.db.pre-tauri
```

### Parallel Development
- Keep Next.js version running
- Develop Tauri version in separate directory
- Migrate incrementally
- Test each phase before proceeding

### Rollback Plan
If migration fails:
1. Keep Next.js + Docker version as fallback
2. Can always switch back
3. Database is compatible (same Prisma schema)

---

## Post-Migration Benefits

**Performance:**
- ✅ No HTTP overhead (direct file access)
- ✅ Faster library scanning
- ✅ Instant audio/PDF loading
- ✅ Lower memory usage (no Docker)

**Developer Experience:**
- ✅ No Docker complexity
- ✅ Faster startup time
- ✅ Native debugging
- ✅ Single executable distribution

**User Experience:**
- ✅ Native desktop app feel
- ✅ Faster and more responsive
- ✅ No "localhost:3000" in browser
- ✅ Proper desktop integration

---

## Next Steps

1. **Review this plan** - Any concerns or questions?
2. **Set up development environment** - Install Rust + Tauri CLI
3. **Start Phase 1** - Initialize Tauri project structure
4. **Incremental migration** - One phase at a time
5. **Test thoroughly** - Each phase before moving on

**Estimated total time:** 1-2 weeks for full migration
**Risk level:** Low (can keep Next.js version as backup)
**Benefit:** High (better performance, simpler deployment, native feel)
