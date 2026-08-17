import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    DownloadCloud,
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

export default function Dashboard() {
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

    if (loading && !data) {
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
                <AlertCircle size={44} style={{ color: "#ef4444" }} />
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

    const mMetrics = metadataStatus?.metrics || {
        total_files: stats.total_songs || 0,
        enriched_files: 0,
        raw_files: 0,
    };
    const metadataPercent = mMetrics.total_files > 0
        ? Math.round((mMetrics.enriched_files / mMetrics.total_files) * 100)
        : 0;

    const greeting = getTimeGreeting();
    const username = user?.username || "Admin";

    return (
        <div className="dashboard-container">
            {/* Header Banner */}
            <header className="hero-header-banner">
                <div className="banner-text">
                    <span className="greeting-badge">
                        <span className="live-dot" /> System Online · Auto-refreshes 5s
                    </span>
                    <h1>Dashboard</h1>
                    <p className="subtitle">
                        Real-time overview of your synchronized YouTube Music library, metadata, and background workers.
                    </p>
                </div>

                <div className="banner-cta">
                    <button
                        className="btn btn-primary btn-sync-hero"
                        onClick={syncNow}
                        disabled={syncing || scheduler.sync_running}
                    >
                        <RefreshCw className={syncing || scheduler.sync_running ? "spin-icon" : ""} size={16} />
                        {scheduler.sync_running ? "Scanning Playlists..." : syncing ? "Starting Sync..." : "Sync Library Now"}
                    </button>
                </div>
            </header>

            {/* Alert Message Banner */}
            {message && (
                <div className={`playlist-alert-banner alert-${message.type}`}>
                    {message.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Service Engine Control Center */}
            <section className="service-control-center">
                {/* Sync Scheduler Card */}
                <div className="engine-card">
                    <div className="engine-card-header">
                        <div className="engine-title-group">
                            <div className="engine-icon-wrap blue">
                                <Zap size={20} />
                            </div>
                            <div>
                                <span className="engine-category">Automation</span>
                                <h3>Sync Scheduler</h3>
                            </div>
                        </div>

                        <div className="engine-action-wrap">
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

                    <div className="engine-status-row">
                        <span className={`status-beacon ${scheduler.running ? "running" : "stopped"}`} />
                        <span className="status-text">
                            {scheduler.running
                                ? scheduler.sync_running
                                    ? "Scanning playlists…"
                                    : "Active & Idle"
                                : "Stopped"}
                        </span>
                    </div>

                    <div className="engine-meta-chips">
                        <span className="chip-pill">
                            <Clock size={13} /> Interval: <strong>{settings.sync_interval_seconds}s</strong>
                        </span>
                        <span className="chip-pill">
                            <Activity size={13} /> Status: <strong>{scheduler.sync_running ? "Scanning" : "Ready"}</strong>
                        </span>
                    </div>
                </div>

                {/* Downloader Worker Card */}
                <div className="engine-card">
                    <div className="engine-card-header">
                        <div className="engine-title-group">
                            <div className="engine-icon-wrap amber">
                                <DownloadCloud size={20} />
                            </div>
                            <div>
                                <span className="engine-category">Media Pipeline</span>
                                <h3>Downloader Worker</h3>
                            </div>
                        </div>

                        <Link to="/settings" className="btn btn-ghost btn-sm">
                            <SettingsIcon size={13} /> Settings
                        </Link>
                    </div>

                    <div className="engine-status-row">
                        <span className={`status-beacon ${downloader?.running ? "running" : "stopped"}`} />
                        <span className="status-text">
                            {downloader?.running ? "Queue Polling Active" : "Stopped"}
                        </span>
                    </div>

                    <div className="engine-meta-chips">
                        <span className="chip-pill">
                            Limit: <strong>{settings.download_limit} max</strong>
                        </span>
                        <span className="chip-pill">
                            Last poll: <strong>{formatRelativeTime(downloader?.last_poll_completed_at)}</strong>
                        </span>
                    </div>
                </div>
            </section>

            {/* Key Metrics Overview Grid */}
            <section className="key-metrics-grid">
                {/* Songs Library */}
                <div className="metric-overview-card">
                    <div className="metric-card-top">
                        <div className="metric-label-group">
                            <Music size={18} className="icon-blue" />
                            <span>Music Library</span>
                        </div>
                        <span className="badge-pill blue">{downloadPercent}% Downloaded</span>
                    </div>

                    <div className="metric-hero-number">
                        <span className="num">{stats.downloaded_songs}</span>
                        <span className="total">/ {stats.total_songs} songs</span>
                    </div>

                    <div className="metric-progress-track">
                        <div className="metric-progress-fill blue" style={{ width: `${downloadPercent}%` }} />
                    </div>

                    <div className="metric-chips-row">
                        <span className="chip warning">{stats.pending_downloads} Pending</span>
                        {stats.failed_downloads > 0 && <span className="chip danger">{stats.failed_downloads} Failed</span>}
                        {stats.unavailable_songs > 0 && <span className="chip muted">{stats.unavailable_songs} Unavailable</span>}
                    </div>
                </div>

                {/* Lyrics Coverage */}
                <div className="metric-overview-card">
                    <div className="metric-card-top">
                        <div className="metric-label-group">
                            <FileText size={18} className="icon-green" />
                            <span>Synced Lyrics</span>
                        </div>
                        <span className="badge-pill green">{lyricsPercent}% Synced</span>
                    </div>

                    <div className="metric-hero-number">
                        <span className="num">{stats.completed_lyrics}</span>
                        <span className="total">/ {stats.total_songs} tracks</span>
                    </div>

                    <div className="metric-progress-track">
                        <div className="metric-progress-fill green" style={{ width: `${lyricsPercent}%` }} />
                    </div>

                    <div className="metric-chips-row">
                        <span className="chip warning">{stats.pending_lyrics} Pending</span>
                        <span className="chip muted">{stats.unavailable_lyrics} No Lyrics</span>
                        {stats.failed_lyrics > 0 && <span className="chip danger">{stats.failed_lyrics} Failed</span>}
                    </div>
                </div>

                {/* Metadata Enrichment */}
                <div className="metric-overview-card">
                    <div className="metric-card-top">
                        <div className="metric-label-group">
                            <Sparkles size={18} className="icon-purple" />
                            <span>Metadata Enrichment</span>
                        </div>
                        <span className="badge-pill purple">{metadataPercent}% Enriched</span>
                    </div>

                    <div className="metric-hero-number">
                        <span className="num">{mMetrics.enriched_files}</span>
                        <span className="total">/ {mMetrics.total_files || stats.total_songs} autotagged</span>
                    </div>

                    <div className="metric-progress-track">
                        <div className="metric-progress-fill purple" style={{ width: `${metadataPercent}%` }} />
                    </div>

                    <div className="metric-chips-row">
                        <span className="chip success">{mMetrics.enriched_files} Enriched</span>
                        {mMetrics.raw_files > 0 && <span className="chip muted">{mMetrics.raw_files} Raw</span>}
                    </div>
                </div>

                {/* Active Playlists */}
                <div className="metric-overview-card">
                    <div className="metric-card-top">
                        <div className="metric-label-group">
                            <ListMusic size={18} className="icon-indigo" />
                            <span>Monitored Playlists</span>
                        </div>
                        <Link to="/playlists" className="metric-link">Manage</Link>
                    </div>

                    <div className="metric-hero-number">
                        <span className="num">{playlist.length}</span>
                        <span className="total">active feeds</span>
                    </div>

                    <div className="playlist-summary-strip">
                        <span>Syncing <strong>{stats.total_songs}</strong> total tracks across YouTube playlists.</span>
                    </div>
                </div>
            </section>

            {/* Content Section: Monitored Playlists + Sync Activity */}
            <div className="dashboard-content-split">
                {/* Monitored Playlists */}
                <div className="content-card">
                    <div className="card-header">
                        <h2>Monitored Playlists</h2>
                        <Link to="/playlists" className="btn btn-ghost btn-sm">View All ({playlist.length})</Link>
                    </div>

                    <div className="card-body">
                        {playlist.length === 0 ? (
                            <div className="empty-state">
                                <ListMusic size={36} />
                                <p>No YouTube Music playlists configured yet.</p>
                                <Link to="/playlists" className="btn btn-primary btn-sm">Add Playlist</Link>
                            </div>
                        ) : (
                            <div className="playlists-table">
                                {playlist.slice(0, 5).map((pl) => (
                                    <div key={pl.id} className="playlist-item-row">
                                        <div className="playlist-left">
                                            <div className="playlist-icon-bg">
                                                <ListMusic size={18} />
                                            </div>
                                            <div className="playlist-text">
                                                <span className="pl-title">{pl.name}</span>
                                                <span className="pl-sub">{pl.song_count} songs · <code>{pl.youtube_playlist_id}</code></span>
                                            </div>
                                        </div>

                                        <div className="playlist-right">
                                            <span className={`status-tag ${pl.enabled ? "active" : "paused"}`}>
                                                {pl.enabled ? "Active" : "Paused"}
                                            </span>
                                            <a
                                                href={pl.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-icon-link"
                                                title="Open on YouTube"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Last Synchronization Activity */}
                <div className="content-card">
                    <div className="card-header">
                        <h2>Last Synchronization</h2>
                        <Link to="/history" className="btn btn-ghost btn-sm">Full History</Link>
                    </div>

                    <div className="card-body">
                        {!last_sync?.status ? (
                            <div className="empty-state">
                                <Clock size={36} />
                                <p>No synchronization activity recorded yet.</p>
                                <button className="btn btn-primary btn-sm" onClick={syncNow} disabled={syncing}>
                                    Run First Sync
                                </button>
                            </div>
                        ) : (
                            <div className="sync-history-detail">
                                <div className="history-top-bar">
                                    <span className={`history-status-badge ${last_sync.status}`}>
                                        {last_sync.status === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                        {last_sync.status?.toUpperCase()}
                                    </span>
                                    <span className="history-time-ago">{formatRelativeTime(last_sync.completed_at)}</span>
                                </div>

                                <div className="history-stats-grid">
                                    <div className="h-stat-box">
                                        <span className="num">{last_sync.stats?.playlists_scanned ?? 0}</span>
                                        <span className="lbl">Playlists Scanned</span>
                                    </div>
                                    <div className="h-stat-box">
                                        <span className="num">{last_sync.stats?.total_discovered ?? 0}</span>
                                        <span className="lbl">Discovered</span>
                                    </div>
                                    <div className="h-stat-box">
                                        <span className="num">{last_sync.stats?.total_new ?? 0}</span>
                                        <span className="lbl">New Songs</span>
                                    </div>
                                </div>

                                {last_sync.error && (
                                    <div className="history-error-banner">
                                        <AlertCircle size={16} />
                                        <span>{last_sync.error}</span>
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
