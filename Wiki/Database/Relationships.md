# Database Relationships

## Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    playlists ||--o{ songs : "contains (1:N)"
    songs ||--o| downloaded_tracks : "has (1:1)"
    
    playlists {
        int id PK
        string youtube_playlist_id UK
        string name
        string url
        boolean enabled
        timestamp created_at
        timestamp updated_at
    }

    songs {
        int id PK
        int playlist_id FK
        string youtube_video_id
        string title
        int position
        string download_status
        string lyrics_status
        text file_path
        text lyrics_path
        text error_message
        int download_retry_count
        timestamp next_download_attempt
        timestamp created_at
        timestamp updated_at
    }

    downloaded_tracks {
        int id PK
        int song_id FK,UK
        string youtube_video_id
        text file_path
        string file_format
        int file_size_bytes
        string title
        string artist
        string album
        string album_artist
        string genre
        int track_number
        int duration_seconds
        int release_year
        text thumbnail_url
        text artwork_path
        boolean artwork_embedded
        string metadata_state
        timestamp created_at
        timestamp updated_at
    }

    app_settings {
        int id PK
        int sync_interval_seconds
        int download_limit
        int lyrics_limit
        int max_download_retries
        int download_retry_delay_seconds
        boolean auto_start_scheduler
        string playlist_watch_mode
        int playlist_watch_limit
        boolean delete_local_file_on_playlist_removal
        text youtube_cookies
        timestamp updated_at
    }

    users {
        int id PK
        string username UK
        string password_hash
        boolean must_change_password
        timestamp created_at
        timestamp updated_at
    }
```

---

## Relationship Specifications

### 1. `playlists` → `songs` (One-to-Many)
- **Foreign Key**: `songs.playlist_id` references `playlists.id`.
- **Cascade Rule**: `ON DELETE CASCADE`. Deleting a `Playlist` row automatically deletes all associated `Song` records.
- **ORM Configuration**: `Playlist.songs = relationship("Song", back_populates="playlist", cascade="all, delete-orphan")`.

### 2. `songs` → `downloaded_tracks` (One-to-One)
- **Foreign Key**: `downloaded_tracks.song_id` references `songs.id`.
- **Unique Constraint**: `downloaded_tracks.song_id` is unique (`uq_downloaded_tracks_song_id`), enforcing strict 1:1 mapping.
- **Cascade Rule**: `ON DELETE CASCADE`. Deleting a `Song` row automatically deletes its `DownloadedTrack` record.
- **ORM Configuration**: `Song.downloaded_track = relationship("DownloadedTrack", back_populates="song", uselist=False, cascade="all, delete-orphan")`.

---

## Database Index Catalog

To maintain high query performance during frequent worker polling and REST list queries, the database defines the following indexes:

| Table | Index Name | Type | Indexed Columns | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `playlists` | `playlists_pkey` | `btree` (UNIQUE) | `id` | Primary Key |
| `playlists` | `ix_playlists_youtube_playlist_id` | `btree` (UNIQUE) | `youtube_playlist_id` | Prevent duplicate playlist URLs |
| `songs` | `songs_pkey` | `btree` (UNIQUE) | `id` | Primary Key |
| `songs` | `uq_songs_playlist_video` | `btree` (UNIQUE) | `(playlist_id, youtube_video_id)` | Prevent duplicate tracks per playlist |
| `songs` | `ix_songs_download_status` | `btree` | `download_status` | Speed up `DownloaderWorker` queue polling |
| `songs` | `ix_songs_lyrics_status` | `btree` | `lyrics_status` | Speed up `LyricsWorker` queue polling |
| `songs` | `ix_songs_playlist_id` | `btree` | `playlist_id` | Speed up playlist track listing |
| `songs` | `ix_songs_youtube_video_id` | `btree` | `youtube_video_id` | Fast video ID lookups |
| `downloaded_tracks`| `downloaded_tracks_pkey` | `btree` (UNIQUE) | `id` | Primary Key |
| `downloaded_tracks`| `uq_downloaded_tracks_song_id` | `btree` (UNIQUE) | `song_id` | Enforce 1:1 relationship with `Song` |
| `downloaded_tracks`| `ix_downloaded_tracks_youtube_video_id` | `btree` | `youtube_video_id` | Fast video metadata queries |
| `users` | `users_pkey` | `btree` (UNIQUE) | `id` | Primary Key |
| `users` | `ix_users_username` | `btree` (UNIQUE) | `username` | Fast user login lookup |
