import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    AlertCircle,
    CheckCircle2,
    Disc,
    ListMusic,
    Music,
    Play,
    RefreshCw,
    Search,
    Shuffle,
    Tag,
    User,
    X,
} from "lucide-react";
import LayoutControls, { LAYOUT_MODES } from "../components/LayoutControls";
import SelectionActionBar from "../components/SelectionActionBar";
import SongCard from "../components/SongCard";
import SongRow from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import { deleteSong, getAlbums, getArtists, getGenres, getSongs, retryDownload, retryEnrichedLyrics } from "../services/songs";
import "../styles/songsPage.css";

export default function Songs() {
    const { playPlaylist } = usePlayer();
    const [activeTab, setActiveTab] = useState("songs"); // "songs" | "artists" | "albums" | "genres"
    const [layoutMode, setLayoutMode] = useState(() => {
        return localStorage.getItem("songs_layout_mode") || LAYOUT_MODES.MEDIUM_GRID;
    });

    const [songs, setSongs] = useState([]);
    const [artists, setArtists] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [genres, setGenres] = useState([]);

    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [downloadStatusFilter, setDownloadStatusFilter] = useState("all");
    const [lyricsStatusFilter, setLyricsStatusFilter] = useState("all");
    const [sortBy, setSortBy] = useState("title"); // "title" | "artist" | "album" | "duration"
    const [notification, setNotification] = useState(null);

    const handleLayoutChange = (mode) => {
        setLayoutMode(mode);
        localStorage.setItem("songs_layout_mode", mode);
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const [songsData, artistsData, albumsData, genresData] = await Promise.all([
                getSongs(),
                getArtists().catch(() => []),
                getAlbums().catch(() => []),
                getGenres().catch(() => []),
            ]);

            setSongs(Array.isArray(songsData) ? songsData : []);
            setArtists(Array.isArray(artistsData) ? artistsData : []);
            setAlbums(Array.isArray(albumsData) ? albumsData : []);
            setGenres(Array.isArray(genresData) ? genresData : []);
        } catch (err) {
            console.error("Failed to load music library data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDeleteSong = async (songId) => {
        if (!window.confirm("Delete this song?")) return;
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

    const handleRetryEnrichedLyrics = async (songId) => {
        try {
            await retryEnrichedLyrics(songId);
            setNotification({ type: "success", text: "Enriched lyrics lookup triggered." });
            await loadData();
        } catch (err) {
            alert("Failed to retry enriched lyrics.");
        }
    };

    // Filter logic
    const filteredSongs = songs.filter((song) => {
        const title = (song.title || song.raw_title || "").toLowerCase();
        const artist = (song.artist || "").toLowerCase();
        const album = (song.album || "").toLowerCase();
        const query = searchQuery.toLowerCase();

        const matchesQuery = title.includes(query) || artist.includes(query) || album.includes(query);

        const matchesDownloadStatus =
            downloadStatusFilter === "all" || song.download_status === downloadStatusFilter;

        const matchesLyricsStatus =
            lyricsStatusFilter === "all" || song.lyrics_status === lyricsStatusFilter;

        return matchesQuery && matchesDownloadStatus && matchesLyricsStatus;
    });

    // Sorting logic
    const sortedSongs = [...filteredSongs].sort((a, b) => {
        if (sortBy === "artist") return (a.artist || "").localeCompare(b.artist || "");
        if (sortBy === "album") return (a.album || "").localeCompare(b.album || "");
        if (sortBy === "duration") return (b.duration_seconds || 0) - (a.duration_seconds || 0);
        return (a.title || a.raw_title || "").localeCompare(b.title || b.raw_title || "");
    });

    return (
        <div className="songs-page-container">
            {/* Header Banner */}
            <header className="songs-header">
                <div className="header-info">
                    <h1>Music Library</h1>
                    <p className="subtitle">
                        Browse, search, and manage your synchronized track collection with Beets metadata.
                    </p>
                </div>

                <div className="header-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={() => playPlaylist(sortedSongs, 0, true)}
                        disabled={sortedSongs.length === 0}
                    >
                        <Shuffle size={16} /> Shuffle All
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => playPlaylist(sortedSongs, 0, false)}
                        disabled={sortedSongs.length === 0}
                    >
                        <Play size={16} /> Play All ({sortedSongs.length})
                    </button>
                </div>
            </header>

            {/* Notification Banner */}
            {notification && (
                <div className={`playlist-alert-banner alert-${notification.type}`}>
                    {notification.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{notification.text}</span>
                    <button onClick={() => setNotification(null)} className="alert-close">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Navigation Tabs */}
            <nav className="hierarchy-tabs">
                <button
                    className={`tab-btn ${activeTab === "songs" ? "active" : ""}`}
                    onClick={() => setActiveTab("songs")}
                >
                    <Music size={16} /> Songs ({songs.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === "artists" ? "active" : ""}`}
                    onClick={() => setActiveTab("artists")}
                >
                    <User size={16} /> Artists ({artists.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === "albums" ? "active" : ""}`}
                    onClick={() => setActiveTab("albums")}
                >
                    <Disc size={16} /> Albums ({albums.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === "genres" ? "active" : ""}`}
                    onClick={() => setActiveTab("genres")}
                >
                    <Tag size={16} /> Genres ({genres.length})
                </button>
            </nav>

            {/* Toolbar: Search, Filters & View Mode Toggles */}
            <div className="songs-toolbar">
                <div className="search-box">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by title, artist, album..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="toolbar-filters">
                    <select
                        className="filter-select"
                        value={downloadStatusFilter}
                        onChange={(e) => setDownloadStatusFilter(e.target.value)}
                        title="Filter by Song Download Status"
                    >
                        <option value="all">Song Status: All</option>
                        <option value="downloaded">Song Status: Downloaded</option>
                        <option value="pending">Song Status: Pending</option>
                        <option value="failed">Song Status: Failed</option>
                        <option value="unavailable">Song Status: Unavailable</option>
                    </select>

                    <select
                        className="filter-select"
                        value={lyricsStatusFilter}
                        onChange={(e) => setLyricsStatusFilter(e.target.value)}
                        title="Filter by Lyrics Download Status"
                    >
                        <option value="all">Lyrics Status: All</option>
                        <option value="downloaded">Lyrics Status: Downloaded</option>
                        <option value="pending">Lyrics Status: Pending</option>
                        <option value="failed">Lyrics Status: Failed</option>
                        <option value="unavailable">Lyrics Status: Unavailable</option>
                    </select>

                    <select
                        className="filter-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        title="Sort Library"
                    >
                        <option value="title">Sort by Title</option>
                        <option value="artist">Sort by Artist</option>
                        <option value="album">Sort by Album</option>
                        <option value="duration">Sort by Duration</option>
                    </select>
                </div>

                {activeTab === "songs" && (
                    <LayoutControls activeLayout={layoutMode} onChangeLayout={handleLayoutChange} />
                )}
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div className="library-loading">
                    <RefreshCw size={32} className="spin-icon" />
                    <p>Loading music library...</p>
                </div>
            ) : (
                <>
                    {/* SONGS TAB */}
                    {activeTab === "songs" && (
                        <>
                            {sortedSongs.length === 0 ? (
                                <div className="library-empty-state">
                                    <ListMusic size={48} />
                                    <h3>No tracks found</h3>
                                    <p>Try clearing filters or adding YouTube Music playlists to synchronize.</p>
                                </div>
                            ) : (
                                <div className={`songs-layout-view mode-${layoutMode}`}>
                                    {layoutMode === LAYOUT_MODES.LIST ? (
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
                                                    onRetryEnrichedLyrics={handleRetryEnrichedLyrics}
                                                />
                                            ))}
                                        </div>
                                    ) : layoutMode === LAYOUT_MODES.COMPACT ? (
                                        <div className="compact-list-layout">
                                            {sortedSongs.map((song) => (
                                                <SongRow
                                                    key={song.id}
                                                    song={song}
                                                    queue={sortedSongs}
                                                    isCompact
                                                    onDelete={handleDeleteSong}
                                                    onRetry={handleRetrySong}
                                                    onRetryEnrichedLyrics={handleRetryEnrichedLyrics}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div
                                            className={`grid-layout ${
                                                layoutMode === LAYOUT_MODES.LARGE_GRID
                                                    ? "grid-large"
                                                    : layoutMode === LAYOUT_MODES.SMALL_GRID
                                                    ? "grid-small"
                                                    : "grid-medium"
                                            }`}
                                        >
                                            {sortedSongs.map((song) => (
                                                <SongCard
                                                    key={song.id}
                                                    song={song}
                                                    queue={sortedSongs}
                                                    cardSize={
                                                        layoutMode === LAYOUT_MODES.LARGE_GRID
                                                            ? "large"
                                                            : layoutMode === LAYOUT_MODES.SMALL_GRID
                                                            ? "small"
                                                            : "medium"
                                                    }
                                                    onDelete={handleDeleteSong}
                                                    onRetry={handleRetrySong}
                                                    onRetryEnrichedLyrics={handleRetryEnrichedLyrics}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Floating Contextual Action Bar */}
                            <SelectionActionBar
                                visibleSongs={sortedSongs}
                                onNotification={(notif) => {
                                    setNotification(notif);
                                    loadData();
                                }}
                            />
                        </>
                    )}

                    {/* ARTISTS TAB */}
                    {activeTab === "artists" && (
                        <div className="artists-grid">
                            {artists.map((art) => {
                                const artistSongs = songs.filter((s) => s.artist === art);
                                const artImg = artistSongs.find((s) => s.thumbnail_url)?.thumbnail_url;
                                return (
                                    <Link key={art} to={`/artists/${encodeURIComponent(art)}`} className="artist-card">
                                        <div className="artist-avatar">
                                            {artImg ? (
                                                <img src={artImg} alt={art} />
                                            ) : (
                                                <User size={32} />
                                            )}
                                        </div>
                                        <span className="artist-name">{art}</span>
                                        <span className="artist-count">{artistSongs.length} {artistSongs.length === 1 ? "song" : "songs"}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {/* ALBUMS TAB */}
                    {activeTab === "albums" && (
                        <div className="albums-grid">
                            {albums.map((alb) => (
                                <Link key={alb.name} to={`/albums/${encodeURIComponent(alb.name)}`} className="album-card">
                                    <div className="album-art-wrap">
                                        {alb.thumbnail_url ? (
                                            <img src={alb.thumbnail_url} alt={alb.name} />
                                        ) : (
                                            <Disc size={40} />
                                        )}
                                    </div>
                                    <span className="album-title">{alb.name}</span>
                                    <span className="album-artist">{alb.artist}</span>
                                    <div className="album-footer">
                                        {alb.year && <span>{alb.year} · </span>}
                                        <span>{alb.song_count} {alb.song_count === 1 ? "track" : "tracks"}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* GENRES TAB */}
                    {activeTab === "genres" && (
                        <div className="genres-grid">
                            {genres.map((gen) => (
                                <div
                                    key={gen.name}
                                    className="genre-card"
                                    onClick={() => {
                                        setSearchQuery(gen.name);
                                        setActiveTab("songs");
                                    }}
                                >
                                    <Tag size={20} className="genre-icon" />
                                    <div className="genre-info">
                                        <span className="genre-title">{gen.name}</span>
                                        <span className="genre-count">{gen.song_count} {gen.song_count === 1 ? "track" : "tracks"}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}