# Local Setup & Environment

## Prerequisites

Before setting up Music-Sync locally, ensure your machine meets the following prerequisites:

- **Docker & Docker Compose** (Recommended method)
- *Alternatively for native execution*:
  - **Python**: 3.14+
  - **Node.js**: 22+
  - **PostgreSQL**: 17+
  - **FFmpeg & AtomicParsley**: Required in system `PATH` for media conversion and artwork tagging.
  - **Deno**: Required in system `PATH` for `yt-dlp` YouTube EJS anti-bot challenge solving.

---

## 1. Quickstart with Docker Compose (Recommended)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/janisadhi/Music-Sync.git
   cd Music-Sync
   ```

2. **Configure Environment File**:
   ```bash
   cp .env.example .env
   ```

3. **Start Container Stack**:
   ```bash
   docker compose up -d
   ```

4. **Verify Application Access**:
   - **React Web Dashboard**: `http://localhost:3000`
   - **FastAPI REST API**: `http://localhost:8000`
   - **Swagger OpenAPI Docs**: `http://localhost:8000/docs`
   - **PostgreSQL Database**: `127.0.0.1:5432`

---

## 2. Native Development Setup (Without Docker)

### Backend Setup

```bash
# 1. Create Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure local environment variables (.env)
# Ensure DATABASE_URL points to your local PostgreSQL instance
cp .env.example .env

# 4. Run database migrations
alembic upgrade head

# 5. Launch FastAPI dev server with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd dashboard

# 1. Install Node.js dependencies
npm install

# 2. Start Vite development server
npm run dev
```

---

## Initial Credentials

Upon first launching the stack, login to the web dashboard using default credentials:

- **Username**: `admin`
- **Password**: `admin`

> [!IMPORTANT]
> The system will forcibly redirect you to `/change-password` upon initial login to set a custom administrator password.
