import { useEffect, useState } from "react";
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Download,
    FileText,
    HardDrive,
    HelpCircle,
    Key,
    Lock,
    RefreshCw,
    RotateCcw,
    Save,
    ShieldCheck,
    Sliders,
    Sparkles,
    Trash2,
    X,
    Zap,
} from "lucide-react";
import api from "../services/api";
import "../styles/settings.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateString) {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);
    if (diffSeconds < 5) return "Just now";
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const minutes = Math.floor(diffSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function Settings() {
    const [settings, setSettings] = useState({
        sync_interval_seconds: 60,
        download_limit: 1,
        lyrics_limit: 1,
        max_download_retries: 5,
        download_retry_delay_seconds: 60,
        auto_start_scheduler: false,
        playlist_watch_mode: "whole",
        playlist_watch_limit: 10,
        delete_local_file_on_playlist_removal: false,
        auto_scan_metadata_enabled: true,
        auto_rename_files: true,
        min_confidence_threshold: "MEDIUM",
        clean_youtube_titles: true,
    });

    // YouTube Cookie state
    const [hasYoutubeCookies, setHasYoutubeCookies] = useState(false);
    const [youtubeCookiesInput, setYoutubeCookiesInput] = useState("");
    const [showCookieGuide, setShowCookieGuide] = useState(false);
    const [clearingCookies, setClearingCookies] = useState(false);

    // Live status from /sync/status
    const [syncStatus, setSyncStatus] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // Scheduler action loading flag
    const [schedulerLoading, setSchedulerLoading] = useState(false);

    // Confirmation dialog for the destructive toggle
    const [showDeleteWarning, setShowDeleteWarning] = useState(false);
    const [pendingDeleteValue, setPendingDeleteValue] = useState(false);

    useEffect(() => {
        loadAll();
        // Poll status every 5 seconds while on this page
        const timer = setInterval(loadStatus, 5000);
        return () => clearInterval(timer);
    }, []);

    async function loadAll() {
        try {
            setLoading(true);
            setError("");
            const [settingsRes, statusRes] = await Promise.all([
                api.get("/settings"),
                api.get("/sync/status"),
            ]);
            setSettings({
                ...settingsRes.data,
                playlist_watch_limit: settingsRes.data.playlist_watch_limit ?? 10,
            });
            setHasYoutubeCookies(Boolean(settingsRes.data.has_youtube_cookies));
            setSyncStatus(statusRes.data);
        } catch (err) {
            console.error("Failed to load settings:", err);
            setError("Unable to load application settings.");
        } finally {
            setLoading(false);
        }
    }

    async function loadStatus() {
        try {
            const res = await api.get("/sync/status");
            setSyncStatus(res.data);
        } catch {
            // silent — don't clobber a user-visible error
        }
    }

    function handleChange(event) {
        const { name, value, type } = event.target;
        setSettings((current) => ({
            ...current,
            [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
        }));
        setMessage("");
        setError("");
    }

    function handleCheckboxChange(event) {
        const { name, checked } = event.target;
        setSettings((current) => ({ ...current, [name]: checked }));
        setMessage("");
        setError("");
    }

    // Destructive toggle — show confirmation before applying
    function handleDeleteLocalChange(event) {
        const { checked } = event.target;
        if (checked) {
            // Enabling is destructive — require confirmation
            setPendingDeleteValue(true);
            setShowDeleteWarning(true);
        } else {
            setSettings((current) => ({
                ...current,
                delete_local_file_on_playlist_removal: false,
            }));
            setMessage("");
            setError("");
        }
    }

    function confirmDeleteLocal() {
        setSettings((current) => ({
            ...current,
            delete_local_file_on_playlist_removal: pendingDeleteValue,
        }));
        setShowDeleteWarning(false);
        setMessage("");
        setError("");
    }

    function cancelDeleteLocal() {
        setShowDeleteWarning(false);
        setPendingDeleteValue(false);
    }

    async function handleClearCookies() {
        try {
            setClearingCookies(true);
            setMessage("");
            setError("");
            const res = await api.patch("/settings", { youtube_cookies: "" });
            setHasYoutubeCookies(Boolean(res.data.has_youtube_cookies));
            setYoutubeCookiesInput("");
            setMessage("YouTube cookies cleared.");
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to clear cookies.");
        } finally {
            setClearingCookies(false);
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (settings.playlist_watch_mode === "last_n") {
            const limit = Number(settings.playlist_watch_limit);
            if (!limit || limit < 1 || !Number.isInteger(limit)) {
                setError("Number of songs for 'Last N' mode must be a positive integer.");
                return;
            }
        }

        try {
            setSaving(true);
            setMessage("");
            setError("");

            const payload = {
                sync_interval_seconds: settings.sync_interval_seconds,
                download_limit: settings.download_limit,
                lyrics_limit: settings.lyrics_limit,
                max_download_retries: settings.max_download_retries,
                download_retry_delay_seconds: settings.download_retry_delay_seconds,
                auto_start_scheduler: settings.auto_start_scheduler,
                playlist_watch_mode: settings.playlist_watch_mode,
                playlist_watch_limit:
                    settings.playlist_watch_mode === "last_n"
                        ? Number(settings.playlist_watch_limit)
                        : null,
                delete_local_file_on_playlist_removal:
                    settings.delete_local_file_on_playlist_removal,
            };

            if (youtubeCookiesInput.trim()) {
                payload.youtube_cookies = youtubeCookiesInput.trim();
            }

            const response = await api.patch("/settings", payload);

            setSettings({
                ...response.data,
                playlist_watch_limit: response.data.playlist_watch_limit ?? 10,
            });
            setHasYoutubeCookies(Boolean(response.data.has_youtube_cookies));
            setYoutubeCookiesInput("");
            setMessage("Settings saved successfully.");

            // Refresh status to reflect any interval change
            await loadStatus();
        } catch (err) {
            console.error("Failed to save settings:", err);
            setError(err.response?.data?.detail || "Unable to save settings.");
        } finally {
            setSaving(false);
        }
    }

    // Scheduler actions
    async function handleStartScheduler() {
        try {
            setSchedulerLoading(true);
            setMessage("");
            setError("");
            const res = await api.post("/sync/scheduler/start");
            setMessage(res.data.message || "Scheduler started.");
            await loadStatus();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to start scheduler.");
        } finally {
            setSchedulerLoading(false);
        }
    }

    async function handleStopScheduler() {
        try {
            setSchedulerLoading(true);
            setMessage("");
            setError("");
            const res = await api.post("/sync/scheduler/stop");
            setMessage(res.data.message || "Scheduler stopped.");
            await loadStatus();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to stop scheduler.");
        } finally {
            setSchedulerLoading(false);
        }
    }



    if (loading) {
        return (
            <div className="settings-loading-screen">
                <RefreshCw className="spin-icon" size={32} />
                <p>Loading application settings...</p>
            </div>
        );
    }

    const schedulerRunning = syncStatus?.scheduler_running ?? false;
    const syncRunning = syncStatus?.sync_running ?? false;
    const downloaderRunning = syncStatus?.downloader_worker?.worker_running ?? false;
    const downloaderStatus = syncStatus?.downloader_worker ?? {};

    return (
        <div className="settings-container">
            {/* Header */}
            <header className="settings-header">
                <div>
                    <h1>System Settings</h1>
                    <p className="subtitle">
                        Configure playlist scanning, synchronization, downloader, and service management.
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={loadAll} disabled={saving}>
                    <RefreshCw size={15} /> Reset
                </button>
            </header>

            {/* Notification Alerts */}
            {message && (
                <div className="settings-alert-banner alert-success">
                    <CheckCircle2 size={18} />
                    <span>{message}</span>
                </div>
            )}
            {error && (
                <div className="settings-alert-banner alert-error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* ----------------------------------------------------------------
                Destructive action confirmation dialog
            ---------------------------------------------------------------- */}
            {showDeleteWarning && (
                <div className="settings-warning-modal-overlay">
                    <div className="settings-warning-modal">
                        <div className="warning-modal-header">
                            <Trash2 size={22} className="warning-icon" />
                            <h3>Enable Permanent File Deletion?</h3>
                        </div>
                        <p className="warning-modal-body">
                            With this option enabled, whenever a song is removed from a YouTube
                            playlist and Music Sync detects that removal during reconciliation,
                            the local audio file and any associated lyrics file will be
                            <strong> permanently deleted from disk</strong>. This cannot be undone.
                        </p>
                        <p className="warning-modal-body" style={{ marginTop: "10px" }}>
                            Only enable this if you intentionally want your local music library
                            to mirror the YouTube playlist exactly.
                        </p>
                        <div className="warning-modal-actions">
                            <button className="btn btn-ghost" onClick={cancelDeleteLocal}>
                                Cancel
                            </button>
                            <button className="btn btn-danger-soft" onClick={confirmDeleteLocal}>
                                <Trash2 size={15} /> Yes, Enable File Deletion
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="settings-form-layout">

                {/* ============================================================
                    SECTION 1 – Scheduler & Automation
                    ============================================================ */}
                <div className="settings-card">
                    <div className="card-section-header">
                        <Clock size={20} className="section-icon green" />
                        <div>
                            <h3>Sync Scheduler</h3>
                            <p>Control automatic playlist synchronization timing and scheduler state.</p>
                        </div>
                    </div>

                    <div className="service-status-row" style={{ marginBottom: "20px" }}>
                        <div className="service-status-left">
                            <span className={`status-beacon-sm ${schedulerRunning ? "running" : "stopped"}`} />
                            <div>
                                <span className="service-name">Scheduler State</span>
                                <p className="service-desc">
                                    {schedulerRunning
                                        ? syncRunning
                                            ? "Active — playlist sync cycle in progress"
                                            : `Active — next sync in ~${settings.sync_interval_seconds}s`
                                        : "Inactive — playlist sync will not run automatically"}
                                </p>
                            </div>
                        </div>
                        <div className="service-actions">
                            {schedulerRunning ? (
                                <button
                                    type="button"
                                    className="btn btn-danger-soft btn-sm"
                                    onClick={handleStopScheduler}
                                    disabled={schedulerLoading}
                                >
                                    {schedulerLoading ? <RefreshCw size={13} className="spin-icon" /> : null}
                                    Stop Scheduler
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-success-soft btn-sm"
                                    onClick={handleStartScheduler}
                                    disabled={schedulerLoading}
                                >
                                    {schedulerLoading ? <RefreshCw size={13} className="spin-icon" /> : null}
                                    Start Scheduler
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="setting-row toggle-row">
                        <div className="setting-info">
                            <label htmlFor="auto_start_scheduler" className="setting-label">
                                Auto-start Scheduler on Startup
                            </label>
                            <p className="setting-desc">
                                Automatically start the Sync Scheduler when the application launches.
                            </p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                id="auto_start_scheduler"
                                name="auto_start_scheduler"
                                type="checkbox"
                                checked={Boolean(settings.auto_start_scheduler)}
                                onChange={handleCheckboxChange}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="sync_interval_seconds" className="setting-label">
                                Sync Interval
                            </label>
                            <p className="setting-desc">
                                How often the Scheduler triggers a playlist scan. Minimum 10 seconds.
                                Applied immediately to a running scheduler without requiring a restart.
                            </p>
                        </div>
                        <div className="input-with-unit">
                            <input
                                id="sync_interval_seconds"
                                name="sync_interval_seconds"
                                type="number"
                                min="10"
                                value={settings.sync_interval_seconds}
                                onChange={handleChange}
                            />
                            <span className="unit-tag">sec</span>
                        </div>
                    </div>
                </div>

                {/* ============================================================
                    SECTION 3 – Playlist Watching
                    ============================================================ */}
                <div className="settings-card">
                    <div className="card-section-header">
                        <Sliders size={20} className="section-icon blue" />
                        <div>
                            <h3>Playlist Watching</h3>
                            <p>
                                Configure how Music Sync scans YouTube playlists for new or removed tracks.
                                Scanning is lightweight — only video IDs and titles are fetched.
                            </p>
                        </div>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <label className="setting-label">Watch Strategy</label>
                            <p className="setting-desc">
                                <strong>Whole playlist</strong> — scans every item in the playlist each sync cycle.
                                Best for small-to-medium playlists or when you need reliable removal detection.
                                <br />
                                <strong>Last N songs</strong> — only scans the first and last N entries.
                                Faster for large playlists but skips removal detection (songs outside the window are never checked for deletion).
                            </p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <label className="radio-option">
                                <input
                                    type="radio"
                                    name="playlist_watch_mode"
                                    value="whole"
                                    checked={settings.playlist_watch_mode === "whole"}
                                    onChange={handleChange}
                                />
                                Whole playlist
                            </label>
                            <label className="radio-option">
                                <input
                                    type="radio"
                                    name="playlist_watch_mode"
                                    value="last_n"
                                    checked={settings.playlist_watch_mode === "last_n"}
                                    onChange={handleChange}
                                />
                                Last N songs
                            </label>
                        </div>
                    </div>

                    {settings.playlist_watch_mode === "last_n" && (
                        <div className="setting-row">
                            <div className="setting-info">
                                <label htmlFor="playlist_watch_limit" className="setting-label">
                                    N — Number of Songs to Watch
                                </label>
                                <p className="setting-desc">
                                    Music Sync will scan the first N and last N entries of each playlist
                                    (top and bottom), deduplicating overlaps. Newly added songs at either
                                    end of the playlist will be detected.
                                </p>
                            </div>
                            <div className="input-with-unit">
                                <input
                                    id="playlist_watch_limit"
                                    name="playlist_watch_limit"
                                    type="number"
                                    min="1"
                                    value={settings.playlist_watch_limit}
                                    onChange={handleChange}
                                />
                                <span className="unit-tag">songs</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* ============================================================
                    SECTION 4 – Downloader
                    ============================================================ */}
                <div className="settings-card">
                    <div className="card-section-header">
                        <Download size={20} className="section-icon purple" />
                        <div>
                            <h3>Downloader</h3>
                            <p>
                                The Downloader worker runs independently and continuously polls for
                                pending songs. These settings control concurrency and retry behaviour.
                            </p>
                        </div>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="download_limit" className="setting-label">
                                Download Concurrency
                            </label>
                            <p className="setting-desc">
                                Maximum number of audio tracks downloaded simultaneously by the Downloader
                                worker on each polling pass. Increase for faster throughput; decrease to
                                reduce bandwidth and CPU usage.
                            </p>
                        </div>
                        <div className="input-with-unit">
                            <input
                                id="download_limit"
                                name="download_limit"
                                type="number"
                                min="1"
                                value={settings.download_limit}
                                onChange={handleChange}
                            />
                            <span className="unit-tag">parallel</span>
                        </div>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="lyrics_limit" className="setting-label">
                                Lyrics Fetch Concurrency
                            </label>
                            <p className="setting-desc">
                                Maximum number of lyrics requests processed simultaneously per sync cycle.
                            </p>
                        </div>
                        <div className="input-with-unit">
                            <input
                                id="lyrics_limit"
                                name="lyrics_limit"
                                type="number"
                                min="1"
                                value={settings.lyrics_limit}
                                onChange={handleChange}
                            />
                            <span className="unit-tag">parallel</span>
                        </div>
                    </div>
                </div>

                {/* ============================================================
                    SECTION 5 – Retry Policy
                    ============================================================ */}
                <div className="settings-card">
                    <div className="card-section-header">
                        <RotateCcw size={20} className="section-icon orange" />
                        <div>
                            <h3>Retry Policy</h3>
                            <p>Configure automatic recovery for transient download failures.</p>
                        </div>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="max_download_retries" className="setting-label">
                                Maximum Download Retries
                            </label>
                            <p className="setting-desc">
                                How many times to retry a failed download before marking it permanently
                                failed. Permanent failures (unavailable / private / deleted videos) are
                                never retried regardless of this value.
                            </p>
                        </div>
                        <div className="input-with-unit">
                            <input
                                id="max_download_retries"
                                name="max_download_retries"
                                type="number"
                                min="1"
                                value={settings.max_download_retries}
                                onChange={handleChange}
                            />
                            <span className="unit-tag">attempts</span>
                        </div>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="download_retry_delay_seconds" className="setting-label">
                                Retry Base Delay
                            </label>
                            <p className="setting-desc">
                                Base wait time before the first retry. Each subsequent retry doubles
                                the delay (exponential backoff): retry 1 = delay, retry 2 = 2× delay,
                                retry 3 = 4× delay, etc.
                            </p>
                        </div>
                        <div className="input-with-unit">
                            <input
                                id="download_retry_delay_seconds"
                                name="download_retry_delay_seconds"
                                type="number"
                                min="1"
                                value={settings.download_retry_delay_seconds}
                                onChange={handleChange}
                            />
                            <span className="unit-tag">sec</span>
                        </div>
                    </div>
                </div>

                {/* ============================================================
                    SECTION 6 – File Management
                    ============================================================ */}
                <div className="settings-card">
                    <div className="card-section-header">
                        <HardDrive size={20} className="section-icon orange" />
                        <div>
                            <h3>File Management</h3>
                            <p>Control what happens to local files when playlists change.</p>
                        </div>
                    </div>

                    <div className="setting-row toggle-row">
                        <div className="setting-info">
                            <label htmlFor="delete_local_file_on_playlist_removal" className="setting-label">
                                Delete Local File on Playlist Removal
                            </label>
                            <div className="setting-desc">
                                <p>
                                    When enabled, if a song is removed from a YouTube playlist and
                                    Music Sync detects that removal during a sync cycle, the downloaded
                                    audio file and lyrics file will be <strong>permanently deleted from disk</strong>.
                                </p>
                                <p style={{ marginTop: "6px" }}>
                                    When disabled (default), only the playlist relationship is removed
                                    from the database. Your local audio files are kept intact.
                                </p>
                                {settings.delete_local_file_on_playlist_removal && (
                                    <div className="destructive-warning-inline">
                                        <AlertTriangle size={14} />
                                        <span>
                                            Active — playlist removals will permanently delete local files.
                                            This only applies to songs in <strong>whole playlist</strong> watch mode,
                                            since last-N mode does not check for removals.
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                id="delete_local_file_on_playlist_removal"
                                name="delete_local_file_on_playlist_removal"
                                type="checkbox"
                                checked={Boolean(settings.delete_local_file_on_playlist_removal)}
                                onChange={handleDeleteLocalChange}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>
                </div>

                {/* ============================================================
                    SECTION 7 – Metadata & Enrichment Settings
                    ============================================================ */}
                <div className="settings-card">
                    <div className="card-section-header">
                        <Sparkles size={20} className="section-icon blue" style={{ color: "#2563eb" }} />
                        <div>
                            <h3>Metadata & Enrichment Settings</h3>
                            <p>Configure automatic library scanning, file renaming, MusicBrainz confidence thresholds, and title parsing.</p>
                        </div>
                    </div>

                    {/* Auto Scan Metadata Toggle */}
                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="auto_scan_metadata_enabled" className="setting-label">
                                Auto Scan & Enrich Metadata
                            </label>
                            <p className="setting-desc">
                                Automatically trigger metadata enrichment using MusicBrainz and Beets after new audio files are downloaded.
                            </p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                id="auto_scan_metadata_enabled"
                                name="auto_scan_metadata_enabled"
                                type="checkbox"
                                checked={Boolean(settings.auto_scan_metadata_enabled)}
                                onChange={handleChange}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>

                    {/* Auto Rename Files Toggle */}
                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="auto_rename_files" className="setting-label">
                                Auto Rename Files & Lyrics
                            </label>
                            <p className="setting-desc">
                                Automatically rename audio files and matching <code>.lrc</code> lyrics files to <code>Artist Name - Music Title.ext</code> upon enrichment.
                            </p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                id="auto_rename_files"
                                name="auto_rename_files"
                                type="checkbox"
                                checked={Boolean(settings.auto_rename_files)}
                                onChange={handleChange}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>

                    {/* Clean YouTube Noise Titles Toggle */}
                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="clean_youtube_titles" className="setting-label">
                                Strip YouTube Noise Tags
                            </label>
                            <p className="setting-desc">
                                Automatically clean video titles by removing tags like <code>(Official Audio)</code>, <code>[Visualizer]</code>, <code>(Official Video)</code>, and remaster badges.
                            </p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                id="clean_youtube_titles"
                                name="clean_youtube_titles"
                                type="checkbox"
                                checked={Boolean(settings.clean_youtube_titles)}
                                onChange={handleChange}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>

                    {/* Minimum Confidence Threshold */}
                    <div className="setting-row">
                        <div className="setting-info">
                            <label htmlFor="min_confidence_threshold" className="setting-label">
                                MusicBrainz Match Confidence Threshold
                            </label>
                            <p className="setting-desc">
                                Minimum confidence required to mark metadata as <strong>Enriched</strong> and apply external MusicBrainz album/year data.
                            </p>
                        </div>
                        <div className="setting-control">
                            <select
                                id="min_confidence_threshold"
                                name="min_confidence_threshold"
                                className="setting-input select-input"
                                value={settings.min_confidence_threshold || "MEDIUM"}
                                onChange={handleChange}
                            >
                                <option value="MEDIUM">Medium Confidence (Recommended)</option>
                                <option value="HIGH">Strict High Confidence Only</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* ============================================================
                    SECTION 8 – YouTube Authentication / Cookies (Optional)
                    ============================================================ */}
                <div className="settings-card">
                    <div className="card-section-header">
                        <Key size={20} className="section-icon purple" />
                        <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                                <div>
                                    <h3>YouTube Authentication & Cookies</h3>
                                    <p>Optional cookie configuration for age-restricted videos and restricted playback.</p>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span className={`cookie-status-badge ${hasYoutubeCookies ? "configured" : "not-configured"}`}>
                                        {hasYoutubeCookies ? (
                                            <>
                                                <CheckCircle2 size={13} /> Configured
                                            </>
                                        ) : (
                                            "Not Configured"
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setShowCookieGuide(true)}
                                    >
                                        <HelpCircle size={14} /> How to get cookies?
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "12px" }}>
                        <div className="setting-info" style={{ maxWidth: "100%" }}>
                            <label htmlFor="youtube_cookies" className="setting-label">
                                YouTube Cookies (Netscape format)
                            </label>
                            <p className="setting-desc">
                                Paste your exported YouTube cookies in Netscape format below. Cookies are <strong>completely optional</strong> and only used when downloading restricted tracks.
                            </p>
                        </div>

                        <div className="cookie-input-wrapper">
                            <textarea
                                id="youtube_cookies"
                                name="youtube_cookies"
                                rows={5}
                                className="cookie-textarea"
                                placeholder={
                                    hasYoutubeCookies
                                        ? "YouTube cookies are currently configured and saved securely. To update, paste a new Netscape format cookie string here."
                                        : "Paste Netscape cookie file content here (# Netscape HTTP Cookie File...)"
                                }
                                value={youtubeCookiesInput}
                                onChange={(e) => setYoutubeCookiesInput(e.target.value)}
                            />
                        </div>

                        <div className="cookie-footer-row">
                            <div className="cookie-security-notice">
                                <ShieldCheck size={14} className="security-icon" />
                                <span>Cookies are stored securely, never logged, and omitted from API responses.</span>
                            </div>
                            {hasYoutubeCookies && (
                                <button
                                    type="button"
                                    className="btn btn-danger-soft btn-sm"
                                    onClick={handleClearCookies}
                                    disabled={clearingCookies}
                                >
                                    {clearingCookies ? <RefreshCw size={13} className="spin-icon" /> : <Trash2 size={13} />} Clear Cookies
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Save Bar */}
                <div className="settings-save-footer">
                    <button type="submit" disabled={saving} className="btn btn-primary btn-lg">
                        <Save size={18} />
                        {saving ? "Saving Changes..." : "Save Settings"}
                    </button>
                </div>
            </form>

            {/* ----------------------------------------------------------------
                How to get YouTube cookies modal guide
            ---------------------------------------------------------------- */}
            {showCookieGuide && (
                <div className="settings-warning-modal-overlay">
                    <div className="settings-warning-modal cookie-guide-modal">
                        <div className="warning-modal-header">
                            <Key size={22} className="warning-icon purple" style={{ color: "#a855f7" }} />
                            <h3>How to Get YouTube Cookies</h3>
                            <button
                                type="button"
                                className="modal-close-btn"
                                onClick={() => setShowCookieGuide(false)}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="cookie-guide-body">
                            <div className="guide-callout info">
                                <ShieldCheck size={16} />
                                <span>
                                    <strong>Cookies are 100% Optional.</strong> Normal YouTube videos download without any cookie configuration.
                                </span>
                            </div>

                            <h4 className="guide-step-title">1. When are cookies needed?</h4>
                            <p className="warning-modal-body">
                                YouTube cookies are useful if you want to download <strong>age-restricted videos</strong>, private/unlisted playlists you own, or if YouTube applies strict anti-bot playback restrictions to specific videos in your library.
                            </p>

                            <h4 className="guide-step-title">2. How to export cookies from your browser</h4>
                            <ol className="guide-steps-list">
                                <li>Open your browser (Chrome, Firefox, Edge, or Brave) and go to <strong>YouTube.com</strong> while signed in.</li>
                                <li>Install a browser extension for exporting cookies in Netscape format, such as <strong>"Get cookies.txt LOCALLY"</strong> (available on Chrome Web Store and Firefox Add-ons).</li>
                                <li>Click the extension icon while on YouTube and select <strong>Export</strong> or <strong>Download</strong> (Netscape format).</li>
                            </ol>

                            <h4 className="guide-step-title">3. How to save them in Music Sync</h4>
                            <ol className="guide-steps-list">
                                <li>Open the downloaded <code>cookies.txt</code> file in a text editor.</li>
                                <li>Copy all the text (starting with <code># Netscape HTTP Cookie File</code>).</li>
                                <li>Paste the text into the <strong>YouTube Cookies</strong> text area on this page and click <strong>Save Settings</strong>.</li>
                            </ol>

                            <div className="guide-callout security">
                                <Lock size={16} />
                                <span>
                                    <strong>Security & Privacy:</strong> Cookie contents are saved locally in your database and passed securely to yt-dlp during downloads. Cookie contents are never displayed in application logs or returned in public API responses.
                                </span>
                            </div>
                        </div>
                        <div className="warning-modal-actions">
                            <button className="btn btn-primary" onClick={() => setShowCookieGuide(false)}>
                                Got it, Close Guide
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Settings;
