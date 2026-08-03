import { useEffect, useState } from "react";

import {
    getPlaylists,
    getPlaylistSongs,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
} from "../services/playlists";

import "../styles/playlists.css";

function Toggle({ enabled, onChange, disabled = false }) {
    return (
        <button
            type="button"
            className={`playlist-toggle ${
                enabled ? "enabled" : ""
            }`}
            onClick={onChange}
            disabled={disabled}
            aria-label={
                enabled
                    ? "Disable playlist"
                    : "Enable playlist"
            }
        >
            <span />
        </button>
    );
}

function StatusBadge({ enabled }) {
    return (
        <span
            className={`playlist-status ${
                enabled ? "enabled" : "disabled"
            }`}
        >
            <span className="status-dot" />

            {enabled ? "Enabled" : "Disabled"}
        </span>
    );
}

function PlaylistModal({
    mode,
    playlist,
    onClose,
    onSubmit,
    loading,
}) {
    const isEdit = mode === "edit";

    const [name, setName] = useState(
        playlist?.name || ""
    );

    const [url, setUrl] = useState(
        playlist?.url || ""
    );

    const [enabled, setEnabled] = useState(
        playlist?.enabled ?? true
    );

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
                err.response?.data?.detail ||
                    "Failed to save playlist."
            );
        }
    };

    return (
        <div
            className="modal-overlay"
            onMouseDown={(event) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onClose();
                }
            }}
        >
            <div className="playlist-modal">
                <div className="modal-header">
                    <div>
                        <h2>
                            {isEdit
                                ? "Edit Playlist"
                                : "Add Playlist"}
                        </h2>

                        <p>
                            {isEdit
                                ? "Update your playlist configuration."
                                : "Add a YouTube playlist to Music Sync."}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="playlist-form"
                >
                    <div className="form-group">
                        <label htmlFor="playlist-name">
                            Playlist Name
                        </label>

                        <input
                            id="playlist-name"
                            type="text"
                            value={name}
                            onChange={(event) =>
                                setName(
                                    event.target.value
                                )
                            }
                            placeholder="My Music Playlist"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="playlist-url">
                            Playlist URL
                            <span className="required">
                                *
                            </span>
                        </label>

                        <input
                            id="playlist-url"
                            type="url"
                            value={url}
                            onChange={(event) =>
                                setUrl(
                                    event.target.value
                                )
                            }
                            placeholder="https://www.youtube.com/playlist?list=..."
                            required
                        />
                    </div>

                    <div className="form-toggle-row">
                        <div>
                            <strong>
                                Enable Playlist
                            </strong>

                            <span>
                                Enabled playlists are
                                included in synchronization.
                            </span>
                        </div>

                        <Toggle
                            enabled={enabled}
                            onChange={() =>
                                setEnabled(
                                    !enabled
                                )
                            }
                        />
                    </div>

                    {error && (
                        <div className="form-error">
                            {error}
                        </div>
                    )}

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
                            {loading
                                ? "Saving..."
                                : isEdit
                                    ? "Save Changes"
                                    : "Add Playlist"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Playlists() {
    const [playlists, setPlaylists] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState(null);

    const [expandedId, setExpandedId] =
        useState(null);

    const [songCounts, setSongCounts] =
        useState({});

    const [loadingSongs, setLoadingSongs] =
        useState({});

    const [modal, setModal] =
        useState(null);

    const [saving, setSaving] =
        useState(false);

    const [actionLoading, setActionLoading] =
        useState({});

    const [message, setMessage] =
        useState(null);

    const fetchPlaylists = async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await getPlaylists();

            setPlaylists(data);
        } catch (err) {
            console.error(
                "Failed to fetch playlists:",
                err
            );

            setError(
                err.response?.data?.detail ||
                    "Failed to load playlists."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlaylists();
    }, []);

    const toggleExpand = async (playlist) => {
        const isExpanded =
            expandedId === playlist.id;

        if (isExpanded) {
            setExpandedId(null);
            return;
        }

        setExpandedId(playlist.id);

        if (
            songCounts[playlist.id] !==
            undefined
        ) {
            return;
        }

        try {
            setLoadingSongs((current) => ({
                ...current,
                [playlist.id]: true,
            }));

            const songs =
                await getPlaylistSongs(
                    playlist.id
                );

            setSongCounts((current) => ({
                ...current,
                [playlist.id]:
                    Array.isArray(songs)
                        ? songs.length
                        : songs?.songs?.length ||
                          0,
            }));
        } catch (err) {
            console.error(
                "Failed to load playlist songs:",
                err
            );

            setSongCounts((current) => ({
                ...current,
                [playlist.id]: 0,
            }));
        } finally {
            setLoadingSongs((current) => ({
                ...current,
                [playlist.id]: false,
            }));
        }
    };

    const handleAddPlaylist = async (data) => {
        try {
            setSaving(true);

            await createPlaylist(data);

            setModal(null);

            setMessage({
                type: "success",
                text: "Playlist added successfully.",
            });

            await fetchPlaylists();
        } finally {
            setSaving(false);
        }
    };

    const handleEditPlaylist = async (data) => {
        if (!modal?.playlist) {
            return;
        }

        try {
            setSaving(true);

            await updatePlaylist(
                modal.playlist.id,
                data
            );

            setModal(null);

            setMessage({
                type: "success",
                text: "Playlist updated successfully.",
            });

            await fetchPlaylists();
        } finally {
            setSaving(false);
        }
    };

    const handleTogglePlaylist = async (
        playlist
    ) => {
        try {
            setActionLoading((current) => ({
                ...current,
                [playlist.id]: true,
            }));

            const updated =
                await updatePlaylist(
                    playlist.id,
                    {
                        enabled:
                            !playlist.enabled,
                    }
                );

            setPlaylists((current) =>
                current.map((item) =>
                    item.id === playlist.id
                        ? {
                              ...item,
                              ...updated,
                          }
                        : item
                )
            );

            setMessage({
                type: "success",
                text: playlist.enabled
                    ? "Playlist disabled."
                    : "Playlist enabled.",
            });
        } catch (err) {
            setMessage({
                type: "error",
                text:
                    err.response?.data?.detail ||
                    "Failed to update playlist.",
            });
        } finally {
            setActionLoading((current) => ({
                ...current,
                [playlist.id]: false,
            }));
        }
    };

    const handleDeletePlaylist = async (
        playlist
    ) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete "${playlist.name}"?`
        );

        if (!confirmed) {
            return;
        }

        try {
            setActionLoading((current) => ({
                ...current,
                [playlist.id]: true,
            }));

            await deletePlaylist(
                playlist.id
            );

            setPlaylists((current) =>
                current.filter(
                    (item) =>
                        item.id !== playlist.id
                )
            );

            setSongCounts((current) => {
                const next = {
                    ...current,
                };

                delete next[playlist.id];

                return next;
            });

            if (
                expandedId === playlist.id
            ) {
                setExpandedId(null);
            }

            setMessage({
                type: "success",
                text: "Playlist deleted successfully.",
            });
        } catch (err) {
            setMessage({
                type: "error",
                text:
                    err.response?.data?.detail ||
                    "Failed to delete playlist.",
            });
        } finally {
            setActionLoading((current) => ({
                ...current,
                [playlist.id]: false,
            }));
        }
    };

    if (loading) {
        return (
            <div className="playlists-page">
                <div className="playlists-loading">
                    <div className="loading-spinner" />

                    <p>
                        Loading playlists...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="playlists-page">
                <div className="playlists-header">
                    <div>
                        <h1>Playlists</h1>

                        <p>
                            Manage your synchronized
                            YouTube playlists.
                        </p>
                    </div>
                </div>

                <div className="playlists-error">
                    <h3>
                        Unable to load playlists
                    </h3>

                    <p>{error}</p>

                    <button
                        className="btn btn-primary"
                        onClick={fetchPlaylists}
                    >
                        ↻ Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="playlists-page">
            {/* Header */}
            <div className="playlists-header">
                <div>
                    <h1>Playlists</h1>

                    <p>
                        Manage your synchronized
                        YouTube playlists.
                    </p>
                </div>

                <div className="playlist-header-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={fetchPlaylists}
                    >
                        ↻ Refresh
                    </button>

                    <button
                        className="btn btn-primary"
                        onClick={() =>
                            setModal({
                                type: "add",
                            })
                        }
                    >
                        + Add Playlist
                    </button>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div
                    className={`playlist-alert ${
                        message.type === "error"
                            ? "error"
                            : "success"
                    }`}
                >
                    <span>
                        {message.text}
                    </span>

                    <button
                        onClick={() =>
                            setMessage(null)
                        }
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Playlist list */}
            {playlists.length === 0 ? (
                <div className="playlists-empty">
                    <div className="empty-icon">
                        ☷
                    </div>

                    <h3>
                        No playlists added
                    </h3>

                    <p>
                        Add a YouTube playlist to
                        start synchronizing your
                        music.
                    </p>

                    <button
                        className="btn btn-primary"
                        onClick={() =>
                            setModal({
                                type: "add",
                            })
                        }
                    >
                        + Add Playlist
                    </button>
                </div>
            ) : (
                <div className="playlist-list">
                    {playlists.map((playlist) => {
                        const expanded =
                            expandedId ===
                            playlist.id;

                        const busy =
                            actionLoading[
                                playlist.id
                            ];

                        return (
                            <div
                                className={`playlist-item ${
                                    expanded
                                        ? "expanded"
                                        : ""
                                }`}
                                key={playlist.id}
                            >
                                {/* Main row */}
                                <button
                                    type="button"
                                    className="playlist-row"
                                    onClick={() =>
                                        toggleExpand(
                                            playlist
                                        )
                                    }
                                >
                                    <div className="playlist-icon">
                                        ☷
                                    </div>

                                    <div className="playlist-main">
                                        <div className="playlist-name">
                                            {
                                                playlist.name
                                            }
                                        </div>

                                        <div className="playlist-url">
                                            {
                                                playlist.url
                                            }
                                        </div>
                                    </div>

                                    <StatusBadge
                                        enabled={
                                            playlist.enabled
                                        }
                                    />

                                    <div className="playlist-chevron">
                                        {expanded
                                            ? "⌃"
                                            : "⌄"}
                                    </div>
                                </button>

                                {/* Expanded details */}
                                {expanded && (
                                    <div className="playlist-details">
                                        <div className="playlist-detail-grid">
                                            <div className="playlist-detail">
                                                <span>
                                                    Songs
                                                </span>

                                                <strong>
                                                    {loadingSongs[
                                                        playlist
                                                            .id
                                                    ]
                                                        ? "..."
                                                        : songCounts[
                                                              playlist
                                                                  .id
                                                          ] ??
                                                          0}
                                                </strong>
                                            </div>

                                            <div className="playlist-detail">
                                                <span>
                                                    Status
                                                </span>

                                                <StatusBadge
                                                    enabled={
                                                        playlist.enabled
                                                    }
                                                />
                                            </div>

                                            <div className="playlist-detail playlist-detail-wide">
                                                <span>
                                                    Playlist ID
                                                </span>

                                                <strong>
                                                    {
                                                        playlist.youtube_playlist_id
                                                    }
                                                </strong>
                                            </div>
                                        </div>

                                        <div className="playlist-actions">
                                            <div className="playlist-left-actions">
                                                <button
                                                    className={`btn ${
                                                        playlist.enabled
                                                            ? "btn-warning"
                                                            : "btn-success"
                                                    }`}
                                                    onClick={() =>
                                                        handleTogglePlaylist(
                                                            playlist
                                                        )
                                                    }
                                                    disabled={
                                                        busy
                                                    }
                                                >
                                                    {busy
                                                        ? "Updating..."
                                                        : playlist.enabled
                                                            ? "Disable"
                                                            : "Enable"}
                                                </button>

                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() =>
                                                        setModal(
                                                            {
                                                                type: "edit",
                                                                playlist,
                                                            }
                                                        )
                                                    }
                                                    disabled={
                                                        busy
                                                    }
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    className="btn btn-danger"
                                                    onClick={() =>
                                                        handleDeletePlaylist(
                                                            playlist
                                                        )
                                                    }
                                                    disabled={
                                                        busy
                                                    }
                                                >
                                                    {busy
                                                        ? "Deleting..."
                                                        : "Delete"}
                                                </button>
                                            </div>

                                            <a
                                                href={
                                                    playlist.url
                                                }
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-secondary"
                                            >
                                                ↗ Open on YouTube
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {modal && (
                <PlaylistModal
                    mode={modal.type}
                    playlist={
                        modal.playlist
                    }
                    onClose={() =>
                        setModal(null)
                    }
                    onSubmit={
                        modal.type === "edit"
                            ? handleEditPlaylist
                            : handleAddPlaylist
                    }
                    loading={saving}
                />
            )}
        </div>
    );
}

export default Playlists;