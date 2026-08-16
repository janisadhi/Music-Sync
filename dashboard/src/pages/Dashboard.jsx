import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    Download,
    ExternalLink,
    FileText,
    ListMusic,
    Music,
    Play,
    RefreshCw,
    Settings as SettingsIcon,
    Sparkles,
    Square,
    Zap,
} from "lucide-react";
import api from "../services/api";
import { getMetadataStatus } from "../services/metadata";
import "../styles/dashboard.css";

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
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function Dashboard() {
    const [data, setData] = useState(null);
    const [settings, setSettings] = useState(null);
    const [metadataStatus, setMetadataStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState(null);

    const fetchDashboard = async () => {
        try {
            const [dashboardResponse, settingsResponse, metadataResponse] = await Promise.all([
                api.get("/dashboard"),
                api.get("/settings"),
                getMetadataStatus().catch(() => null),
            ]);
            setData(dashboardResponse.data);
            setSettings(settingsResponse.data);
            if (metadataResponse) {
                setMetadataStatus(metadataResponse);
            }
        } catch (error) {
            console.error("Failed to fetch dashboard:", error);
            setMessage({
                type: "error",
                text: "Unable to connect to the Music Sync API.",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
        const timer = setInterval(fetchDashboard, 5000);
        return () => clearInterval(timer);
    }, []);

    const syncNow = async () => {
        try {
            setSyncing(true);
            setMessage(null);
            const response = await api.post("/sync");
            setMessage({
                type: "success",
                text: response.data.message || "Synchronization triggered successfully.",
            });
            await fetchDashboard();
        } catch (error) {
            setMessage({
                type: "error",
                text: error.response?.data?.detail || "Failed to start synchronization.",
            });
        } finally {
            setSyncing(false);
        }
    };

    const startScheduler = async () => {
        try {
            setActionLoading(true);
            setMessage(null);
            const response = await api.post("/sync/scheduler/start");
            setMessage({ type: "success", text: response.data.message || "Scheduler started." });
            await fetchDashboard();
        } catch (error) {
            setMessage({ type: "error", text: error.response?.data?.detail || "Failed to start scheduler." });
        } finally {
            setActionLoading(false);
        }
    };

    const stopScheduler = async () => {
        try {
            setActionLoading(true);
            setMessage(null);
            const response = await api.post("/sync/scheduler/stop");
            setMessage({ type: "success", text: response.data.message || "Scheduler stopped." });
            await fetchDashboard();
        } catch (error) {
            setMessage({ type: "error", text: error.response?.data?.detail || "Failed to stop scheduler." });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <RefreshCw className="spin-icon" size={32} />
                <p>Loading Music Sync Dashboard...</p>
            </div>
        );
    }

    if (!data || !settings) {
        return (
            <div className="dashboard-error">
                <AlertCircle size={48} className="error-icon" />
                <h2>Unable to load dashboard</h2>
                <p>Could not connect to the backend service.</p>
                <button className="btn btn-primary" onClick={fetchDashboard}>
                    <RefreshCw size={16} /> Try Again
                </button>
            </div>
        );
    }

    const { scheduler, downloader, stats, playlist, last_sync } = data;
    const downloadPercent = stats.total_songs > 0
        ? Math.round((stats.downloaded_songs / stats.total_songs) * 100)
        : 0;
    const lyricsPercent = stats.total_songs > 0
        ? Math.round((stats.completed_lyrics / stats.total_songs) * 100)
        : 0;

    return (
        <div className="dashboard-container">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-info">
                    <h1>Dashboard</h1>
                    <p className="subtitle">
                        Monitor your YouTube Music library, playlists, and background services.
                    </p>
                </div>

                <div className="header-actions">
                    <div className="auto-refresh-pill">
                        <span className="live-dot" />
                        <span>Live · Auto-refreshes 5s</span>
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={syncNow}
                        disabled={syncing || scheduler.sync_running}
                    >
                        <RefreshCw className={syncing || scheduler.sync_running ? "spin-icon" : ""} size={16} />
                        {scheduler.sync_running ? "Syncing..." : syncing ? "Starting..." : "Sync Now"}
                    </button>
                </div>
            </header>

            {/* Alert Message */}
            {message && (
                <div className={`dashboard-alert alert-${message.type}`}>
                    {message.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* ----------------------------------------------------------------
                Services Panel — Scheduler and Downloader side-by-side
                Makes it visually clear they are independent.
            ---------------------------------------------------------------- */}
            <section className="services-panel">
                {/* Sync Scheduler */}
                <div className="service-card">
                    <div className="service-card-header">
                        <div className="service-card-status">
                            <span className={`status-beacon ${scheduler.running ? "running" : "stopped"}`} />
                            <div>
                                <span className="engine-label">Sync Scheduler</span>
                                <h3 className="engine-state">
                                    {scheduler.running
                                        ? scheduler.sync_running
                                            ? "Scanning playlists…"
                                            : "Scheduled & Idle"
                                        : "Stopped"}
                                </h3>
                            </div>
                        </div>
                        <div className="service-card-action">
                            {scheduler.running ? (
                                <button
                                    className="btn btn-danger-soft btn-sm"
                                    onClick={stopScheduler}
                                    disabled={actionLoading}
                                >
                                    <Square size={13} /> Stop
                                </button>
                            ) : (
                                <button
                                    className="btn btn-success-soft btn-sm"
                                    onClick={startScheduler}
                                    disabled={actionLoading}
                                >
                                    <Play size={13} /> Start
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="service-card-meta">
                        <div className="meta-pill">
                            <Clock size={13} />
                            <span>Interval: <strong>{settings.sync_interval_seconds}s</strong></span>
                        </div>
                        <div className="meta-pill">
                            <Activity size={13} />
                            <span>Status: <strong>{scheduler.sync_running ? "Syncing" : "Idle"}</strong></span>
                        </div>
                        <div className="meta-pill">
                            <Zap size={13} />
                            <span>Auto-Start: <strong>{settings.auto_start_scheduler ? "On" : "Off"}</strong></span>
                        </div>
                    </div>
                    {last_sync?.stats && (
                        <div className="service-card-stats">
                            <span>Last scan: {last_sync.stats.playlists_scanned ?? "—"} playlists · {last_sync.stats.total_new ?? "—"} new · {last_sync.stats.total_unavailable ?? "—"} unavailable</span>
                        </div>
                    )}
                </div>

                {/* Divider arrow */}
                <div className="services-divider">
                    <div className="divider-arrow">→</div>
                    <span className="divider-label">DB</span>
                    <div className="divider-arrow">→</div>
                </div>

                {/* Downloader Worker */}
                <div className="service-card">
                    <div className="service-card-header">
                        <div className="service-card-status">
                            <span className={`status-beacon ${downloader?.running ? "running" : "stopped"}`} />
                            <div>
                                <span className="engine-label">Downloader Worker</span>
                                <h3 className="engine-state">
                                    {downloader?.running ? "Polling queue" : "Stopped"}
                                </h3>
                            </div>
                        </div>
                        <div className="service-card-action">
                            <Link to="/settings" className="btn btn-ghost btn-sm">
                                <SettingsIcon size={13} /> Manage
                            </Link>
                        </div>
                    </div>
                    <div className="service-card-meta">
                        <div className="meta-pill">
                            <Download size={13} />
                            <span>Concurrency: <strong>{settings.download_limit}</strong></span>
                        </div>
                        <div className="meta-pill">
                            <Activity size={13} />
                            <span>Last poll: <strong>{formatRelativeTime(downloader?.last_poll_completed_at)}</strong></span>
                        </div>
                    </div>
                    {downloader?.total_downloaded > 0 && (
                        <div className="service-card-stats">
                            <span>Downloaded this session: <strong>{downloader.total_downloaded}</strong> tracks</span>
                        </div>
                    )}
                    {downloader?.last_poll_error && (
                        <div className="service-card-error">
                            <AlertCircle size={13} />
                            <span>{downloader.last_poll_error}</span>
                        </div>
                    )}
                </div>
            </section>

            {/* Stats Grid */}
            <section className="stats-overview-grid">
                {/* Audio Downloads */}
                <div className="metric-card">
                    <div className="metric-header">
                        <div className="metric-title">
                            <Download className="metric-icon blue" size={18} />
                            <span>Music Library</span>
                        </div>
                        <span className="metric-badge blue">{downloadPercent}% Downloaded</span>
                    </div>

                    <div className="metric-hero">
                        <span className="hero-number">{stats.downloaded_songs}</span>
                        <span className="hero-total">/ {stats.total_songs} songs</span>
                    </div>

                    <div className="progress-bar-track">
                        <div className="progress-bar-fill blue" style={{ width: `${downloadPercent}%` }} />
                    </div>

                    <div className="metric-subchips">
                        <span className="chip warning">{stats.pending_downloads} Pending</span>
                        {stats.failed_downloads > 0 && (
                            <span className="chip danger">{stats.failed_downloads} Failed</span>
                        )}
                        {stats.unavailable_songs > 0 && (
                            <span className="chip muted">{stats.unavailable_songs} Unavailable</span>
                        )}
                    </div>
                </div>

                {/* Lyrics */}
                <div className="metric-card">
                    <div className="metric-header">
                        <div className="metric-title">
                            <FileText className="metric-icon green" size={18} />
                            <span>Synced Lyrics</span>
                        </div>
                        <span className="metric-badge green">{lyricsPercent}% Complete</span>
                    </div>

                    <div className="metric-hero">
                        <span className="hero-number">{stats.completed_lyrics}</span>
                        <span className="hero-total">/ {stats.total_songs} synced</span>
                    </div>

                    <div className="progress-bar-track">
                        <div className="progress-bar-fill green" style={{ width: `${lyricsPercent}%` }} />
                    </div>

                    <div className="metric-subchips">
                        <span className="chip warning">{stats.pending_lyrics} Pending</span>
                        <span className="chip muted">{stats.unavailable_lyrics} No Lyrics</span>
                        {stats.failed_lyrics > 0 && (
                            <span className="chip danger">{stats.failed_lyrics} Failed</span>
                        )}
                    </div>
                </div>

                {/* Engine Config quick view */}
                <div className="metric-card">
                    <div className="metric-header">
                        <div className="metric-title">
                            <SettingsIcon className="metric-icon purple" size={18} />
                            <span>Configuration</span>
                        </div>
                        <Link to="/settings" className="metric-link">Manage</Link>
                    </div>

                    <div className="config-grid">
                        <div className="config-item">
                            <span className="config-label">Sync Interval</span>
                            <span className="config-val">{settings.sync_interval_seconds}s</span>
                        </div>
                        <div className="config-item">
                            <span className="config-label">Download Limit</span>
                            <span className="config-val">{settings.download_limit}×</span>
                        </div>
                        <div className="config-item">
                            <span className="config-label">Max Retries</span>
                            <span className="config-val">{settings.max_download_retries}</span>
                        </div>
                        <div className="config-item">
                            <span className="config-label">Watch Mode</span>
                            <span className="config-val">
                                {settings.playlist_watch_mode === "last_n"
                                    ? `Last ${settings.playlist_watch_limit}`
                                    : "Whole"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Metadata & Enrichment Overview Card */}
                {(() => {
                    const mMetrics = metadataStatus?.metrics || {
                        total_files: 0,
                        raw_files: 0,
                        enriched_files: 0,
                        low_confidence_files: 0,
                        failed_files: 0,
                        beets_edited_count: 0,
                    };
                    const mEnriched = mMetrics.enriched_files || mMetrics.beets_edited_count || 0;
                    const mPercent = mMetrics.total_files > 0
                        ? Math.round((mEnriched / mMetrics.total_files) * 100)
                        : 0;

                    return (
                        <div className="metric-card">
                            <div className="metric-header">
                                <div className="metric-title">
                                    <Sparkles className="metric-icon purple" style={{ color: "#a855f7" }} size={18} />
                                    <span>Metadata Enrichment</span>
                                </div>
                                <span className="metric-badge purple" style={{ backgroundColor: "#f3e8ff", color: "#6b21a8" }}>
                                    {mPercent}% Enriched
                                </span>
                            </div>

                            <div className="metric-hero">
                                <span className="hero-number">{mEnriched}</span>
                                <span className="hero-total">/ {mMetrics.total_files} high confidence</span>
                            </div>

                            <div className="progress-bar-track">
                                <div
                                    className="progress-bar-fill purple"
                                    style={{ width: `${mPercent}%`, backgroundColor: "#a855f7" }}
                                />
                            </div>

                            <div className="metric-subchips">
                                <span className="chip success">{mEnriched} Enriched</span>
                                <span className="chip warning" style={{ backgroundColor: "#fef3c7", color: "#b45309" }}>
                                    {mMetrics.low_confidence_files ?? mMetrics.skipped_files ?? 0} Low Conf
                                </span>
                                {mMetrics.raw_files > 0 && (
                                    <span className="chip muted">{mMetrics.raw_files} Raw</span>
                                )}
                                {mMetrics.failed_files > 0 && (
                                    <span className="chip danger">{mMetrics.failed_files} Failed</span>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </section>

            {/* Content Grid: Playlists + Last Sync */}
            <div className="dashboard-content-grid">
                {/* Playlists */}
                <div className="dashboard-panel">
                    <div className="panel-header">
                        <div className="panel-title">
                            <ListMusic size={20} className="panel-icon" />
                            <h2>Monitored Playlists</h2>
                        </div>
                        <Link to="/playlists" className="btn btn-ghost btn-sm">
                            Manage All
                        </Link>
                    </div>

                    <div className="panel-body">
                        {playlist.length === 0 ? (
                            <div className="empty-panel">
                                <Music size={36} className="text-muted" />
                                <p>No playlists configured yet.</p>
                                <Link to="/playlists" className="btn btn-primary btn-sm">
                                    Add Playlist
                                </Link>
                            </div>
                        ) : (
                            <div className="playlists-list">
                                {playlist.slice(0, 6).map((pl) => (
                                    <div key={pl.id} className="playlist-card-row">
                                        <div className="playlist-main-info">
                                            <div className="playlist-icon-avatar">
                                                <ListMusic size={18} />
                                            </div>
                                            <div>
                                                <p className="playlist-name">{pl.name}</p>
                                                <p className="playlist-meta">
                                                    <code>{pl.youtube_playlist_id}</code>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="playlist-right-stats">
                                            <span className="song-count-pill">{pl.song_count} songs</span>
                                            <span className={`status-tag ${pl.enabled ? "enabled" : "disabled"}`}>
                                                {pl.enabled ? "Active" : "Paused"}
                                            </span>
                                            <a
                                                href={pl.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="external-link-btn"
                                                title="Open on YouTube"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                                {playlist.length > 6 && (
                                    <Link to="/playlists" className="btn btn-ghost btn-sm" style={{ alignSelf: "center" }}>
                                        View all {playlist.length} playlists
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Last Sync activity */}
                <div className="dashboard-panel">
                    <div className="panel-header">
                        <div className="panel-title">
                            <Activity size={20} className="panel-icon" />
                            <h2>Last Synchronization</h2>
                        </div>
                        <Link to="/history" className="btn btn-ghost btn-sm">
                            Full History
                        </Link>
                    </div>

                    <div className="panel-body">
                        {!last_sync?.status ? (
                            <div className="empty-panel">
                                <Clock size={36} className="text-muted" />
                                <p>No synchronization has run yet.</p>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={syncNow}
                                    disabled={syncing}
                                >
                                    Run First Sync
                                </button>
                            </div>
                        ) : (
                            <div className="sync-execution-card">
                                <div className="execution-header-row">
                                    <div className="execution-status">
                                        <span className={`status-pill ${last_sync.status}`}>
                                            {last_sync.status === "success" && <CheckCircle2 size={13} />}
                                            {last_sync.status === "failed" && <AlertCircle size={13} />}
                                            {last_sync.status?.toUpperCase()}
                                        </span>
                                        <span className="time-ago">
                                            {formatRelativeTime(last_sync.completed_at)}
                                        </span>
                                    </div>
                                    {last_sync.started_at && last_sync.completed_at && (
                                        <div className="execution-duration">
                                            <Clock size={13} />
                                            <span>
                                                {(
                                                    (new Date(last_sync.completed_at) - new Date(last_sync.started_at)) / 1000
                                                ).toFixed(1)}s
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="execution-timeline">
                                    <div className="time-point">
                                        <span className="point-label">Started</span>
                                        <span className="point-val">
                                            {last_sync.started_at
                                                ? new Date(last_sync.started_at).toLocaleTimeString()
                                                : "—"}
                                        </span>
                                    </div>
                                    <div className="time-divider" />
                                    <div className="time-point">
                                        <span className="point-label">Completed</span>
                                        <span className="point-val">
                                            {last_sync.completed_at
                                                ? new Date(last_sync.completed_at).toLocaleTimeString()
                                                : "—"}
                                        </span>
                                    </div>
                                </div>

                                {/* Scan stats if available */}
                                {last_sync.stats && (
                                    <div className="sync-scan-stats">
                                        <div className="scan-stat">
                                            <span className="scan-stat-val">{last_sync.stats.playlists_scanned ?? 0}</span>
                                            <span className="scan-stat-label">Playlists</span>
                                        </div>
                                        <div className="scan-stat">
                                            <span className="scan-stat-val">{last_sync.stats.total_discovered ?? 0}</span>
                                            <span className="scan-stat-label">Discovered</span>
                                        </div>
                                        <div className="scan-stat">
                                            <span className="scan-stat-val">{last_sync.stats.total_new ?? 0}</span>
                                            <span className="scan-stat-label">New songs</span>
                                        </div>
                                        {(last_sync.stats.total_unavailable ?? 0) > 0 && (
                                            <div className="scan-stat">
                                                <span className="scan-stat-val">{last_sync.stats.total_unavailable}</span>
                                                <span className="scan-stat-label">Unavailable</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {last_sync.error && (
                                    <div className="execution-error-box">
                                        <AlertCircle size={16} />
                                        <div>
                                            <strong>Error</strong>
                                            <p>{last_sync.error}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
