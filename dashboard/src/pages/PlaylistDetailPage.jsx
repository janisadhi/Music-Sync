import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    Clock,
    Download,
    Edit3,
    ExternalLink,
    FileText,
    ListMusic,
    Music,
    Pause,
    Play,
    RefreshCw,
    RotateCcw,
    Trash2,
    Volume2,
    VolumeX,
    X,
    Zap,
} from "lucide-react";

import {
    getPlaylist,
    getPlaylistSongs,
    updatePlaylist,
    deletePlaylist,
    syncPlaylist,
} from "../services/playlists";
import { getSongAudioUrl, retryDownload, retryLyrics, deleteSong } from "../services/songs";
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
        <span className={`playlist-status-pill ${enabled ? "enabled" : "disabled"}`}>
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
            setError(err.response?.data?.detail || "Failed to save playlist.");
        }
    };

    return (
        <div
            className="modal-overlay"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="playlist-modal">
                <div className="modal-header">
                    <div>
                        <h2>Edit Playlist</h2>
                        <p>Update playlist parameters and options.</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose}>
                        <X size={18} />
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
                            placeholder="Playlist Title"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="playlist-url">
                            Playlist URL <span className="required">*</span>
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

                    <div className="form-toggle-card">
                        <div>
                            <strong>Enable Playlist</strong>
                            <p>Enabled playlists are included in automatic sync runs.</p>
                        </div>
                        <Toggle enabled={enabled} onChange={() => setEnabled(!enabled)} />
                    </div>

                    {error && (
                        <div className="form-error-banner">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
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
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

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
            setError(err.response?.data?.detail || "Failed to load playlist details.");
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
        if (!seconds || isNaN(seconds)) return "00:00";
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    };

    const handleSeek = (newTime) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleVolumeChange = (newVolume) => {
        const audio = audioRef.current;
        setVolume(newVolume);
        if (audio) {
            audio.volume = newVolume;
            audio.muted = newVolume === 0;
            setIsMuted(newVolume === 0);
        }
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isMuted) {
            audio.muted = false;
            setIsMuted(false);
        } else {
            audio.muted = true;
            setIsMuted(true);
        }
    };

    const selectSong = async (song) => {
        if (song.download_status !== "downloaded") return;

        if (currentSong?.id === song.id) {
            const audio = audioRef.current;
            if (!audio) return;

            if (audio.paused) {
                try {
                    await audio.play();
                    setIsPlaying(true);
                } catch (err) {
                    console.error("Failed to play audio:", err);
                }
            } else {
                audio.pause();
                setIsPlaying(false);
            }
            setExpandedSongId(song.id);
            return;
        }

        setCurrentSong(song);
        setExpandedSongId(song.id);
        setCurrentTime(0);
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
        const confirmed = window.confirm(`Are you sure you want to delete "${playlist.name}"?`);
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

    const handleRetryDownloadSong = async (songId) => {
        try {
            await retryDownload(songId);
            await loadData();
        } catch (err) {
            console.error("Retry download failed:", err);
        }
    };

    const handleRetryLyricsSong = async (songId) => {
        try {
            await retryLyrics(songId);
            await loadData();
        } catch (err) {
            console.error("Retry lyrics failed:", err);
        }
    };

    const handleDeleteSongItem = async (songId) => {
        if (!window.confirm("Delete this song?")) return;
        try {
            await deleteSong(songId);
            if (currentSong?.id === songId) {
                setCurrentSong(null);
                setIsPlaying(false);
            }
            await loadData();
        } catch (err) {
            console.error("Delete song failed:", err);
        }
    };

    if (loading) {
        return (
            <div className="playlists-loading">
                <RefreshCw className="spin-icon" size={32} />
                <p>Loading playlist details...</p>
            </div>
        );
    }

    if (error || !playlist) {
        return (
            <div className="playlists-page">
                <div className="playlists-header">
                    <Link to="/playlists" className="btn btn-secondary">
                        <ArrowLeft size={16} /> Back to Playlists
                    </Link>
                </div>

                <div className="playlists-error-card">
                    <AlertCircle size={40} className="error-icon" />
                    <h3>Unable to load playlist</h3>
                    <p>{error || "Playlist not found."}</p>
                    <button className="btn btn-primary" onClick={loadData}>
                        <RefreshCw size={16} /> Try Again
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
                preload="metadata"
                onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                }}
                style={{ display: "none" }}
            />

            {/* Back link */}
            <div>
                <Link to="/playlists" className="btn btn-ghost btn-sm">
                    <ArrowLeft size={15} /> Back to All Playlists
                </Link>
            </div>

            {/* Header */}
            <div className="playlists-header">
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <h1 style={{ margin: 0 }}>{playlist.name}</h1>
                        <StatusBadge enabled={playlist.enabled} />
                    </div>

                    <p style={{ marginTop: "6px" }}>
                        <a
                            href={playlist.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--primary-blue)", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                            <span>Open on YouTube</span> <ExternalLink size={14} />
                        </a>
                    </p>
                </div>

                <div className="playlist-header-actions">
                    <button className="btn btn-secondary" onClick={loadData} disabled={busy || syncing}>
                        <RefreshCw size={15} /> Refresh
                    </button>

                    <button
                        className="btn btn-primary"
                        onClick={handleSyncPlaylist}
                        disabled={syncing || !playlist.enabled}
                    >
                        <Zap size={15} /> {syncing ? "Syncing..." : "Sync Playlist"}
                    </button>

                    <button
                        className={`btn ${playlist.enabled ? "btn-secondary" : "btn-primary"}`}
                        onClick={handleTogglePlaylist}
                        disabled={busy}
                    >
                        {playlist.enabled ? "Disable" : "Enable"}
                    </button>

                    <button className="btn btn-secondary" onClick={() => setModalOpen(true)} disabled={busy}>
                        <Edit3 size={15} /> Edit
                    </button>

                    <button className="btn btn-danger-soft" onClick={handleDeletePlaylist} disabled={busy}>
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>

            {/* Alert Message */}
            {message && (
                <div className={`playlist-alert-banner alert-${message.type}`}>
                    {message.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{message.text}</span>
                    <button onClick={() => setMessage(null)} className="alert-close">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Metadata Summary Grid */}
            <div className="stats-overview-grid">
                <div className="metric-card">
                    <div className="metric-header">
                        <div className="metric-title">
                            <ListMusic className="metric-icon blue" size={18} />
                            <span>Total Tracks</span>
                        </div>
                    </div>
                    <div className="metric-hero">
                        <span className="hero-number">{songs.length}</span>
                        <span className="hero-total">songs in playlist</span>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <div className="metric-title">
                            <Zap className="metric-icon green" size={18} />
                            <span>Sync Status</span>
                        </div>
                    </div>
                    <div className="metric-hero">
                        <span className="hero-number">{playlist.enabled ? "Active" : "Disabled"}</span>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <div className="metric-title">
                            <ExternalLink className="metric-icon purple" size={18} />
                            <span>YouTube Playlist ID</span>
                        </div>
                    </div>
                    <div className="metric-hero">
                        <code style={{ fontSize: "16px", background: "#f1f5f9", padding: "4px 10px", borderRadius: "6px" }}>
                            {playlist.youtube_playlist_id}
                        </code>
                    </div>
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

            {/* Tracks Section */}
            <div className="dashboard-panel">
                <div className="panel-header">
                    <div className="panel-title">
                        <Music size={20} className="panel-icon" />
                        <h2>Playlist Tracks ({songs.length})</h2>
                    </div>
                </div>

                <div className="panel-body">
                    {songs.length === 0 ? (
                        <div className="empty-panel">
                            <Music size={36} className="text-muted" />
                            <p>No songs found in this playlist yet.</p>
                            <button className="btn btn-primary btn-sm" onClick={handleSyncPlaylist}>
                                <Zap size={14} /> Run Sync to Discover Songs
                            </button>
                        </div>
                    ) : (
                        <div className="songs-list-container">
                            {songs.map((song, index) => {
                                const isExpanded = expandedSongId === song.id;
                                const isCurrent = currentSong?.id === song.id;

                                return (
                                    <div
                                        key={song.id}
                                        className={`song-item-card ${isExpanded ? "expanded" : ""} ${isCurrent ? "playing" : ""}`}
                                    >
                                        {/* Header Row */}
                                        <div
                                            className="song-row-header"
                                            onClick={() => setExpandedSongId(isExpanded ? null : song.id)}
                                        >
                                            <span className="track-number">{index + 1}</span>

                                            <div className="song-title-meta">
                                                <h4 className="song-title">{song.title}</h4>
                                                <p className="song-artist-album">
                                                    {song.artist || "Unknown Artist"} {song.album ? `• ${song.album}` : ""}
                                                </p>
                                            </div>

                                            <div className="song-status-pills">
                                                <span className={`status-pill ${song.download_status}`}>
                                                    <Download size={12} /> {song.download_status}
                                                </span>
                                                <span className={`status-pill ${song.lyrics_status}`}>
                                                    <FileText size={12} /> {song.lyrics_status}
                                                </span>
                                            </div>

                                            <div className="song-duration">
                                                <Clock size={14} />
                                                <span>{formatDuration(song.duration)}</span>
                                            </div>

                                            {song.download_status === "downloaded" && (
                                                <button
                                                    className={`play-inline-btn ${isCurrent && isPlaying ? "playing" : ""}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        selectSong(song);
                                                    }}
                                                >
                                                    {isCurrent && isPlaying ? <Pause size={16} /> : <Play size={16} />}
                                                </button>
                                            )}

                                            <ChevronDown className={`expand-chevron ${isExpanded ? "open" : ""}`} size={18} />
                                        </div>

                                        {/* Expanded Drawer */}
                                        {isExpanded && (
                                            <div className="song-expanded-details">
                                                {song.download_status === "downloaded" ? (
                                                    <div className="player-panel-card">
                                                        <div className="player-top-controls">
                                                            <button
                                                                className="btn btn-primary"
                                                                onClick={() => selectSong(song)}
                                                            >
                                                                {isCurrent && isPlaying ? <Pause size={16} /> : <Play size={16} />}
                                                                {isCurrent && isPlaying ? "Pause" : "Play"}
                                                            </button>

                                                            <div className="player-track-info">
                                                                <strong>{song.title}</strong>
                                                                <span>{song.artist || "Unknown Artist"}</span>
                                                            </div>

                                                            <div className="player-time-display">
                                                                <span>{formatDuration(isCurrent ? currentTime : 0)}</span>
                                                                <span className="divider">/</span>
                                                                <span>{formatDuration(song.duration)}</span>
                                                            </div>

                                                            <div className="player-volume-control">
                                                                <button onClick={toggleMute} className="icon-btn">
                                                                    {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                                                </button>
                                                                <input
                                                                    type="range"
                                                                    min={0}
                                                                    max={1}
                                                                    step={0.01}
                                                                    value={isMuted ? 0 : volume}
                                                                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                                                                    className="volume-slider"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Seek Bar */}
                                                        <div className="player-seek-container">
                                                            <input
                                                                type="range"
                                                                min={0}
                                                                max={song.duration || 100}
                                                                step={0.1}
                                                                value={isCurrent ? currentTime : 0}
                                                                onChange={(e) => handleSeek(Number(e.target.value))}
                                                                className="seek-slider"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="audio-unavailable-banner">
                                                        <AlertCircle size={16} />
                                                        <span>Audio file not downloaded yet. Status: <strong>{song.download_status}</strong></span>
                                                    </div>
                                                )}

                                                <div className="song-action-bar">
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => handleRetryDownloadSong(song.id)}
                                                    >
                                                        <RotateCcw size={14} /> Retry Download
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => handleRetryLyricsSong(song.id)}
                                                    >
                                                        <RotateCcw size={14} /> Retry Lyrics
                                                    </button>
                                                    <button
                                                        className="btn btn-danger-soft btn-sm"
                                                        onClick={() => handleDeleteSongItem(song.id)}
                                                    >
                                                        <Trash2 size={14} /> Delete Song
                                                    </button>
                                                </div>

                                                <div className="lyrics-wrapper-card">
                                                    <Lyrics
                                                        song={song}
                                                        currentTime={isCurrent ? currentTime : 0}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PlaylistDetailPage;
