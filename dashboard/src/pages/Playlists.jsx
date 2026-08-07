import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    Edit3,
    ExternalLink,
    ListMusic,
    Plus,
    RefreshCw,
    RotateCcw,
    Trash2,
    X,
} from "lucide-react";
import {
    getPlaylists,
    getPlaylistSongs,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    syncPlaylist,
} from "../services/playlists";
import { retryDownload } from "../services/songs";
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
                        <h2>{isEdit ? "Edit Playlist" : "Add New Playlist"}</h2>
                        <p>{isEdit ? "Update configuration for this playlist." : "Add a YouTube Music playlist to synchronize."}</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <form className="playlist-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="playlist-name">Playlist Name</label>
                        <input
                            id="playlist-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Favorite Hits"
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
                            <p>Active playlists are scanned automatically during synchronization cycles.</p>
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

function Playlists() {
    const navigate = useNavigate();
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [songCounts, setSongCounts] = useState({});
    const [modal, setModal] = useState(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const fetchPlaylists = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getPlaylists();
            setPlaylists(data);
            const counts = {};
            await Promise.all(
                data.map(async (pl) => {
                    try {
                        const songs = await getPlaylistSongs(pl.id);
                        counts[pl.id] = Array.isArray(songs) ? songs.length : songs?.songs?.length || 0;
                    } catch {
                        counts[pl.id] = 0;
                    }
                })
            );
            setSongCounts(counts);
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
            setMessage({ type: "success", text: "Playlist updated successfully." });
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
            setMessage({ type: "success", text: "Playlist synchronization started." });
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.detail || "Sync failed." });
        }
    };

    const handleRetryFailed = async (id) => {
        try {
            const songs = await getPlaylistSongs(id);
            const failed = songs.filter((s) => s.download_status === "failed");
            await Promise.all(failed.map((s) => retryDownload(s.id)));
            setMessage({ type: "success", text: `Retried ${failed.length} failed track(s).` });
            await fetchPlaylists();
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.detail || "Retry failed." });
        }
    };

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
                        <h1>Playlists</h1>
                        <p>Manage your synchronized YouTube Music playlists.</p>
                    </div>
                </div>
                <div className="playlists-error-card">
                    <AlertCircle size={40} className="error-icon" />
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
            <div className="playlists-header">
                <div>
                    <h1>Monitored Playlists</h1>
                    <p>Manage playlists, trigger manual syncs, and view track statistics.</p>
                </div>
                <div className="playlist-header-actions">
                    <button className="btn btn-secondary" onClick={fetchPlaylists}>
                        <RefreshCw size={15} /> Refresh
                    </button>
                    <button className="btn btn-primary" onClick={() => setModal({ type: "add" })}>
                        <Plus size={16} /> Add Playlist
                    </button>
                </div>
            </div>

            {message && (
                <div className={`playlist-alert-banner alert-${message.type}`}>
                    {message.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{message.text}</span>
                    <button onClick={() => setMessage(null)} className="alert-close">
                        <X size={16} />
                    </button>
                </div>
            )}

            {playlists.length === 0 ? (
                <div className="playlists-empty-card">
                    <div className="empty-icon-avatar">
                        <ListMusic size={32} />
                    </div>
                    <h3>No playlists configured</h3>
                    <p>Add a YouTube Music playlist to start downloading songs and syncing lyrics.</p>
                    <button className="btn btn-primary" onClick={() => setModal({ type: "add" })}>
                        <Plus size={16} /> Add First Playlist
                    </button>
                </div>
            ) : (
                <div className="playlists-grid">
                    {playlists.map((pl) => (
                        <div
                            key={pl.id}
                            className="playlist-item-card"
                            onClick={() => navigate(`/playlists/${pl.id}/detail`)}
                        >
                            <div className="item-card-header">
                                <div className="playlist-avatar">
                                    <ListMusic size={20} />
                                </div>
                                <div className="playlist-titles">
                                    <h3 className="playlist-card-title">{pl.name}</h3>
                                    <span className="playlist-id-badge">
                                        ID: <code>{pl.youtube_playlist_id}</code>
                                    </span>
                                </div>
                                <StatusBadge enabled={pl.enabled} />
                            </div>

                            <div className="item-card-body">
                                <div className="track-count-badge">
                                    <strong>{songCounts[pl.id] ?? 0}</strong> tracks
                                </div>
                            </div>

                            <div className="item-card-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleSync(pl.id)}
                                    title="Trigger instant sync"
                                >
                                    <RefreshCw size={14} /> Sync
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setModal({ type: "edit", playlist: pl })}
                                    title="Edit playlist settings"
                                >
                                    <Edit3 size={14} /> Edit
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleRetryFailed(pl.id)}
                                    title="Retry failed downloads"
                                >
                                    <RotateCcw size={14} /> Retry
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger-soft btn-sm"
                                    onClick={() => handleDelete(pl.id)}
                                    title="Delete playlist"
                                >
                                    <Trash2 size={14} />
                                </button>

                                <a
                                    href={pl.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="external-youtube-link"
                                    title="Open on YouTube"
                                >
                                    <ExternalLink size={15} />
                                </a>

                                <ChevronRight size={18} className="card-chevron" />
                            </div>
                        </div>
                    ))}
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

export default Playlists;
