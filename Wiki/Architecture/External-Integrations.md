# External Integrations

## 1. YouTube Music (`yt-dlp` & Deno Runtime)

Music-Sync integrates with YouTube Music via `yt-dlp` for playlist extraction and high-quality Opus audio downloading.

### Flat Extraction (Playlist Scanning)
- **Module**: `app/watcher/youtube.py` (`YouTubePlaylistWatcher`)
- **Options**: `extract_flat=True`, `skip_download=True`.
- **Purpose**: Rapidly extracts video IDs, titles, positions, and durations from playlists in a single HTTP request without fetching individual video web pages.
- **Title Filtering**: Filters out unavailable video strings (`[Private video]`, `[Deleted video]`).

### Audio Extraction & Tagging
- **Module**: `app/downloader/service.py` (`SongDownloader`)
- **Format**: `format="bestaudio/best"`, extracting native `.opus` streams.
- **Post-Processors**: Uses FFmpeg and AtomicParsley (`writethumbnail=True`) to embed high-res cover art and ID3/Opus metadata tags directly into downloaded audio files.

### YouTube JavaScript Anti-Bot Solver (Deno Integration)
- YouTube employs EJS JavaScript challenges to throttle media scrapers.
- `app/core/ytdlp.py` explicitly configures `yt-dlp` JS runtimes:
  ```python
  "js_runtimes": {"deno": {}, "node": {}},
  "remote_components": ["ejs:github"]
  ```
- The backend `Dockerfile` installs Deno into `/usr/local/bin/deno`, allowing `yt-dlp` to execute YouTube JS challenge solvers seamlessly.

### Authenticated & Private Playlist Scanning (Netscape Cookies)
- Plaintext Netscape-formatted cookie files stored in database settings (`app_settings.youtube_cookies`) enable scanning of age-restricted or private YouTube playlists.
- `app/core/ytdlp.py` exposes `get_cookie_context(cookies_text)`:
  - Writes cookie text to an ephemeral temp file (`tempfile.mkstemp(prefix="yt_cookies_")`).
  - Prepends `# Netscape HTTP Cookie File\n` header if missing.
  - Automatically unlinks and deletes the temp file in a `finally` block upon completion.

---

## 2. LRCLIB.net API Integration

Music-Sync retrieves synchronized (`.lrc`) lyrics from [LRCLIB.net](https://lrclib.net/).

### Search Endpoint & Heuristics
- **Module**: `app/lyrics/service.py` (`LyricsService`)
- **Endpoint**: `GET https://lrclib.net/api/search`
- **Query Parameters**: `track_name`, `artist_name`, `album_name`.

### Search Sanitization Heuristics
YouTube titles often contain extraneous text (e.g. `(Official Video)`, `[Remastered 2020]`, `HD Audio`). `LyricsService._clean_title()` strips non-song title noise prior to querying LRCLIB:
- Removes parenthetical expressions containing: `official`, `video`, `audio`, `lyric`, `remastered`, `hd`, `ft.`, `feat.`.
- Uses `DownloadedTrack.artist` (populated during audio download) as `artist_name` to dramatically increase search hit precision.

### Fallback Reorganization (`no-lyrics/`)
- If LRCLIB returns a `404 Not Found` or no synchronized lyrics (`syncedLyrics == null`), `LyricsService` updates `Song.lyrics_status = 'unavailable'`.
- To keep the music library clean, `_move_to_no_lyrics(song)` relocates the audio file from `<DOWNLOADS_DIR>/<Playlist>/music/` to `<DOWNLOADS_DIR>/<Playlist>/no-lyrics/`.
