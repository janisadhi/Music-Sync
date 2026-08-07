import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import {
    getPlaylist,
    getPlaylistSongs,
    updatePlaylist,
    deletePlaylist,
    syncPlaylist,
} from "../services/playlists";
import { getSongAudioUrl } from "../services/songs";
import Lyrics from "../components/Lyrics";

import "../styles/playlists.css";

function Toggle({ enabled, onChange, disabled = false }) {
    return (
        <button
            type="button"
            className={`playlist-toggle ${enabled ? "enabled" : ""}`}
            onClick={onChange}
            disabled={disabled}
            aria-label={enabled ? "Disable playlist" : "Enable playlist"}
        >
            <span />
        </button>
    );
}

function StatusBadge({ enabled }) {
    return (
        <span
            className={`playlist-status ${enabled ? "enabled" : "disabled"}`}
        >
            <span className="status-dot" />
            {enabled ? "Enabled" : "Disabled"}
        </span>
    );
}

function PlaylistModal({ playlist, onClose, onSubmit, loading }) {
    const [name, setName] = useState(playlist?.name || "");
    const [url, setUrl] = useState(playlist?.url || "");
    const [enabled, setEnabled] = useState(playlist?.enabled ?? true);
    const [error, setError] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");

        if (!url.trim()) {
            setError("Playlist URL is required.");
            return;
        }

        try {
            await onSubmit({
                name: name.trim() || null,
                url: url.trim(),
                enabled,
            });
        } catch (err) {
            setError(
                err.response?.data?.detail || "Failed to save playlist."
            );
        }
    };

    return (
        <div
            className="modal-overlay"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="playlist-modal">
                <div className="modal-header">
                    <div>
                        <h2>Edit Playlist</h2>
                        <p>Update your playlist configuration.</p>
                    </div>

                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="playlist-form">
                    <div className="form-group">
                        <label htmlFor="playlist-name">Playlist Name</label>
                        <input
                            id="playlist-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Music Playlist"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="playlist-url">
                            Playlist URL
                            <span className="required">*</span>
                        </label>
                        <input
                            id="playlist-url"
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://www.youtube.com/playlist?list=..."
                            required
                        />
                    </div>

                    <div className="form-toggle-row">
                        <div>
                            <strong>Enable Playlist</strong>
                            <span>
                                Enabled playlists are included in synchronization.
                            </span>
                        </div>

                        <Toggle
                            enabled={enabled}
                            onChange={() => setEnabled(!enabled)}
                        />
                    </div>

                    {error && <div className="form-error">{error}</div>}

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function PlaylistDetailPage() {
    const { playlistId } = useParams();
    const navigate = useNavigate();

    const [playlist, setPlaylist] = useState(null);
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState(null);

    const [expandedSongId, setExpandedSongId] = useState(null);
    const [currentSong, setCurrentSong] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const audioRef = useRef(null);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [playlistData, songsData] = await Promise.all([
                getPlaylist(playlistId),
                getPlaylistSongs(playlistId),
            ]);

            setPlaylist(playlistData);
            setSongs(Array.isArray(songsData) ? songsData : songsData?.songs || []);
        } catch (err) {
            console.error("Failed to load playlist details:", err);
            setError(
                err.response?.data?.detail || "Failed to load playlist details."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [playlistId]);

    /* Audio Sync Effect */
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentSong) return;

        const url = getSongAudioUrl(currentSong.id);
        if (audio.src !== url) {
            audio.src = url;
            audio.load();
            setCurrentTime(0);
            setIsPlaying(false);
        }
    }, [currentSong]);

    /* Autoplay Effect */
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentSong) return;

        const handleCanPlay = async () => {
            try {
                await audio.play();
                setIsPlaying(true);
            } catch (err) {
                console.debug("Autoplay prevented:", err);
                setIsPlaying(false);
            }
        };

        audio.addEventListener("canplay", handleCanPlay, { once: true });
        return () => audio.removeEventListener("canplay", handleCanPlay);
    }, [currentSong]);

    const formatDuration = (seconds) => {
        if (!seconds) return "--:--";
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
    };

    const renderStatusDot = (status, label) => {
        let backgroundColor = "#9ca3af";
        if (status === "downloaded" || status === "completed") backgroundColor = "#22c55e";
        if (status === "failed") backgroundColor = "#ef4444";
        if (status === "pending") backgroundColor = "#eab308";

        return (
            <span
                title={label}
                aria-label={label}
                style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor,
                    flexShrink: 0,
                }}
            />
        );
    };

    const handleTogglePlaylist = async () => {
        try {
            setBusy(true);
            const updated = await updatePlaylist(playlist.id, {
                enabled: !playlist.enabled,
            });

            setPlaylist((prev) => ({ ...prev, ...updated }));
            setMessage({
                type: "success",
                text: playlist.enabled ? "Playlist disabled." : "Playlist enabled.",
            });
        } catch (err) {
            setMessage({
                type: "error",
                text: err.response?.data?.detail || "Failed to update playlist.",
            });
        } finally {
            setBusy(false);
        }
    };

    const handleSyncPlaylist = async () => {
        try {
            setSyncing(true);
            await syncPlaylist(playlist.id);
            setMessage({
                type: "success",
                text: "Playlist sync triggered successfully.",
            });
            await loadData();
        } catch (err) {
            setMessage({
                type: "error",
                text: err.response?.data?.detail || "Failed to sync playlist.",
            });
        } finally {
            setSyncing(false);
        }
    };

    const handleEditPlaylist = async (data) => {
        try {
            setSaving(true);
            const updated = await updatePlaylist(playlist.id, data);
            setPlaylist((prev) => ({ ...prev, ...updated }));
            setModalOpen(false);
            setMessage({
                type: "success",
                text: "Playlist updated successfully.",
            });
        } catch (err) {
            setMessage({
                type: "error",
                text: err.response?.data?.detail || "Failed to edit playlist.",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePlaylist = async () => {
        const confirmed = window.confirm(
            `Are you sure you want to delete "${playlist.name}"?`
        );
        if (!confirmed) return;

        try {
            setBusy(true);
            await deletePlaylist(playlist.id);
            navigate("/playlists", { replace: true });
        } catch (err) {
            setMessage({
                type: "error",
                text: err.response?.data?.detail || "Failed to delete playlist.",
            });
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="playlists-page">
                <div className="playlists-loading">
                    <div className="loading-spinner" />
                    <p>Loading playlist details...</p>
                </div>
            </div>
        );
    }

    if (error || !playlist) {
        return (
            <div className="playlists-page">
                <div className="playlists-header">
                    <div>
                        <Link to="/playlists" className="btn btn-secondary" style={{ marginBottom: "12px" }}>
                            ← Back to Playlists
                        </Link>
                        <h1>Playlist Details</h1>
                    </div>
                </div>

                <div className="playlists-error">
                    <h3>Unable to load playlist</h3>
                    <p>{error || "Playlist not found."}</p>
                    <button className="btn btn-primary" onClick={loadData}>
                        ↻ Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="playlists-page">
            {/* Audio element for track playback */}
            <audio
                ref={audioRef}
                onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                }}
            />

            {/* Back link & Header */}
            <div style={{ marginBottom: "15px" }}>
                <Link to="/playlists" className="btn btn-secondary" style={{ textDecoration: "none" }}>
                    ← Back to Playlists
                </Link>
            </div>

            <div className="playlists-header">
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                        <h1>{playlist.name}</h1>
                        <StatusBadge enabled={playlist.enabled} />
                    </div>

                    <p>
                        <a
                            href={playlist.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#61dafb", textDecoration: "none" }}
                        >
                            {playlist.url} ↗
                        </a>
                    </p>
                </div>

                <div className="playlist-header-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={loadData}
                        disabled={busy || syncing}
                    >
                        ↻ Refresh
                    </button>

                    <button
                        className="btn btn-primary"
                        onClick={handleSyncPlaylist}
                        disabled={syncing || !playlist.enabled}
                    >
                        {syncing ? "Syncing..." : "⚡ Sync Now"}
                    </button>

                    <button
                        className={`btn ${playlist.enabled ? "btn-warning" : "btn-success"}`}
                        onClick={handleTogglePlaylist}
                        disabled={busy}
                    >
                        {playlist.enabled ? "Disable" : "Enable"}
                    </button>

                    <button
                        className="btn btn-secondary"
                        onClick={() => setModalOpen(true)}
                        disabled={busy}
                    >
                        Edit
                    </button>

                    <button
                        className="btn btn-danger"
                        onClick={handleDeletePlaylist}
                        disabled={busy}
                    >
                        Delete
                    </button>
                </div>
            </div>

            {/* Alert Message */}
            {message && (
                <div
                    className={`playlist-alert ${
                        message.type === "error" ? "error" : "success"
                    }`}
                >
                    <span>{message.text}</span>
                    <button onClick={() => setMessage(null)}>×</button>
                </div>
            )}

            {/* Metadata Summary Cards */}
            <div className="playlist-detail-grid" style={{ marginBottom: "25px" }}>
                <div className="playlist-detail">
                    <span>Total Tracks</span>
                    <strong>{songs.length}</strong>
                </div>

                <div className="playlist-detail">
                    <span>Status</span>
                    <strong>{playlist.enabled ? "Active Sync" : "Disabled"}</strong>
                </div>

                <div className="playlist-detail playlist-detail-wide">
                    <span>YouTube Playlist ID</span>
                    <strong>{playlist.youtube_playlist_id}</strong>
                </div>
            </div>

            {/* Modal */}
            {modalOpen && (
                <PlaylistModal
                    playlist={playlist}
                    onClose={() => setModalOpen(false)}
                    onSubmit={handleEditPlaylist}
                    loading={saving}
                />
            )}

            {/* Song / Track List */}
            <div style={{ background: "white", borderRadius: "10px", border: "1px solid #e4e7eb", padding: "20px" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: "18px" }}>
                    Tracks ({songs.length})
                </h3>

                {songs.length === 0 ? (
                    <div style={{ padding: "30px", textAlign: "center", color: "#8a9098" }}>
                        No songs found in this playlist yet. Run a sync to discover tracks.
                    </div>
                ) : (
                    <div>
                        {songs.map((song) => {
                            const isExpanded = expandedSongId === song.id;
                            const isCurrent = currentSong?.id === song.id;

                            return (
                                <div
                                    key={song.id}
                                    style={{
                                        marginBottom: "8px",
                                        border: isExpanded ? "1px solid #61dafb" : "1px solid #e5e5e5",
                                        borderRadius: "8px",
                                        overflow: "hidden",
                                        background: "#fff",
                                    }}
                                >
                                    <div
                                        onClick={() => setExpandedSongId(isExpanded ? null : song.id)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "15px",
                                            padding: "14px 16px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                            {renderStatusDot(song.download_status, `Download: ${song.download_status}`)}
                                            {renderStatusDot(song.lyrics_status, `Lyrics: ${song.lyrics_status}`)}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {song.title}
                                            </div>
                                            <div style={{ color: "#777", fontSize: "14px", marginTop: "3px" }}>
                                                {song.artist || "Unknown artist"}
                                            </div>
                                        </div>

                                        <div style={{ color: "#777", fontSize: "14px" }}>
                                            {formatDuration(song.duration)}
                                        </div>

                                        {isCurrent && isPlaying && (
                                            <span style={{ color: "#61dafb" }}>▶</span>
                                        )}

                                        <div
                                            style={{
                                                fontSize: "18px",
                                                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                                transition: "transform 0.2s",
                                            }}
                                        >
                                            ▼
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div style={{ borderTop: "1px solid #eee", padding: "16px", background: "#fafcff" }}>
                                            {song.download_status === "downloaded" ? (
                                                <div>
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => {
                                                            if (isCurrent && isPlaying) {
                                                                audioRef.current?.pause();
                                                                setIsPlaying(false);
                                                            } else if (isCurrent && !isPlaying) {
                                                                audioRef.current?.play();
                                                                setIsPlaying(true);
                                                            } else {
                                                                setCurrentSong(song);
                                                            }
                                                        }}
                                                        style={{ marginBottom: "15px" }}
                                                    >
                                                        {isCurrent && isPlaying ? "⏸ Pause Audio" : "▶ Play Audio"}
                                                    </button>

                                                    <Lyrics song={song} currentTime={currentTime} />
                                                </div>
                                            ) : (
                                                <div style={{ color: "#777", fontSize: "14px" }}>
                                                    Audio not downloaded yet (Status: {song.download_status}).
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default PlaylistDetailPage;
