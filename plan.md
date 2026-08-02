# Music Sync - Multi-Playlist & Storage Refactor Plan

## Project Goal

Refactor Music Sync to support multiple YouTube playlists while keeping
the application safe and predictable on a fresh database.

The application should: - Support multiple playlists. - Start with the
scheduler stopped on a fresh database. - Start with synchronization idle
on a fresh database. - Allow users to add playlists from the
dashboard. - Provide detailed playlist management under `/playlists`. -
Move complete synchronization history to `/history`. - Keep the
dashboard focused on monitoring and actions. - Make sync interval,
download limit, and lyrics limit configurable only from `/settings`. -
Allow the user to configure the host download directory from
`/settings`. - Keep PostgreSQL storage completely separate from music
storage. - Store downloaded files using a per-playlist directory
structure.

------------------------------------------------------------------------

# Phase 1 - Establish the Current Baseline

## Objectives

Understand and preserve the currently working application before
changing the architecture.

## Tasks

-   Review the current backend structure.
-   Review database models.
-   Review scheduler implementation.
-   Review synchronization/reconciliation flow.
-   Review dashboard API.
-   Review settings API.
-   Review Docker Compose configuration.
-   Review frontend routing and pages.
-   Confirm current sync behavior.
-   Confirm current database behavior.
-   Identify all places where a single playlist is assumed.

## Completion Criteria

-   Current application starts successfully.
-   Existing sync works.
-   Existing settings work.
-   Current Docker Compose setup is understood.
-   Single-playlist assumptions are documented.

------------------------------------------------------------------------

# Phase 2 - Fresh Database Safety

## Objectives

Make a clean database a valid and supported application state.

## Fresh Database State

``` text
Playlists: 0
Scheduler: STOPPED
Sync: IDLE
```

There must be: - No missing-playlist errors. - No automatic sync
errors. - No scheduler errors. - No assumptions that a playlist already
exists. - No startup failure caused by missing playlist configuration.

## Tasks

-   Remove hard-coded/default playlist assumptions where necessary.
-   Make playlist absence a valid state.
-   Ensure scheduler does not automatically start.
-   Ensure sync safely handles zero playlists.
-   Ensure dashboard works with zero playlists.
-   Ensure settings work with zero playlists.

## Completion Criteria

A completely fresh database can start successfully with zero playlists,
a stopped scheduler, and no sync running.

------------------------------------------------------------------------

# Phase 3 - Multi-Playlist Database Model

## Objectives

Change the backend data model from a single-playlist assumption to
multiple playlists.

## Tasks

-   Review the existing `Playlist` model.
-   Ensure each playlist has its own ID, name, YouTube playlist ID, URL,
    enabled/disabled state, and timestamps.
-   Review the `Song` relationship with playlists.
-   Ensure songs can be associated correctly with their source playlist.
-   Add required constraints/indexes.
-   Create database migration.
-   Ensure existing data can migrate safely.

## Completion Criteria

The database can contain multiple playlists without conflicts or
single-playlist assumptions.

------------------------------------------------------------------------

# Phase 4 - Multi-Playlist Reconciliation

## Objectives

Update synchronization so each playlist can be synchronized
independently.

## Sync Flow

``` text
Scheduler
    |
    +--> Playlist 1
    +--> Playlist 2
    +--> Playlist 3
    +--> ...
```

## Tasks

-   Update playlist reconciliation logic.
-   Ensure each playlist gets its own songs.
-   Prevent duplicate songs within the same playlist.
-   Correctly handle songs removed from a YouTube playlist.
-   Preserve playlist ownership/association.
-   Ensure one failed playlist does not crash the entire scheduler.
-   Add clear per-playlist error handling.
-   Ensure disabled playlists are skipped.
-   Ensure zero playlists is safe.

## Completion Criteria

Multiple enabled playlists can be synchronized successfully. A failure
in one playlist must not prevent the scheduler from processing the
remaining playlists.

------------------------------------------------------------------------

# Phase 5 - Scheduler Refactor

## Objectives

Make the scheduler explicitly operate on multiple playlists.

## Behavior

Fresh installation:

``` text
Scheduler: STOPPED
```

User explicitly starts it:

``` text
Scheduler: RUNNING
```

When running:

``` text
Scheduler
    |
    +--> enabled playlist 1
    +--> enabled playlist 2
    +--> enabled playlist 3
```

