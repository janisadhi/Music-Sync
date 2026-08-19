# Build Systems & Containers

## 1. Backend Docker Container (`Dockerfile`)

The backend container definition compiles system dependencies for media processing, installs Deno for YouTube JS challenge solving, and sets up Alembic database migrations.

### Image Specification:
- **Base Image**: `python:3.14-slim`
- **System Dependencies**:
  - `ffmpeg`: Audio conversion and thumbnail embedding.
  - `atomicparsley`: M4A/Opus metadata tagging tool.
  - `deno`: Installed via official script to `/usr/local/bin/deno` for `yt-dlp` EJS anti-bot challenge solving.
  - `curl`, `unzip`: Installed during build and purged in the same layer to minimize image size.
- **Port Exposure**: `8000`
- **Container Entrypoint**:
  ```bash
  sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"
  ```

---

## 2. Frontend Web Dashboard (`dashboard/Dockerfile`)

The React 19 web dashboard utilizes a 2-stage multi-stage Docker build to produce an optimized static asset bundle served via Nginx.

### Multi-Stage Build Specification:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 1: Build Stage (node:22-alpine)                                  │
│   • COPY package.json package-lock.json                                │
│   • RUN npm ci                                                         │
│   • ARG VITE_API_BASE_URL (Default: http://localhost:8000)             │
│   • RUN npm run build  --> Outputs static dist/ bundle                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Copy dist/
┌───────────────────────────────────▼────────────────────────────────────┐
│ Stage 2: Runtime Stage (nginx:stable-alpine3.24-perl)                  │
│   • COPY nginx.conf /etc/nginx/conf.d/default.conf                     │
│   • COPY --from=builder /app/dist /usr/share/nginx/html                │
│   • EXPOSE 80                                                          │
│   • CMD ["nginx", "-g", "daemon off;"]                                 │
└────────────────────────────────────────────────────────────────────────┘
```
