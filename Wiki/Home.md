# Music Sync — Technical Wiki

**Music Sync** is an automated, self-hosted service that synchronizes YouTube Music playlists with a local music library. It downloads high-quality Opus audio via `yt-dlp`, embeds artwork and metadata, fetches synchronized `.lrc` lyrics from LRCLIB.net, and exposes a React 19 web dashboard for management.

---

## 📖 Navigation

### System Overview
- [System Overview](System-Overview) — Business purpose, capabilities, and deployment model

### Architecture
- [Architecture Overview](Architecture-Overview) — High-level system design, module boundaries, and Mermaid diagram
- [Component Architecture](Component-Architecture) — Detailed breakdown of each subsystem
- [Runtime Architecture](Runtime-Architecture) — Lifespan management, daemon threads, and thread safety
- [Data Flow](Data-Flow) — Sequence diagrams for sync, download, lyrics, and retry workflows
- [Authentication & Authorization](Authentication-and-Authorization) — JWT implementation, password hashing, auth boundaries
- [External Integrations](External-Integrations) — YouTube Music (yt-dlp) and LRCLIB API integration details
- [Resilio Sync Integration](Resilio-Sync-Integration) — Headless P2P file sync, mobile device pairing, and licensing

### Codebase Guide
- [Repository Structure](Repository-Structure) — Directory tree with purpose annotations
- [Module Responsibilities](Module-Responsibilities) — File-level responsibility mapping
- [Core Domain Logic](Core-Domain-Logic) — State machines, status transitions, path resolution
- [Important Workflows](Important-Workflows) — Step-by-step workflow traces

### Database
- [Database Overview](Database-Overview) — Dual-model architecture, connection configuration
- [Schema](Schema) — Complete table and column documentation
- [Relationships](Relationships) — ER diagram, foreign keys, constraints, indexes
- [Data Lifecycle](Data-Lifecycle) — Migration history, auto-seeding, schema evolution

### API
- [API Overview](API-Overview) — REST conventions, router prefixes, content types
- [Endpoints](Endpoints) — Complete endpoint catalog with methods and auth requirements
- [Authentication](Authentication) — Bearer token format, token lifecycle
- [Error Handling](Error-Handling) — Status codes, error response format

### Development
- [Local Setup](Local-Setup) — Prerequisites, Docker and manual setup instructions
- [Configuration](Configuration) — Environment variables and database settings reference
- [Testing](Testing) — Running tests, test module catalog

### Operations
- [Build](Build) — Backend and frontend Docker image build process
- [Deployment](Deployment) — Docker Compose stacks, CI/CD pipeline
- [Monitoring](Monitoring) — Health checks, dashboard status, logging

### Security & Governance
- [Security Model](Security) — Security architecture, implemented controls, known gaps
- [Architecture Decisions](Architecture-Decisions) — Key design decisions and trade-offs
- [Technical Debt & Known Issues](Technical-Debt-and-Known-Issues) — Bugs, debt, and improvement opportunities