## Tasks

-   Remove assumptions about one playlist.
-   Skip disabled playlists.
-   Handle zero playlists.
-   Keep scheduler start/stop controls.
-   Keep sync interval configurable from Settings only.
-   Ensure changing the interval does not unintentionally start the
    scheduler.
-   Ensure scheduler state is predictable after restart.

## Completion Criteria

Scheduler behavior is stable with zero, one, or multiple playlists,
including disabled and failed playlists.

------------------------------------------------------------------------

# Phase 6 - Download Storage Architecture

## Objectives

Separate music storage from PostgreSQL storage.

## User Configuration

The user chooses a host directory from Settings.

Example:

``` text
/home/janis/Music
```

Docker Compose concept:

``` text
${MUSIC_DOWNLOAD_PATH}:/music
```

## Important Rule

The configurable download directory is ONLY for music-related files.

It must not contain PostgreSQL files or database data.

PostgreSQL remains on its own Docker volume.

## Storage Structure

``` text
/music/
├── Playlist 1/
│   ├── music/
│   └── no-lyric/
├── Playlist 2/
│   ├── music/
│   └── no-lyric/
└── Playlist 3/
    ├── music/
    └── no-lyric/
```

## Rules

Songs with lyrics go into `Playlist/music/`. Songs without lyrics go
into `Playlist/no-lyric/`.

## Tasks

-   Add configurable download path.
-   Validate the configured path.
-   Update Docker Compose volume configuration.
-   Keep PostgreSQL volume independent.
-   Generate playlist-specific directories.
-   Update download logic.
-   Update no-lyrics handling.
-   Prevent files from different playlists being mixed.
-   Handle playlist names safely for filesystem paths.

## Important Docker Constraint

Changing the host directory cannot dynamically change an existing Docker
bind mount.

Therefore: 1. Save the configured path. 2. Validate it. 3. Apply it to
Docker Compose. 4. Recreate/restart the application container when
necessary.

The PostgreSQL container/volume must remain untouched.

## Completion Criteria

Changing the download directory changes only music storage. PostgreSQL
data remains persistent and independent.

------------------------------------------------------------------------

# Phase 7 - Settings Refactor

## Objectives

Make Settings the single location for global synchronization
configuration.

## Settings

### Synchronization

-   Sync interval
-   Download limit
-   Lyrics limit

### Storage

-   Download directory

Playlist configuration should not be managed as global settings.

## Tasks

-   Keep sync interval editing in Settings.
-   Keep download limit editing in Settings.
-   Keep lyrics limit editing in Settings.
-   Add download directory configuration.
-   Add validation and error handling.
-   Remove playlist configuration from global settings if currently
    present.
-   Ensure settings work with zero playlists.

## Completion Criteria

All global configuration is handled from `/settings`.

------------------------------------------------------------------------

# Phase 8 - Playlist Management UI

## Objectives

Create dedicated playlist management.

## Dashboard

Add an `Add Playlist` action in the top-right corner.

The action opens a form/modal for the YouTube playlist URL.

## `/playlists`

Show all playlists with: - Name - Song count - Enabled/disabled status -
Sync information - Basic actions

## Playlist Detail

Provide detailed controls for an individual playlist: - Sync playlist -
Enable/disable - Delete - Open YouTube - View songs - View
playlist-specific statistics

## Completion Criteria

Users can add, view, manage, enable/disable, remove, and manually
synchronize playlists.

------------------------------------------------------------------------

# Phase 9 - Dashboard Cleanup

## Objectives

Keep the dashboard focused on monitoring and operational actions.

## Dashboard Should Show

### Statistics

-   Total songs
-   Downloaded songs
-   Pending downloads
-   Failed downloads
-   Lyrics completed
-   Lyrics pending
-   Lyrics unavailable
-   Lyrics failed

### Scheduler

-   Running/stopped
-   Sync running/idle
-   Sync interval
-   Download limit
-   Lyrics limit

These values are read-only.

### Actions

-   Start scheduler
-   Stop scheduler
-   Sync now
-   Add playlist

### Playlist Summary

Show a concise playlist overview or link to `/playlists`.

## Remove From Dashboard

-   Sync interval input
-   Update interval button
-   Full sync history table
-   Detailed playlist configuration

## Completion Criteria

Dashboard contains no configuration controls for global settings.

------------------------------------------------------------------------

