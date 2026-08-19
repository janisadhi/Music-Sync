# Database Overview

## Database Architecture

Music-Sync relies on a single **PostgreSQL 17** database named `music_sync` managed via SQLAlchemy 2.0 ORM and Alembic migrations.

While all tables reside within a single PostgreSQL database schema (`public`), the codebase maintains a **dual-model conceptual separation**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      PostgreSQL 17 Database                            │
│                                                                        │
│   ┌───────────────────────────┐     ┌──────────────────────────────┐   │
│   │         Sync DB           │     │       Music Library DB       │   │
│   │  • playlists              │     │  • downloaded_tracks         │   │
│   │  • songs                  │     │                              │   │
│   │  (Lean sync queues &      │     │  (Rich ID3/Opus metadata     │   │
│   │   status state machines)  │     │   from extracted media)      │   │
│   └─────────────┬─────────────┘     └──────────────┬───────────────┘   │
│                 │                                  │                   │
│                 └─────────────────┬────────────────┘                   │
│                                   │                                    │
│                     ┌─────────────▼──────────────┐                     │
│                     │ Shared Configuration / Auth│                     │
│                     │  • app_settings            │                     │
│                     │  • users                   │                     │
│                     │  • alembic_version         │                     │
│                     └────────────────────────────┘                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Connection Details

- **Database Engine**: PostgreSQL 17.
- **SQLAlchemy Driver**: `psycopg` (`postgresql+psycopg://...`).
- **Connection Session Setup** (`app/database/session.py`):
  - `pool_pre_ping=True`: Tests connections before executing queries to prevent stale connection errors.
  - `autoflush=False`: Prevents premature automatic flushing before explicit commits.
  - `autocommit=False`: Standard transactional session model.
  - `expire_on_commit=False`: Preserves ORM attribute access after commits without triggering extra SQL queries.

---

## Migration Framework

Schema migrations are managed by **Alembic**.

- **Migration Directory**: `alembic/versions/`
- **Current Alembic Revision**: `b1c2d3e4f5a6` (`b1c2d3e4f5a6_refactor_architecture.py`)
- **Auto-Execution**: Backend startup script in Docker executes `alembic upgrade head` automatically before launching Uvicorn.
