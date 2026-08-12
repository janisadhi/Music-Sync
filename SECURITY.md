# Security Policy

Music Sync takes security seriously. We welcome reports from security researchers and users to help keep the project and its deployments secure.

---

## 🛡️ Supported Versions

We provide security updates and patches for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| `v1.x`  | :white_check_mark: |
| `< 1.0` | :x:                |

---

## 📩 Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues or public discussions.**

If you discover a security vulnerability or security bug in Music Sync, please follow responsible disclosure guidelines:

### How to Contact Us
1. **GitHub Private Security Advisory**: Submit a report via the [Security Advisory tab](https://github.com/janisadhi/Music-Sync/security/advisories/new) on the repository.
2. **Direct Email**: Send an email detailing the security issue to:
   - **adhikarijanis@gmail.com**
   - **prod.sibersegment@gmail.com**
   - **sibersegment@gmail.com**

### What to Include in Your Report
To help us triage and validate the issue promptly, please include:
- A descriptive summary of the potential vulnerability.
- Steps to reproduce the issue (including proof-of-concept scripts or payload examples if applicable).
- The affected component (e.g., FastAPI backend, React frontend, database, Docker container configuration).
- Potential impact of exploitation.

### Response Timeline
- **Acknowledgement**: We aim to acknowledge receipt of security reports within **48 hours**.
- **Assessment & Fix**: We will work to validate the vulnerability and release a patch within **7 to 14 days** depending on severity.
- **Disclosure**: Public disclosure will occur after a fix is released and users have had time to update.

---

## 🔒 Security Best Practices for Self-Hosting

When deploying Music Sync in a self-hosted or production environment, observe the following recommended security measures:

### 1. Secrets & Environment Variables
- **Change Default Passwords**: Change default administrative credentials immediately upon initial deployment.
- **PostgreSQL Credentials**: Change `POSTGRES_PASSWORD` in `.env` from default values.
- **Do Not Commit `.env`**: Never commit your production `.env` file to version control.

### 2. Network Isolation & Reverse Proxy
- **Bind Interfaces**: If exposing Music Sync to the internet, put the service behind a secure reverse proxy (e.g., Nginx, Caddy, or Cloudflare Tunnels) enforcing **HTTPS/TLS**.
- **Port Exposure**: Restrict access to backend port `8000` and database port `5432` from untrusted networks; expose only Nginx/Frontend (port `3000`/`80`) externally.

### 3. Container Security
- Run Docker containers with minimal necessary privileges.
- Keep host Docker engine and base system packages up to date.

---

## 🔄 Dependency Security & Updates

- **Upstream Dependencies**: Music Sync relies on third-party packages including `FastAPI`, `yt-dlp`, `SQLAlchemy`, and `React`.
- **Package Updates**: Dependencies are regularly audited for known CVEs. Re-building your container stack using `docker compose build --no-cache` pulls the latest patched library releases.
