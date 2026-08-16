import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    Disc,
    Edit3,
    ExternalLink,
    Grid,
    List,
    ListMusic,
    Music,
    Play,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Shuffle,
    Trash2,
    X,
} from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import {
    createPlaylist,
    deletePlaylist,
    getPlaylists,
    getPlaylistSongs,
    syncPlaylist,
    updatePlaylist,
} from "../services/playlists";
import { retryDownload } from "../services/songs";
import "../styles/playlists.css";

function Toggle({ enabled, onChange, disabled = false }) {
    return (
        <button
            type="button"
            className={`playlist-toggle ${enabled ? "enabled" : ""}`}
            onClick={(e) => {
                e.stopPropagation();
                onChange();
            }}
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

function PlaylistThumbnail({ songs = [] }) {
    const artworkList = songs.map((s) => s.thumbnail_url).filter(Boolean);

    if (artworkList.length >= 4) {
        return (
            <div className="playlist-mosaic-art">
                <img src={artworkList[0]} alt="" />
                <img src={artworkList[1]} alt="" />
                <img src={artworkList[2]} alt="" />
                <img src={artworkList[3]} alt="" />
            </div>
        );
    }

    if (artworkList.length > 0) {
        return (
            <div className="playlist-single-art">
                <img src={artworkList[0]} alt="" />
            </div>
        );
    }

    return (
        <div className="playlist-fallback-art">
            <ListMusic size={36} />
        </div>
    );
}

function PlaylistModal({ mode, playlist, onClose, onSubmit, loading }) {
    const isEdit = mode === "edit";
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
            await onSubmit({ name: name.trim() || null, url: url.trim(), enabled });
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to save playlist.");
        }
    };

    return (
        <div
            className="modal-overlay"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="playlist-modal">
                <div className="modal-header">
                    <div>
                        <h2>{isEdit ? "Edit Playlist Configuration" : "Add New Playlist"}</h2>
                        <p>{isEdit ? "Update settings for this monitored playlist." : "Enter a YouTube Music playlist URL to synchronize tracks."}</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <form className="playlist-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="playlist-name">Playlist Custom Name (Optional)</label>
                        <input
                            id="playlist-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Favorite Chill Tracks"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="playlist-url">
                            YouTube Music Playlist URL <span className="required">*</span>
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
                            <strong>Enable Auto Sync</strong>
                            <p>Scans automatically during synchronization cycles.</p>
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
                            {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Playlist"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Playlists() {
    const navigate = useNavigate();
    const { playPlaylist } = usePlayer();

    const [playlists, setPlaylists] = useState([]);
    const [playlistSongsMap, setPlaylistSongsMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
    const [modal, setModal] = useState(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const fetchPlaylists = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getPlaylists();
            setPlaylists(data);

            const songsMap = {};
            await Promise.all(
                data.map(async (pl) => {
                    try {
                        const songs = await getPlaylistSongs(pl.id);
                        songsMap[pl.id] = Array.isArray(songs) ? songs : songs?.songs || [];
                    } catch {
                        songsMap[pl.id] = [];
                    }
                })
            );
            setPlaylistSongsMap(songsMap);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to load playlists.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlaylists();
    }, []);

    const handleAdd = async (data) => {
        try {
            setSaving(true);
            await createPlaylist(data);
            setModal(null);
            setMessage({ type: "success", text: "Playlist added successfully." });
            await fetchPlaylists();
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async (data) => {
        try {
            setSaving(true);
            await updatePlaylist(modal.playlist.id, data);
            setModal(null);
            setMessage({ type: "success", text: "Playlist configuration saved." });
            await fetchPlaylists();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this playlist?")) return;
        try {
            await deletePlaylist(id);
            setMessage({ type: "success", text: "Playlist deleted." });
            await fetchPlaylists();
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.detail || "Delete failed." });
        }
    };

    const handleSync = async (id) => {
        try {
            await syncPlaylist(id);
            setMessage({ type: "success", text: "Synchronization triggered." });
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.detail || "Sync failed." });
        }
    };

    const handleRetryFailed = async (id) => {
        try {
            const songs = playlistSongsMap[id] || [];
            const failed = songs.filter((s) => s.download_status === "failed");
            await Promise.all(failed.map((s) => retryDownload(s.id)));
            setMessage({ type: "success", text: `Retried ${failed.length} failed track(s).` });
            await fetchPlaylists();
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.detail || "Retry failed." });
        }
    };

    const handlePlayPlaylistCard = (e, playlistId, shuffleMode = false) => {
        e.stopPropagation();
        const songs = playlistSongsMap[playlistId] || [];
        if (songs.length > 0) {
            playPlaylist(songs, 0, shuffleMode);
        } else {
            alert("No tracks available to play in this playlist.");
        }
    };

    // Filter playlists by search query
    const filteredPlaylists = playlists.filter((pl) => {
        const name = (pl.name || "").toLowerCase();
        const ytid = (pl.youtube_playlist_id || "").toLowerCase();
        const q = searchQuery.toLowerCase();
        return name.includes(q) || ytid.includes(q);
    });

    if (loading) {
        return (
            <div className="playlists-loading">
                <RefreshCw className="spin-icon" size={32} />
                <p>Loading playlists...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="playlists-page">
                <div className="playlists-header">
                    <div>
                        <h1>Monitored Playlists</h1>
                        <p>Manage your synchronized YouTube Music playlists.</p>
                    </div>
                </div>
                <div className="playlists-error-card">
                    <AlertCircle size={44} className="error-icon" />
                    <h3>Unable to load playlists</h3>
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={fetchPlaylists}>
                        <RefreshCw size={16} /> Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="playlists-page">
            {/* Header Banner */}
            <header className="playlists-header">
                <div>
                    <h1>Monitored Playlists</h1>
                    <p className="subtitle">
                        Manage playlists, trigger manual syncs, and browse track collections.
                    </p>
                </div>

                <div className="playlist-header-actions">
                    <button className="btn btn-secondary" onClick={fetchPlaylists}>
                        <RefreshCw size={15} /> Refresh
                    </button>
                    <button className="btn btn-primary" onClick={() => setModal({ type: "add" })}>
                        <Plus size={16} /> Add Playlist
                    </button>
                </div>
            </header>

            {/* Alert Message Banner */}
            {message && (
                <div className={`playlist-alert-banner alert-${message.type}`}>
                    {message.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{message.text}</span>
                    <button onClick={() => setMessage(null)} className="alert-close">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Toolbar: Search & View Mode Controls */}
            <div className="playlists-toolbar">
                <div className="search-box">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search playlists by name or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="view-mode-toggle">
                    <button
                        className={`layout-btn ${viewMode === "grid" ? "active" : ""}`}
                        onClick={() => setViewMode("grid")}
                        title="Grid View"
                    >
                        <Grid size={16} />
                    </button>
                    <button
                        className={`layout-btn ${viewMode === "list" ? "active" : ""}`}
                        onClick={() => setViewMode("list")}
                        title="List View"
                    >
                        <List size={16} />
                    </button>
                </div>
            </div>

            {/* Playlists Content */}
            {filteredPlaylists.length === 0 ? (
                <div className="playlists-empty-card">
                    <div className="empty-icon-avatar">
                        <ListMusic size={36} />
                    </div>
                    <h3>{searchQuery ? "No matching playlists found" : "No playlists configured"}</h3>
                    <p>
                        {searchQuery
                            ? "Try adjusting your search query."
                            : "Add a YouTube Music playlist URL to start synchronizing tracks."}
                    </p>
                    {!searchQuery && (
                        <button className="btn btn-primary" onClick={() => setModal({ type: "add" })}>
                            <Plus size={16} /> Add First Playlist
                        </button>
                    )}
                </div>
            ) : (
                <div className={`playlists-container mode-${viewMode}`}>
                    {filteredPlaylists.map((pl) => {
                        const songs = playlistSongsMap[pl.id] || [];
                        const failedCount = songs.filter((s) => s.download_status === "failed").length;

                        return (
                            <div
                                key={pl.id}
                                className="playlist-card-redesigned"
                                onClick={() => navigate(`/playlists/${pl.id}/detail`)}
                            >
                                {/* Artwork Thumbnail Stage */}
                                <div className="card-artwork-stage">
                                    <PlaylistThumbnail songs={songs} />
                                    <button
                                        className="artwork-play-overlay"
                                        onClick={(e) => handlePlayPlaylistCard(e, pl.id, false)}
                                        title="Play Playlist"
                                    >
                                        <Play size={24} className="play-icon-offset" />
                                    </button>
                                </div>

                                {/* Content Details */}
                                <div className="card-content-stage">
                                    <div className="card-top-row">
                                        <h3 className="playlist-title">{pl.name || `Playlist ${pl.id}`}</h3>
                                        <StatusBadge enabled={pl.enabled} />
                                    </div>

                                    <div className="card-stats-row">
                                        <span className="stat-badge">
                                            <strong>{songs.length}</strong> tracks
                                        </span>

                                        {failedCount > 0 && (
                                            <span className="stat-badge failed-badge">
                                                <strong>{failedCount}</strong> failed
                                            </span>
                                        )}
                                    </div>

                                    {/* Action Buttons Toolbar */}
                                    <div className="card-actions-row" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={(e) => handlePlayPlaylistCard(e, pl.id, false)}
                                            title="Play playlist"
                                        >
                                            <Play size={13} /> Play
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => handleSync(pl.id)}
                                            title="Trigger sync"
                                        >
                                            <RefreshCw size={13} /> Sync
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setModal({ type: "edit", playlist: pl })}
                                            title="Edit playlist"
                                        >
                                            <Edit3 size={13} /> Edit
                                        </button>

                                        {failedCount > 0 && (
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleRetryFailed(pl.id)}
                                                title="Retry failed tracks"
                                            >
                                                <RotateCcw size={13} /> Retry ({failedCount})
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            className="btn btn-danger-soft btn-sm"
                                            onClick={() => handleDelete(pl.id)}
                                            title="Delete playlist"
                                        >
                                            <Trash2 size={13} />
                                        </button>

                                        <a
                                            href={pl.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="external-link-btn"
                                            title="Open on YouTube"
                                        >
                                            <ExternalLink size={14} />
                                        </a>

                                        <ChevronRight size={18} className="card-chevron" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {modal && (
                <PlaylistModal
                    mode={modal.type}
                    playlist={modal.playlist}
                    onClose={() => setModal(null)}
                    onSubmit={modal.type === "add" ? handleAdd : handleUpdate}
                    loading={saving}
                />
            )}
        </div>
    );
}
