# Core Domain Logic

## 1. State Machines & Status Transitions

Track processing state in Music-Sync is tracked via two primary status columns on the `Song` entity: `download_status` and `lyrics_status`.

### Audio Download Status State Machine (`Song.download_status`)

```text
              ┌───────────┐
              │  pending  │ ◄────────────────────────┐
              └─────┬─────┘                          │ (Reset / Retry)
                    │                                │
                    ▼                                │
              ┌───────────┐                          │
              │downloading│                          │
              └──┬─────┬──┘                          │
                 │     │                             │
       Success   │     │ Failure (Retryable)         │
    ┌────────────┘     └─────────────┐               │
    ▼                                ▼               │
┌───────────┐                  ┌───────────┐         │
│downloaded │                  │  failed   ├─────────┘
└───────────┘                  └─────┬─────┘
                                     │ Max retries exceeded /
                                     │ Non-retryable error
                                     ▼
                               ┌───────────┐
                               │unavailable│
                               └───────────┘
```

#### Status Transition Rules:
- **`pending`**: Initial state assigned when a video is discovered by `PlaylistReconciler`.
- **`downloading`**: Assigned by `SongDownloader` immediately before launching `yt-dlp`.
- **`downloaded`**: Assigned upon successful audio extraction, thumbnail embedding, and `DownloadedTrack` metadata creation.
- **`failed`**: Assigned when `yt-dlp` or post-processing throws a retryable exception. Includes exponential backoff calculation for `next_download_attempt`.
- **`unavailable`**: Assigned when a video is private/deleted or when `max_download_retries` is exceeded. Prevents further downloader polling.

---

### Lyrics Status State Machine (`Song.lyrics_status`)

```text
                               ┌───────────┐
                               │  pending  │ ◄───────────┐
                               └─────┬─────┘             │ (Reset / Retry)
                                     │                   │
                     ┌───────────────┴───────────────┐   │
                     │  LyricsWorker Processing      │   │
                     └───────┬───────────────┬───────┘   │
             LRCLIB Match    │               │ No Match  │
          ┌──────────────────┘               └───────┐   │
          ▼                                          ▼   │
    ┌───────────┐                              ┌───────────┐
    │downloaded │                              │unavailable│
    └───────────┘                              └───────────┘
```

#### Status Transition Rules:
- **`pending`**: Default state assigned during track creation. Remains pending until audio download completes.
- **`downloaded`**: Assigned when `LyricsService` successfully matches and writes a `.lrc` file adjacent to the audio file.
- **`unavailable`**: Assigned when LRCLIB returns no matched synchronized lyrics. Triggers moving the audio file to `<Playlist>/no-lyrics/`.
- **`failed`**: Assigned on network communication errors with LRCLIB.

---

## 2. Directory Layout & Path Resolution Logic

Media and lyrics files are organized on disk using standardized directory paths managed by `app/core/paths.py`:

```text
/app/downloads/ (or ./data/downloads in local execution)
│
├── <Sanitized_Playlist_A_Name>/
│   ├── music/
│   │   ├── Track1.opus
│   │   ├── Track1.lrc
│   │   ├── Track2.opus
│   │   └── Track2.lrc
│   └── no-lyrics/
│       └── Track3.opus
│
└── <Sanitized_Playlist_B_Name>/
    └── music/
        └── Track1.opus
```

### Path Helper Rules (`app/core/paths.py`):
1. **Filename Sanitization**: `sanitize_filename(name)` removes invalid filesystem characters (`[\\/*?:"<>|]`) and strips trailing whitespace/dots.
2. **Music Directory Resolution**: `get_playlist_music_root(playlist_name)` returns `<DOWNLOADS_DIR>/<sanitized_playlist_name>/music`.
3. **No-Lyrics Directory Resolution**: `get_playlist_no_lyrics_root(playlist_name)` returns `<DOWNLOADS_DIR>/<sanitized_playlist_name>/no-lyrics`.
4. **Database Path Resolution**: `resolve_file_path(path_str)` resolves relative database paths against `DOWNLOADS_DIR` while leaving absolute paths untouched.
