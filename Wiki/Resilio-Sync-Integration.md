# Resilio Sync Integration

**Music Sync** integrates headlessly with **Resilio Sync** (formerly BitTorrent Sync) to provide automatic, high-performance peer-to-peer (P2P) file synchronization between the server library (`/app/downloads`) and mobile devices (iOS, Android, desktop clients).

Resilio Sync runs inside a headless Docker container. Music Sync owns the API, UI dashboard, device pairing, and monitoring experience, while Resilio Sync acts strictly as the background P2P synchronization engine.

---

## 🏗️ Architecture & Component Design

```
┌─────────────────────────────────────────────────────────────┐
│                       Mobile Client                         │
│               (Resilio Sync App - iOS/Android)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ P2P BitTorrent Sync Protocol
                               │ (Port 55555 TCP/UDP)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Resilio Sync Docker Container                │
│                   (resilio/sync:latest)                     │
│  - Headless Engine running on internal WebUI port 8888      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Shared Filesystem Volume
                               │ (/app/downloads ↔ /mnt)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Music Sync Service                       │
│  - FastAPI Backend (app/rslsync/service.py)                  │
│  - React 19 Dashboard UI (/rslsync)                         │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Headless Resilio Engine (`music-sync-resilio`)**:
   - Container running `resilio/sync:latest` listening on internal WebUI port `8888` and P2P listening port `55555`.
   - Mounts the local music downloads directory (`/app/downloads`) read-write.
   - Operates in headless mode (Resilio WebUI is strictly isolated backend-to-backend and never exposed directly to users).

2. **Backend API Proxy Service (`ResilioSyncService`)**:
   - Located in `app/rslsync/service.py` and `app/api/rslsync.py`.
   - Manages token authentication with Resilio (`/gui/token.html`), terms agreement (`action=setlicenseagreed`), and queries `getsyncfolders` for telemetry.
   - Handles secret generation, peer revocation (`removepeer`), and license key activation (`.btskey`).

3. **React 19 Dashboard Page (`/rslsync`)**:
   - Located in `dashboard/src/pages/ResilioSync.jsx` and styled in `dashboard/src/styles/resilioSync.css`.
   - Displays real-time P2P status, completion progress bars, download/upload speeds, paired devices, and active file transfers.
   - Includes a 3-step interactive pairing wizard with SVG QR code rendering.

---

## 🚀 How It Works

### 1. Synchronized Library Volume
Music Sync downloads and enriches songs into `/app/downloads`. Resilio Sync monitors this directory for filesystem changes and automatically delta-syncs newly downloaded audio tracks, album artwork, and `.lrc` lyrics files across connected P2P devices.

### 2. Secret Keys & Permissions
Resilio Sync uses cryptographic keys to manage folder access:
- **Read-Write Secret (`ANHM...`)**: Allows connected mobile devices to sync changes bidirectionally.
- **Read-Only Secret (`BT3K...`)**: Restricts connected devices to receiving files without writing back changes to the server library.

### 3. Engine Licensing (Free vs Pro)
- **Free Mode**: Standard P2P folder synchronization supported out of the box with unlimited bandwidth.
- **Pro License**: Unlocks advanced engine capabilities (Selective Sync, custom folder permissions). Licenses can be uploaded directly via **Settings → Resilio Sync Engine License**.

---

## 📱 How to Use: Adding & Managing Devices

### Adding a Mobile Device (Device Pairing)

1. Open the Music Sync web dashboard and navigate to **Resilio Sync** (`/rslsync`).
2. Click the **+ Add Device** button to launch the 3-step Pairing Wizard.
3. **Step 1 — Folder & Permissions**:
   - Select the target folder (`Music Sync Library`).
   - Select permission level: **Read-Write** (Full Sync) or **Read-Only** (Download Only).
   - Click **Generate Pairing Secret & QR Code**.
4. **Step 2 — Scan QR Code**:
   - Open the **Resilio Sync** mobile app on iOS or Android.
   - Tap **+** → **Scan QR Code**.
   - Point your phone camera at the QR code displayed on the Music Sync screen (or copy the manual secret key).
   - Music Sync will display a live P2P listening beacon ("*Listening for incoming P2P connection...*").
5. **Step 3 — Paired Successfully**:
   - As soon as the mobile device connects, Music Sync automatically detects the new device and displays a success confirmation.

### Disconnecting & Revoking a Device

1. On `/rslsync`, switch to the **Connected Devices** tab.
2. Locate the device card you want to unpair (e.g. `Mobile Phone`).
3. Click **Disconnect Device**.
4. Confirm the prompt. The backend immediately revokes the peer from the Resilio engine via `action=removepeer` and removes it from the paired devices list.

---

## 🛠️ Resilio Engine License Configuration

To activate a Resilio Sync Pro license:

1. Navigate to **Settings** (`/settings`) in the dashboard.
2. Scroll to **Section 9: Resilio Sync Engine License**.
3. Click **How to get a license?** `(i)` for complete purchase and activation instructions.
4. Paste the content of your `.btskey` license file into the text area.
5. Click **Apply License Key**. The engine status will update to `Activated` (`PRO`).

---

## 📡 API Reference

All Resilio Sync endpoints are prefixed with `/api/rslsync`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/rslsync/overview` | Consolidated dashboard overview (status, folders, peers, transfers, errors) |
| `GET` | `/api/rslsync/status` | Real-time P2P sync status and overall progress |
| `GET` | `/api/rslsync/folders` | Monitored sync folders with file counts and storage usage |
| `GET` | `/api/rslsync/peers` | List of paired P2P devices and connection states |
| `DELETE` | `/api/rslsync/peers/{peer_id}` | Revokes and disconnects a paired mobile device |
| `POST` | `/api/rslsync/shares/generate` | Generates secret key, share URL, and SVG QR Code |
| `GET` | `/api/rslsync/pairing-status` | Polls real-time pairing detection status |
| `GET` | `/api/rslsync/transfers` | Active file transfer speeds and progress |
| `GET` | `/api/rslsync/license` | Current engine license status |
| `POST` | `/api/rslsync/license` | Uploads and applies `.btskey` license key |
| `DELETE` | `/api/rslsync/license` | Deletes stored license key file |

---

## 🔍 Troubleshooting & Operational FAQ

### Mobile App Cannot Find Server
- Ensure TCP/UDP port `55555` is open in your VPS firewall / router port forwarding.
- Verify that `music-sync-resilio` container status is `Up` using `docker compose ps`.

### Device Status Shows "Offline"
- Resilio Sync uses direct P2P and fallback relay servers. If both devices are on different networks, initial connection may take 10–30 seconds to establish via relay.

### Inspecting Resilio Container Logs
```bash
docker compose logs -f resilio
```