# Phase 10 - Sync History Page

## Objectives

Move synchronization history out of the dashboard.

## Route

``` text
/history
```

## Features

Show: - Sync status - Started at - Completed at - Duration - Error -
Playlist information where applicable

## Tasks

-   Create proper history API endpoint.
-   Create `SyncHistory` page.
-   Move the existing history table from Dashboard.
-   Add pagination/limits if required.
-   Add playlist filtering if useful.
-   Ensure history works with zero records.

## Completion Criteria

The dashboard no longer contains the full history table. All history is
available under `/history`.

------------------------------------------------------------------------

# Phase 11 - Frontend Routing & Navigation

## Objectives

Finalize application navigation.

## Navigation

``` text
Dashboard
Playlists
History
Settings
```

## Routes

``` text
/
 /playlists
 /playlists/:id
 /history
 /settings
```

## Tasks

-   Add/update routes.
-   Update sidebar navigation.
-   Set active navigation state correctly.
-   Remove obsolete routes/components.
-   Ensure direct navigation works.
-   Ensure page refresh works.

------------------------------------------------------------------------

# Phase 12 - API Cleanup

## Objectives

Align backend API endpoints with the new architecture.

## Expected API Areas

### Dashboard

``` text
GET /dashboard
```

### Playlists

``` text
GET    /playlists
POST   /playlists
GET    /playlists/{id}
PATCH  /playlists/{id}
DELETE /playlists/{id}
POST   /playlists/{id}/sync
```

### History

``` text
GET /history
```

### Settings

``` text
GET   /settings
PATCH /settings
```

### Scheduler

``` text
POST /sync/scheduler/start
POST /sync/scheduler/stop
```

### Sync

``` text
POST /sync
```

The exact endpoint names can be adjusted to match the existing backend
architecture.

## Completion Criteria

No API endpoint assumes only one playlist.

------------------------------------------------------------------------

# Phase 13 - Error Handling & Edge Cases

## Test Cases

### Fresh database

``` text
0 playlists
scheduler stopped
sync idle
```

### Add one playlist

``` text
1 playlist
scheduler stopped
manual sync works
```

### Add multiple playlists

All playlists can sync independently.

### Disabled playlist

Disabled playlists are skipped by the scheduler.

### Deleted playlist

Playlist and its related behavior are handled safely.

### Invalid YouTube URL

Application returns a clear validation error.

### Empty playlist

Application does not crash.

### One playlist fails

Other playlists continue processing.

### Invalid download directory

Application provides a clear error.

### Non-writable download directory

Application provides a clear error.

### Download directory changed

New files use the new location.

### Fresh Docker deployment

Application starts without requiring an existing playlist.

------------------------------------------------------------------------

# Phase 14 - Docker & Deployment Verification

## Objectives

Verify the complete architecture in Docker.

## Verify

-   App container starts.
-   PostgreSQL starts.
-   PostgreSQL data persists.
-   Music volume persists.
-   Configured host download directory is mounted correctly.
-   Changing download path does not affect PostgreSQL.
-   Scheduler starts stopped.
-   Sync starts idle.
-   Multiple playlists sync correctly.
-   Containers restart without losing configuration/data.

## Final Volume Separation

``` text
Docker
│
├── app
│   └── /music
│       ├── Playlist 1/
│       ├── Playlist 2/
│       └── Playlist 3/
│
└── postgres
    └── postgres_data
```

------------------------------------------------------------------------

# Phase 15 - Final Cleanup & Documentation

## Tasks

-   Remove obsolete single-playlist code.
-   Remove unused frontend components.
-   Remove obsolete CSS.
-   Remove unused API endpoints.
-   Clean imports.
-   Add comments only where useful.
-   Update README.
-   Document environment variables.
-   Document Docker volume configuration.
-   Document backup considerations.
-   Document fresh-install behavior.
-   Document playlist storage structure.

------------------------------------------------------------------------

# Phase Execution Rule

Work through the phases sequentially.

Do not implement future phases prematurely unless required by the
current phase.

Before starting a phase:

1.  Inspect the current code.
2.  Identify the files affected.
3.  Make the smallest necessary changes.
4.  Test the phase.
5.  Confirm the application still works.
6.  Only then move to the next phase.

## Current Starting Point

``` text
Phase 1 - Establish the Current Baseline
```

The user will explicitly state which phase to continue from if the
conversation is interrupted.
