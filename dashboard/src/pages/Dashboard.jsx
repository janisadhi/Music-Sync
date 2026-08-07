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
    Square,
    Zap,
} from "lucide-react";
import api from "../services/api";
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
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState(null);

    const fetchDashboard = async () => {
        try {
            const [dashboardResponse, settingsResponse] = await Promise.all([
                api.get("/dashboard"),
                api.get("/settings"),
            ]);

            setData(dashboardResponse.data);
            setSettings(settingsResponse.data);
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
            setMessage({
                type: "success",
                text: response.data.message || "Scheduler started successfully.",
            });
            await fetchDashboard();
        } catch (error) {
            setMessage({
                type: "error",
                text: error.response?.data?.detail || "Failed to start scheduler.",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const stopScheduler = async () => {
        try {
            setActionLoading(true);
            setMessage(null);
            const response = await api.post("/sync/scheduler/stop");
            setMessage({
                type: "success",
                text: response.data.message || "Scheduler stopped successfully.",
            });
            await fetchDashboard();
        } catch (error) {
            setMessage({
                type: "error",
                text: error.response?.data?.detail || "Failed to stop scheduler.",
            });
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

    const { scheduler, stats, playlist, last_sync } = data;
    const downloadPercent = stats.total_songs > 0
        ? Math.round((stats.downloaded_songs / stats.total_songs) * 100)
        : 0;
    const lyricsPercent = stats.total_songs > 0
        ? Math.round((stats.completed_lyrics / stats.total_songs) * 100)
        : 0;

    return (
        <div className="dashboard-container">
            {/* Header / Hero Banner */}
            <header className="dashboard-header">
                <div className="header-info">
                    <h1>Dashboard</h1>
                    <p className="subtitle">
                        Monitor your YouTube Music library, playlists, and background sync engine.
                    </p>
                </div>

                <div className="header-actions">
                    <div className="auto-refresh-pill">
                        <span className="live-dot" />
                        <span>Live • Auto-refreshes 5s</span>
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

            {/* Engine Control Hub */}
            <section className="engine-control-card">
                <div className="engine-status-group">
                    <div className="engine-status-indicator">
                        <span className={`status-beacon ${scheduler.running ? "running" : "stopped"}`} />
                        <div>
                            <span className="engine-label">Sync Scheduler</span>
                            <h3 className="engine-state">
                                {scheduler.running ? "Active & Scheduled" : "Scheduler Stopped"}
                            </h3>
                        </div>
                    </div>

                    <div className="engine-meta-pills">
                        <div className="meta-pill">
                            <Clock size={14} />
                            <span>Interval: <strong>{settings.sync_interval_seconds}s</strong></span>
                        </div>
                        <div className="meta-pill">
                            <Activity size={14} />
                            <span>Status: <strong>{scheduler.sync_running ? "Syncing" : "Idle"}</strong></span>
                        </div>
                        <div className="meta-pill">
                            <Zap size={14} />
                            <span>Auto-Start: <strong>{settings.auto_start_scheduler ? "Enabled" : "Disabled"}</strong></span>
                        </div>
                    </div>
                </div>

                <div className="engine-actions">
                    {scheduler.running ? (
                        <button
                            className="btn btn-danger-soft"
                            onClick={stopScheduler}
                            disabled={actionLoading}
                        >
                            <Square size={16} /> Stop Scheduler
                        </button>
                    ) : (
                        <button
                            className="btn btn-success-soft"
                            onClick={startScheduler}
                            disabled={actionLoading}
                        >
                            <Play size={16} /> Start Scheduler
                        </button>
                    )}
                </div>
            </section>

            {/* Structured Stats Grid */}
            <section className="stats-overview-grid">
                {/* Audio Downloads Progress Card */}
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
                    </div>
                </div>

                {/* Lyrics Pipeline Card */}
                <div className="metric-card">
                    <div className="metric-header">
                        <div className="metric-title">
                            <FileText className="metric-icon green" size={18} />
                            <span>Synced Lyrics</span>
                        </div>
                        <span className="metric-badge green">{lyricsPercent}% Completed</span>
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

                {/* Configuration Quick Card */}
                <div className="metric-card">
                    <div className="metric-header">
                        <div className="metric-title">
                            <SettingsIcon className="metric-icon purple" size={18} />
                            <span>Engine Config</span>
                        </div>
                        <Link to="/settings" className="metric-link">Manage</Link>
                    </div>

                    <div className="config-grid">
                        <div className="config-item">
                            <span className="config-label">Interval</span>
                            <span className="config-val">{settings.sync_interval_seconds}s</span>
                        </div>
                        <div className="config-item">
                            <span className="config-label">Download Limit</span>
                            <span className="config-val">{settings.download_limit}</span>
                        </div>
                        <div className="config-item">
                            <span className="config-label">Max Retries</span>
                            <span className="config-val">{settings.max_download_retries}</span>
                        </div>
                        <div className="config-item">
                            <span className="config-label">Auto Start</span>
                            <span className="config-val">{settings.auto_start_scheduler ? "Yes" : "No"}</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Content Grid: Playlists & Sync Activity */}
            <div className="dashboard-content-grid">
                {/* Playlists Overview Panel */}
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
                                    + Add First Playlist
                                </Link>
                            </div>
                        ) : (
                            <div className="playlists-list">
                                {playlist.map((item) => (
                                    <div className="playlist-card-row" key={item.id}>
                                        <div className="playlist-main-info">
                                            <div className="playlist-icon-avatar">
                                                <ListMusic size={18} />
                                            </div>
                                            <div>
                                                <h4 className="playlist-name">{item.name}</h4>
                                                <span className="playlist-meta">
                                                    ID: <code>{item.youtube_playlist_id}</code>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="playlist-right-stats">
                                            <span className="song-count-pill">{item.song_count} songs</span>
                                            <span className={`status-tag ${item.enabled ? "enabled" : "disabled"}`}>
                                                {item.enabled ? "Active" : "Disabled"}
                                            </span>
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="external-link-btn"
                                                title="Open on YouTube"
                                            >
                                                <ExternalLink size={15} />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Last Sync Execution & Audit Log */}
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
                        <div className="sync-execution-card">
                            <div className="execution-header-row">
                                <div className="execution-status">
                                    <span className={`status-pill ${last_sync.status || "idle"}`}>
                                        {last_sync.status ? last_sync.status.toUpperCase() : "NO RUN YET"}
                                    </span>
                                    <span className="time-ago">
                                        {formatRelativeTime(last_sync.completed_at)}
                                    </span>
                                </div>

                                <div className="execution-duration">
                                    <Clock size={14} />
                                    <span>
                                        Duration:{" "}
                                        <strong>
                                            {last_sync.started_at && last_sync.completed_at
                                                ? `${((new Date(last_sync.completed_at) - new Date(last_sync.started_at)) / 1000).toFixed(2)}s`
                                                : "-"}
                                        </strong>
                                    </span>
                                </div>
                            </div>

                            <div className="execution-timeline">
                                <div className="time-point">
                                    <span className="point-label">Started</span>
                                    <span className="point-val">
                                        {last_sync.started_at ? new Date(last_sync.started_at).toLocaleTimeString() : "N/A"}
                                    </span>
                                </div>
                                <div className="time-divider" />
                                <div className="time-point">
                                    <span className="point-label">Completed</span>
                                    <span className="point-val">
                                        {last_sync.completed_at ? new Date(last_sync.completed_at).toLocaleTimeString() : "N/A"}
                                    </span>
                                </div>
                            </div>

                            {last_sync.error && (
                                <div className="execution-error-box">
                                    <AlertCircle size={16} />
                                    <div>
                                        <strong>Sync Error:</strong>
                                        <p>{last_sync.error}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;