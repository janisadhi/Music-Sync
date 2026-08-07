import { useEffect, useState } from "react";
import {
    getPlaylists,
    getPlaylistSongs,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    syncPlaylist,
} from "../services/playlists";
import { retryDownload } from "../services/songs";
import { useNavigate } from "react-router-dom";
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
        <span className={`playlist-status ${enabled ? "enabled" : "disabled"}`}>
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
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="playlist-modal">
                <div className="modal-header">
                    <div>
                        <h2>{isEdit ? "Edit Playlist" : "Add Playlist"}</h2>
                        <p>{isEdit ? "Update your playlist configuration." : "Add a YouTube playlist to Music Sync."}</p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose}>×</button>
                </div>
                <form className="playlist-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="playlist-name">Playlist Name</label>
                        <input id="playlist-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Music Playlist" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="playlist-url">Playlist URL<span className="required">*</span></label>
                        <input id="playlist-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/playlist?list=..." required />
                    </div>
                    <div className="form-toggle-row">
                        <div>
                            <strong>Enable Playlist</strong>
                            <span>Enabled playlists are included in synchronization.</span>
                        </div>
                        <Toggle enabled={enabled} onChange={() => setEnabled(!enabled)} />
                    </div>
                    {error && <div className="form-error">{error}</div>}
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
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
                    } catch { counts[pl.id] = 0; }
                })
            );
            setSongCounts(counts);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to load playlists.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPlaylists(); }, []);

    const handleAdd = async (data) => {
        try { setSaving(true); await createPlaylist(data); setModal(null); setMessage({ type: "success", text: "Playlist added successfully." }); await fetchPlaylists(); } finally { setSaving(false); }
    };
    const handleUpdate = async (data) => {
        try { setSaving(true); await updatePlaylist(modal.playlist.id, data); setModal(null); setMessage({ type: "success", text: "Playlist updated successfully." }); await fetchPlaylists(); } finally { setSaving(false); }
    };
    const handleDelete = async (id) => {
        if (!window.confirm("Delete playlist? This cannot be undone.")) return;
        try { await deletePlaylist(id); setMessage({ type: "success", text: "Playlist deleted." }); await fetchPlaylists(); } catch (err) { setMessage({ type: "error", text: err.response?.data?.detail || "Delete failed." }); }
    };
    const handleSync = async (id) => { try { await syncPlaylist(id); setMessage({ type: "success", text: "Sync started." }); } catch (err) { setMessage({ type: "error", text: err.response?.data?.detail || "Sync failed." }); } };
    const handleClearFilters = () => setMessage(null);
    const handleRetryFailed = async (id) => { try { const songs = await getPlaylistSongs(id); const failed = songs.filter((s) => s.download_status === "failed"); await Promise.all(failed.map((s) => retryDownload(s.id))); setMessage({ type: "success", text: `Retry queued for ${failed.length} failed song(s).` }); await fetchPlaylists(); } catch (err) { setMessage({ type: "error", text: err.response?.data?.detail || "Retry failed." }); } };

    if (loading) return (<div className="playlists-page"><div className="playlists-loading"><div className="loading-spinner" /><p>Loading playlists...</p></div></div>);
    if (error) return (<div className="playlists-page"><div className="playlists-header"><h1>Playlists</h1><p>Manage your synchronized YouTube playlists.</p></div><div className="playlists-error"><h3>Unable to load playlists</h3><p>{error}</p><button className="btn btn-primary" onClick={fetchPlaylists}>↻ Try Again</button></div></div>);

    return (
        <div className="playlists-page">
            <div className="playlists-header">
                <div>
                    <h1>Playlists</h1>
                    <p>Manage your synchronized YouTube playlists.</p>
                </div>
                <div className="playlist-header-actions">

                    <button className="btn btn-secondary" onClick={fetchPlaylists}>↻ Refresh</button>
                    <button className="btn btn-primary" onClick={() => setModal({ type: "add" })}>+ Add Playlist</button>
                </div>
            </div>
            {message && (
                <div className={`playlist-alert ${message.type === "error" ? "error" : "success"}`}>
                    <span>{message.text}</span>
                    <button onClick={() => setMessage(null)}>×</button>
                </div>
            )}
            {playlists.length === 0 ? (
                <div className="playlists-empty">
                    <div className="empty-icon">☷</div>
                    <h3>No playlists added</h3>
                    <p>Add a YouTube playlist to start synchronizing your music.</p>
                    <button className="btn btn-primary" onClick={() => setModal({ type: "add" })}>+ Add Playlist</button>
                </div>
            ) : (
                <div className="playlist-list">
                    {playlists.map((pl) => (
                        <div key={pl.id} className="playlist-card" onClick={() => navigate(`/playlists/${pl.id}/detail`)}>
                            <div className="playlist-row">
                                <div className="playlist-icon">☷</div>
                                <div className="playlist-main">
                                    <div className="playlist-name">{pl.name}</div>
                                    <div className="playlist-url">{songCounts[pl.id] ?? 0} {songCounts[pl.id] === 1 ? "song" : "songs"}</div>
                                </div>
                                <StatusBadge enabled={pl.enabled} />
                                <div className="playlist-actions">
                                    <button type="button" className="btn btn-warning" onClick={(e) => { e.stopPropagation(); handleSync(pl.id); }}>Sync</button>
                                    <button type="button" className="btn btn-primary" onClick={(e) => { e.stopPropagation(); setModal({ type: "edit", playlist: pl }); }}>Edit</button>
                                    <button type="button" className="btn btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(pl.id); }}>Delete</button>
                                    <button type="button" className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); handleRetryFailed(pl.id); }}>Retry Failed</button>
                                    <div className="playlist-chevron">›</div>
                                </div>
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
