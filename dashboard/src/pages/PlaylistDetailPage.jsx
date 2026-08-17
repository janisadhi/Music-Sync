import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Disc,
    Edit3,
    ExternalLink,
    ListMusic,
    Music,
    Play,
    RefreshCw,
    RotateCcw,
    Shuffle,
    Sparkles,
    Trash2,
    X,
    Zap,
} from "lucide-react";
import LayoutControls, { LAYOUT_MODES } from "../components/LayoutControls";
import SelectionActionBar from "../components/SelectionActionBar";
import SongCard from "../components/SongCard";
import SongRow from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import {
    deletePlaylist,
    getPlaylist,
    getPlaylistSongs,
    syncPlaylist,
    updatePlaylist,
} from "../services/playlists";
import { deleteSong, retryDownload } from "../services/songs";
import "../styles/playlists.css";
import "../styles/songDetailPage.css";

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "0 min";
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
}

export default function PlaylistDetailPage() {
    const { playlistId } = useParams();
    const navigate = useNavigate();

    const [playlist, setPlaylist] = useState(null);
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [layoutMode, setLayoutMode] = useState(() => {
        return localStorage.getItem("playlist_layout_mode") || LAYOUT_MODES.LIST;
    });

    const [sortBy, setSortBy] = useState("position");
    const [message, setMessage] = useState(null);

    const { playPlaylist } = usePlayer();

    const handleLayoutChange = (mode) => {
        setLayoutMode(mode);
        localStorage.setItem("playlist_layout_mode", mode);
    };

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

    const handleDeleteSong = async (songId) => {
        if (!window.confirm("Delete this song from the playlist?")) return;
        try {
            await deleteSong(songId);
            setSongs((prev) => prev.filter((s) => s.id !== songId));
        } catch (err) {
            alert("Failed to delete song.");
        }
    };

    const handleRetrySong = async (songId) => {
        try {
            await retryDownload(songId);
            await loadData();
        } catch (err) {
            alert("Failed to retry download.");
        }
    };

    const handleSyncPlaylist = async () => {
        try {
            await syncPlaylist(playlist.id);
            setMessage({ type: "success", text: "Playlist synchronization triggered." });
            await loadData();
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.detail || "Sync failed." });
        }
    };

    if (loading) {
        return (
            <div className="song-detail-loading">
                <RefreshCw size={32} className="spin-icon" />
                <p>Loading playlist...</p>
            </div>
        );
    }

    if (error || !playlist) {
        return (
            <div className="playlists-page">
                <button className="back-btn" onClick={() => navigate("/playlists")}>
                    <ArrowLeft size={16} /> Back to Playlists
                </button>
                <div className="playlists-error-card">
                    <AlertCircle size={40} className="error-icon" />
                    <h3>Unable to load playlist</h3>
                    <p>{error || "Playlist not found."}</p>
                </div>
            </div>
        );
    }

    const artwork = songs.find((s) => s.thumbnail_url)?.thumbnail_url;
    const totalDuration = songs.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);

    const sortedSongs = [...songs].sort((a, b) => {
        if (sortBy === "title") return (a.title || a.raw_title || "").localeCompare(b.title || b.raw_title || "");
        if (sortBy === "artist") return (a.artist || "").localeCompare(b.artist || "");
        if (sortBy === "album") return (a.album || "").localeCompare(b.album || "");
        if (sortBy === "duration") return (b.duration_seconds || 0) - (a.duration_seconds || 0);
        return (a.position || 0) - (b.position || 0);
    });

    return (
        <div className="song-detail-container">
            <button className="back-btn" onClick={() => navigate(-1)}>
                <ArrowLeft size={18} /> Back
            </button>

            {/* Hero Playlist Header */}
            <div className="song-detail-hero">
                <div className="hero-artwork-wrap">
                    {artwork ? (
                        <img src={artwork} alt={playlist.name} className="hero-artwork" />
                    ) : (
                        <div className="hero-artwork-fallback">
                            <ListMusic size={80} />
                        </div>
                    )}
                </div>

                <div className="hero-info">
                    <span className="hero-badge">Playlist</span>
                    <h1 className="hero-title">{playlist.name}</h1>

                    <div className="hero-meta-row">
                        <span>{songs.length} {songs.length === 1 ? "track" : "tracks"}</span>
                        <span className="meta-bullet">•</span>
                        <span>{formatDuration(totalDuration)}</span>
                        <span className="meta-bullet">•</span>
                        <a
                            href={playlist.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#3b82f6", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                            YouTube Link <ExternalLink size={14} />
                        </a>
                    </div>

                    <div className="header-actions" style={{ marginTop: "16px" }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => playPlaylist(sortedSongs, 0, false)}
                            disabled={sortedSongs.length === 0}
                        >
                            <Play size={16} /> Play All
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => playPlaylist(sortedSongs, 0, true)}
                            disabled={sortedSongs.length === 0}
                        >
                            <Shuffle size={16} /> Shuffle
                        </button>
                        <button className="btn btn-secondary" onClick={handleSyncPlaylist}>
                            <Zap size={16} /> Sync
                        </button>
                    </div>
                </div>
            </div>

            {/* Notification Banner */}
            {message && (
                <div className={`playlist-alert-banner alert-${message.type}`} style={{ margin: "16px 0" }}>
                    {message.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{message.text}</span>
                    <button onClick={() => setMessage(null)} className="alert-close">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Playlist Track Toolbar */}
            <div className="songs-toolbar">
                <div className="toolbar-filters">
                    <select
                        className="filter-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="position">Sort by Track Position</option>
                        <option value="title">Sort by Title</option>
                        <option value="artist">Sort by Artist</option>
                        <option value="album">Sort by Album</option>
                        <option value="duration">Sort by Duration</option>
                    </select>
                </div>

                <LayoutControls currentMode={layoutMode} onModeChange={handleLayoutChange} />
            </div>

            {/* Song Grid / List View */}
            <div className="playlist-songs-viewport">
                {sortedSongs.length === 0 ? (
                    <div className="songs-empty-card">
                        <ListMusic size={40} />
                        <h3>No tracks in this playlist</h3>
                        <p>Trigger a sync to discover tracks from YouTube Music.</p>
                    </div>
                ) : (
                    <>
                        {layoutMode === LAYOUT_MODES.LARGE_GRID && (
                            <div className="grid-layout grid-large">
                                {sortedSongs.map((song) => (
                                    <SongCard
                                        key={song.id}
                                        song={song}
                                        queue={sortedSongs}
                                        cardSize="large"
                                        onDelete={handleDeleteSong}
                                        onRetry={handleRetrySong}
                                    />
                                ))}
                            </div>
                        )}

                        {layoutMode === LAYOUT_MODES.MEDIUM_GRID && (
                            <div className="grid-layout grid-medium">
                                {sortedSongs.map((song) => (
                                    <SongCard
                                        key={song.id}
                                        song={song}
                                        queue={sortedSongs}
                                        cardSize="medium"
                                        onDelete={handleDeleteSong}
                                        onRetry={handleRetrySong}
                                    />
                                ))}
                            </div>
                        )}

                        {layoutMode === LAYOUT_MODES.SMALL_GRID && (
                            <div className="grid-layout grid-small">
                                {sortedSongs.map((song) => (
                                    <SongCard
                                        key={song.id}
                                        song={song}
                                        queue={sortedSongs}
                                        cardSize="small"
                                        onDelete={handleDeleteSong}
                                        onRetry={handleRetrySong}
                                    />
                                ))}
                            </div>
                        )}

                        {layoutMode === LAYOUT_MODES.LIST && (
                            <div className="list-layout">
                                <div className="list-header">
                                    <span style={{ width: "28px" }}></span>
                                    <span style={{ width: "32px" }}>#</span>
                                    <span style={{ flex: 2 }}>Title & Artist</span>
                                    <span style={{ flex: 1.5 }}>Album</span>
                                    <span style={{ width: "120px" }}>Genre</span>
                                    <span style={{ width: "60px", textAlign: "right" }}>Duration</span>
                                    <span style={{ width: "32px" }}></span>
                                </div>
                                {sortedSongs.map((song, idx) => (
                                    <SongRow
                                        key={song.id}
                                        song={song}
                                        queue={sortedSongs}
                                        trackIndex={idx}
                                        onDelete={handleDeleteSong}
                                        onRetry={handleRetrySong}
                                    />
                                ))}
                            </div>
                        )}

                        {layoutMode === LAYOUT_MODES.COMPACT && (
                            <div className="compact-list-layout">
                                {sortedSongs.map((song) => (
                                    <SongRow
                                        key={song.id}
                                        song={song}
                                        queue={sortedSongs}
                                        isCompact={true}
                                        onDelete={handleDeleteSong}
                                        onRetry={handleRetrySong}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Floating Selection Action Bar */}
                        <SelectionActionBar
                            visibleSongs={sortedSongs}
                            onNotification={(notif) => {
                                setMessage(notif);
                                loadData();
                            }}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
