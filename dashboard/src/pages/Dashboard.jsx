import { useEffect, useState } from "react";
import api from "../services/api";
import { getSongs } from "../services/songs";
import "../styles/dashboard.css";
import SongList from "../components/SongList";
import AudioPlayer from "../components/AudioPlayer";
import Lyrics from "../components/Lyrics";

function StatusBadge({ status, type = "default" }) {
    let className = "badge";

    if (type === "running") {
        className += status ? " badge-success" : " badge-danger";
    } else if (status === "success") {
        className += " badge-success";
    } else if (status === "failed") {
        className += " badge-danger";
    } else if (status === "running") {
        className += " badge-info";
    } else {
        className += " badge-neutral";
    }

    return (
        <span className={className}>
            {type === "running"
                ? status
                    ? "Running"
                    : "Stopped"
                : status || "N/A"}
        </span>
    );
}

function StatCard({ label, value, description, icon, variant }) {
    return (
        <div className="stat-card">
            <div className={`stat-icon ${variant}`}>
                {icon}
            </div>

            <div className="stat-content">
                <div className="stat-label">{label}</div>
                <div className="stat-value">{value}</div>

                {description && (
                    <div className="stat-description">
                        {description}
                    </div>
                )}
            </div>
        </div>
    );
}

function Dashboard() {
    const [currentTime, setCurrentTime] = useState(0);
    const [songs, setSongs] = useState([]);
    const [selectedSong, setSelectedSong] = useState(null);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [actionLoading, setActionLoading] =
        useState(false);

    const [syncing, setSyncing] = useState(false);

    const [interval, setIntervalValue] =
        useState(60);

    const [message, setMessage] = useState(null);

    const fetchDashboard = async () => {
        try {
            const response =
                await api.get("/dashboard");

            setData(response.data);

            if (!actionLoading) {
                setIntervalValue(
                    response.data.scheduler
                        .interval_seconds
                );
            }
        } catch (error) {
            console.error(
                "Failed to fetch dashboard:",
                error
            );

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

        const loadSongs = async () => {
            try {
                const data = await getSongs();
                setSongs(data);
            } catch (error) {
                console.error(
                    "Failed to fetch songs:",
                    error
                );
            }
        };

        loadSongs();

        const timer = setInterval(
            fetchDashboard,
            5000
        );

        return () => clearInterval(timer);
    }, []);

    const syncNow = async () => {
        try {
            setSyncing(true);
            setMessage(null);

            const response =
                await api.post("/sync");

            setMessage({
                type: "success",
                text: response.data.message,
            });

            await fetchDashboard();
        } catch (error) {
            setMessage({
                type: "error",
                text:
                    error.response?.data?.detail ||
                    "Failed to start synchronization.",
            });
        } finally {
            setSyncing(false);
        }
    };

    const startScheduler = async () => {
        try {
            setActionLoading(true);
            setMessage(null);

            const response =
                await api.post(
                    "/sync/scheduler/start"
                );

            setMessage({
                type: "success",
                text: response.data.message,
            });

            await fetchDashboard();
        } catch (error) {
            setMessage({
                type: "error",
                text:
                    error.response?.data?.detail ||
                    "Failed to start scheduler.",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const stopScheduler = async () => {
        try {
            setActionLoading(true);
            setMessage(null);

            const response =
                await api.post(
                    "/sync/scheduler/stop"
                );

            setMessage({
                type: "success",
                text: response.data.message,
            });

            await fetchDashboard();
        } catch (error) {
            setMessage({
                type: "error",
                text:
                    error.response?.data?.detail ||
                    "Failed to stop scheduler.",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const updateInterval = async () => {
        const seconds = Number(interval);

        if (!seconds || seconds < 10) {
            setMessage({
                type: "error",
                text: "Interval must be at least 10 seconds.",
            });

            return;
        }

        try {
            setActionLoading(true);
            setMessage(null);

            const response =
                await api.patch(
                    "/sync/scheduler",
                    {
                        seconds,
                    }
                );

            setMessage({
                type: "success",
                text: `Interval updated to ${response.data.interval_minutes} minutes.`,
            });

            await fetchDashboard();
        } catch (error) {
            setMessage({
                type: "error",
                text:
                    error.response?.data?.detail ||
                    "Failed to update interval.",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (date) => {
        if (!date) {
            return "N/A";
        }

        return new Date(date).toLocaleString();
    };

    const calculateDuration = (
        started,
        completed
    ) => {
        if (!started || !completed) {
            return "-";
        }

        const start =
            new Date(started).getTime();

        const end =
            new Date(completed).getTime();

        const duration =
            (end - start) / 1000;

        return `${duration.toFixed(2)}s`;
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner" />
                <p>Loading Music Sync...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="error-screen">
                <h2>Unable to load dashboard</h2>

                <button
                    className="btn btn-primary"
                    onClick={fetchDashboard}
                >
                    Try Again
                </button>
            </div>
        );
    }

    const {
        scheduler,
        stats,
        playlist,
        last_sync,
        recent_syncs,
    } = data;
    const currentIndex = songs.findIndex(
        (song) => song.id === selectedSong?.id
    );

    const playNext = () => {
        if (songs.length === 0) {
            return;
        }

        const nextIndex =
            currentIndex === songs.length - 1
                ? 0
                : currentIndex + 1;

        setSelectedSong(songs[nextIndex]);
    };

    const playPrevious = () => {
        if (songs.length === 0) {
            return;
        }

        const previousIndex =
            currentIndex <= 0
                ? songs.length - 1
                : currentIndex - 1;

        setSelectedSong(songs[previousIndex]);
    };
    return (
        <div className="dashboard-layout">

            {/* Sidebar */}

            <aside className="sidebar">

                <div className="brand">

                    <div className="brand-icon">
                        ♪
                    </div>

                    <div>
                        <div className="brand-title">
                            Music Sync
                        </div>

                        <div className="brand-subtitle">
                            Dashboard
                        </div>
                    </div>

                </div>

                <nav className="sidebar-nav">

                    <div className="nav-item active">
                        <span className="nav-icon">
                            ▦
                        </span>

                        Dashboard
                    </div>

                    <div className="nav-item">
                        <span className="nav-icon">
                            ☷
                        </span>

                        Playlists
                    </div>

                    <div className="nav-item">
                        <span className="nav-icon">
                            ♫
                        </span>

                        Songs
                    </div>

                    <div className="nav-item">
                        <span className="nav-icon">
                            ◷
                        </span>

                        Sync History
                    </div>

                    <div className="nav-item">
                        <span className="nav-icon">
                            ⚙
                        </span>

                        Settings
                    </div>

                    <div className="nav-item">
                        <span className="nav-icon">
                            ♡
                        </span>

                        System Health
                    </div>

                </nav>

                <div className="sidebar-footer">

                    <div className="online-dot" />

                    <div>
                        <strong>
                            Music Sync v1.0.0
                        </strong>

                        <span>
                            © 2026
                        </span>
                    </div>

                </div>

            </aside>

            {/* Main */}

            <main className="main-content">

                {/* Header */}

                <header className="page-header">

                    <div>
                        <h1>
                            Music Sync Dashboard
                        </h1>

                        <p>
                            Manage synchronization and
                            monitor your music library.
                        </p>
                    </div>

                    <div className="header-status">

                        <StatusBadge
                            status={
                                scheduler.running
                            }
                            type="running"
                        />

                        <span className="refresh-status">
                            ↻ Auto-refresh: 5s
                        </span>

                    </div>

                </header>

                {/* Message */}

                {message && (
                    <div
                        className={`alert ${message.type ===
                            "error"
                            ? "alert-error"
                            : "alert-success"
                            }`}
                    >
                        {message.text}
                    </div>
                )}

                {/* Stats */}

                <section className="stats-grid">

                    <StatCard
                        label="Total Songs"
                        value={stats.total_songs}
                        description="In your library"
                        icon="♫"
                        variant="blue"
                    />

                    <StatCard
                        label="Downloaded"
                        value={
                            stats.downloaded_songs
                        }
                        description="Completed downloads"
                        icon="↓"
                        variant="green"
                    />

                    <StatCard
                        label="Pending Downloads"
                        value={
                            stats.pending_downloads
                        }
                        description="Waiting to download"
                        icon="◷"
                        variant="orange"
                    />

                    <StatCard
                        label="Failed Downloads"
                        value={
                            stats.failed_downloads
                        }
                        description="Download failures"
                        icon="!"
                        variant="red"
                    />

                    <StatCard
                        label="Lyrics Completed"
                        value={stats.completed_lyrics}
                        description="With lyrics"
                        icon="▤"
                        variant="green"
                    />

                    <StatCard
                        label="Lyrics Pending"
                        value={stats.pending_lyrics}
                        description="Waiting for lyrics"
                        icon="◷"
                        variant="orange"
                    />

                    <StatCard
                        label="Lyrics Unavailable"
                        value={stats.unavailable_lyrics}
                        description="No synced lyrics found"
                        icon="—"
                        variant="orange"
                    />

                    <StatCard
                        label="Lyrics Failed"
                        value={stats.failed_lyrics}
                        description="Lyrics failures"
                        icon="!"
                        variant="red"
                    />

                </section>

                {/* Scheduler + Sync */}

                <section className="two-column">

                    <div className="card">

                        <div className="card-header">
                            <div className="card-icon blue">
                                ◫
                            </div>

                            <h2>
                                Scheduler Status
                            </h2>
                        </div>

                        <div className="status-list">

                            <div className="status-row">
                                <span>
                                    Status
                                </span>

                                <StatusBadge
                                    status={
                                        scheduler.running
                                    }
                                    type="running"
                                />
                            </div>

                            <div className="status-row">
                                <span>
                                    Sync
                                </span>

                                <span
                                    className={
                                        scheduler.sync_running
                                            ? "text-blue"
                                            : "text-muted"
                                    }
                                >
                                    {scheduler.sync_running
                                        ? "Running"
                                        : "Idle"}
                                </span>
                            </div>

                            <div className="status-row">
                                <span>
                                    Interval
                                </span>

                                <strong>
                                    {
                                        scheduler.interval_minutes
                                    }{" "}
                                    minute
                                    {scheduler.interval_minutes !==
                                        1
                                        ? "s"
                                        : ""}
                                    <span className="muted-inline">
                                        {" "}
                                        (
                                        {
                                            scheduler.interval_seconds
                                        }{" "}
                                        seconds)
                                    </span>
                                </strong>
                            </div>

                        </div>

                        <div className="button-row">

                            <button
                                className="btn btn-success-outline"
                                onClick={
                                    startScheduler
                                }
                                disabled={
                                    actionLoading ||
                                    scheduler.running
                                }
                            >
                                ▶ Start Scheduler
                            </button>

                            <button
                                className="btn btn-danger-outline"
                                onClick={
                                    stopScheduler
                                }
                                disabled={
                                    actionLoading ||
                                    !scheduler.running
                                }
                            >
                                ■ Stop Scheduler
                            </button>

                        </div>

                    </div>

                    <div className="card">

                        <div className="card-header">
                            <div className="card-icon blue">
                                ↻
                            </div>

                            <h2>
                                Synchronization
                            </h2>
                        </div>

                        <div className="sync-summary">

                            <div>
                                <span>
                                    Last status
                                </span>

                                <strong className="text-success">
                                    {
                                        last_sync.status ||
                                        "N/A"
                                    }
                                </strong>
                            </div>

                            <p>
                                {formatDate(
                                    last_sync.completed_at
                                )}
                            </p>

                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={syncNow}
                            disabled={
                                syncing ||
                                scheduler.sync_running
                            }
                        >
                            ↻{" "}
                            {scheduler.sync_running
                                ? "Sync Running..."
                                : syncing
                                    ? "Starting..."
                                    : "Sync Now"}
                        </button>

                    </div>

                </section>

                {/* Interval + Playlist */}

                <section className="two-column">

                    <div className="card">

                        <div className="card-header">
                            <div className="card-icon blue">
                                ◷
                            </div>

                            <h2>
                                Sync Interval
                            </h2>
                        </div>

                        <label className="input-label">
                            Interval (seconds)
                        </label>

                        <div className="interval-input-row">

                            <input
                                type="number"
                                min="10"
                                value={interval}
                                onChange={(event) =>
                                    setIntervalValue(
                                        event.target
                                            .value
                                    )
                                }
                            />

                            <span>
                                seconds
                            </span>

                        </div>

                        <button
                            className="btn btn-primary"
                            onClick={
                                updateInterval
                            }
                            disabled={
                                actionLoading
                            }
                        >
                            ▣ Update Interval
                        </button>

                    </div>

                    <div className="card">

                        <div className="card-header">
                            <div className="card-icon blue">
                                ☷
                            </div>

                            <h2>
                                Playlist
                            </h2>
                        </div>

                        {playlist.length === 0 ? (
                            <p className="text-muted">
                                No playlists configured.
                            </p>
                        ) : (
                            playlist.map(
                                (item) => (
                                    <div
                                        className="playlist-content"
                                        key={
                                            item.id
                                        }
                                    >

                                        <h3>
                                            {
                                                item.name
                                            }
                                        </h3>

                                        <div className="playlist-row">

                                            <span>
                                                Songs
                                            </span>

                                            <span className="number-badge">
                                                {
                                                    item.song_count
                                                }
                                            </span>

                                        </div>

                                        <div className="playlist-row">

                                            <span>
                                                Status
                                            </span>

                                            <span className="badge badge-success">
                                                {item.enabled
                                                    ? "Enabled"
                                                    : "Disabled"}
                                            </span>

                                        </div>

                                        <div className="playlist-actions">

                                            <span className="playlist-id">
                                                {
                                                    item.youtube_playlist_id
                                                }
                                            </span>

                                            <a
                                                href={
                                                    item.url
                                                }
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-secondary"
                                            >
                                                ↗ Open on YouTube
                                            </a>

                                        </div>

                                    </div>
                                )
                            )
                        )}

                    </div>

                </section>

                {/* Last Sync */}

                <section className="card last-sync-card">

                    <div className="card-header">

                        <div className="card-icon blue">
                            ◷
                        </div>

                        <h2>
                            Last Sync
                        </h2>

                    </div>

                    <div className="last-sync-grid">

                        <div>
                            <span>
                                Status
                            </span>

                            <StatusBadge
                                status={
                                    last_sync.status
                                }
                            />
                        </div>

                        <div>
                            <span>
                                Started At
                            </span>

                            <strong>
                                {formatDate(
                                    last_sync.started_at
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Completed At
                            </span>

                            <strong>
                                {formatDate(
                                    last_sync.completed_at
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Duration
                            </span>

                            <strong>
                                {calculateDuration(
                                    last_sync.started_at,
                                    last_sync.completed_at
                                )}
                            </strong>
                        </div>

                    </div>

                    {last_sync.error && (
                        <div className="sync-error">
                            {last_sync.error}
                        </div>
                    )}

                </section>


                {/* Recent History */}

                <section className="card history-card">

                    <div className="card-header">

                        <div className="card-icon blue">
                            ◷
                        </div>

                        <h2>
                            Recent Sync History
                        </h2>

                    </div>

                    {recent_syncs.length ===
                        0 ? (
                        <div className="empty-state">
                            No synchronization history
                            available.
                        </div>
                    ) : (
                        <div className="table-wrapper">

                            <table>

                                <thead>

                                    <tr>
                                        <th>#</th>
                                        <th>
                                            Status
                                        </th>
                                        <th>
                                            Started At
                                        </th>
                                        <th>
                                            Completed At
                                        </th>
                                        <th>
                                            Duration
                                        </th>
                                        <th>
                                            Error
                                        </th>
                                    </tr>

                                </thead>

                                <tbody>

                                    {recent_syncs.map(
                                        (
                                            sync,
                                            index
                                        ) => (
                                            <tr
                                                key={
                                                    index
                                                }
                                            >

                                                <td>
                                                    {index +
                                                        1}
                                                </td>

                                                <td>
                                                    <StatusBadge
                                                        status={
                                                            sync.status
                                                        }
                                                    />
                                                </td>

                                                <td>
                                                    {formatDate(
                                                        sync.started_at
                                                    )}
                                                </td>

                                                <td>
                                                    {formatDate(
                                                        sync.completed_at
                                                    )}
                                                </td>

                                                <td>
                                                    {calculateDuration(
                                                        sync.started_at,
                                                        sync.completed_at
                                                    )}
                                                </td>

                                                <td className="error-cell">
                                                    {sync.error ||
                                                        "-"}
                                                </td>

                                            </tr>
                                        )
                                    )}

                                </tbody>

                            </table>

                        </div>
                    )}

                    <div className="table-footer">
                        Showing{" "}
                        {recent_syncs.length}{" "}
                        sync
                        {recent_syncs.length !==
                            1
                            ? "s"
                            : ""}
                    </div>

                </section>
                <hr />

                <SongList
                    onSelectSong={setSelectedSong}
                />

                <hr />

                <AudioPlayer
                    song={selectedSong}
                    onTimeUpdate={setCurrentTime}
                    onNext={playNext}
                    onPrevious={playPrevious}
                />
                <Lyrics
                    song={selectedSong}
                    currentTime={currentTime}
                />
            </main>
        </div>
    );
}

export default Dashboard;