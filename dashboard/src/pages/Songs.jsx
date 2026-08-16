import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    Disc,
    ListMusic,
    Music,
    Play,
    RefreshCw,
    Search,
    Shuffle,
    Tag,
    User,
} from "lucide-react";
import LayoutControls, { LAYOUT_MODES } from "../components/LayoutControls";
import SongCard from "../components/SongCard";
import SongRow from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import { deleteSong, getAlbums, getArtists, getGenres, getSongs, retryDownload } from "../services/songs";
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
    const [selectedArtistFilter, setSelectedArtistFilter] = useState("all");
    const [sortBy, setSortBy] = useState("title"); // "title" | "artist" | "album" | "duration"

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
            setSongs(songsData);
            setArtists(artistsData);
            setAlbums(albumsData);
            setGenres(genresData);
        } catch (err) {
            console.error("Failed to load music library:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDeleteSong = async (songId) => {
        if (!window.confirm("Are you sure you want to delete this song?")) return;
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

    // Filter & Sort songs
    const filteredSongs = songs.filter((song) => {
        const title = (song.title || song.raw_title || "").toLowerCase();
        const artist = (song.artist || "").toLowerCase();
        const album = (song.album || "").toLowerCase();
        const query = searchQuery.toLowerCase();

        const matchesSearch = title.includes(query) || artist.includes(query) || album.includes(query);
        const matchesArtist = selectedArtistFilter === "all" || song.artist === selectedArtistFilter;

        return matchesSearch && matchesArtist;
    });

    const sortedSongs = [...filteredSongs].sort((a, b) => {
        if (sortBy === "artist") {
            return (a.artist || "").localeCompare(b.artist || "");
        }
        if (sortBy === "album") {
            return (a.album || "").localeCompare(b.album || "");
        }
        if (sortBy === "duration") {
            return (b.duration_seconds || 0) - (a.duration_seconds || 0);
        }
        return (a.title || a.raw_title || "").localeCompare(b.title || b.raw_title || "");
    });

    return (
        <div className="songs-page-container">
            {/* Hero Header */}
            <header className="songs-header">
                <div className="header-title-block">
                    <h1>Music Library</h1>
                    <p className="subtitle">
                        Browse, search, and listen to your Beets-enriched music collection.
                    </p>
                </div>

                <div className="header-actions">
                    <button
                        className="btn btn-primary"
                        onClick={() => playPlaylist(sortedSongs, 0, false)}
                        disabled={sortedSongs.length === 0}
                    >
                        <Play size={16} /> Play All ({sortedSongs.length})
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => playPlaylist(sortedSongs, 0, true)}
                        disabled={sortedSongs.length === 0}
                    >
                        <Shuffle size={16} /> Shuffle All
                    </button>
                </div>
            </header>

            {/* Hierarchical Sub-Navigation Tabs */}
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

            {/* Toolbar: Search, Filters, Sorting & Layout Controls */}
            {activeTab === "songs" && (
                <div className="songs-toolbar">
                    <div className="search-box">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search title, artist, or album..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="toolbar-filters">
                        {artists.length > 0 && (
                            <select
                                className="filter-select"
                                value={selectedArtistFilter}
                                onChange={(e) => setSelectedArtistFilter(e.target.value)}
                            >
                                <option value="all">All Artists</option>
                                {artists.map((art) => (
                                    <option key={art} value={art}>
                                        {art}
                                    </option>
                                ))}
                            </select>
                        )}

                        <select
                            className="filter-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="title">Sort by Title</option>
                            <option value="artist">Sort by Artist</option>
                            <option value="album">Sort by Album</option>
                            <option value="duration">Sort by Duration</option>
                        </select>
                    </div>

                    <LayoutControls activeLayout={layoutMode} onChangeLayout={handleLayoutChange} />
                </div>
            )}

            {/* Main Content Area */}
            {loading ? (
                <div className="library-loading">
                    <RefreshCw size={28} className="spin-icon" />
                    <p>Loading your music library...</p>
                </div>
            ) : (
                <>
                    {/* SONGS TAB */}
                    {activeTab === "songs" && (
                        sortedSongs.length === 0 ? (
                            <div className="library-empty-state">
                                <Music size={48} />
                                <h3>No songs found</h3>
                                <p>Try adjusting your search query or artist filters.</p>
                            </div>
                        ) : (
                            <div className={`songs-layout-wrapper mode-${layoutMode}`}>
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
                            </div>
                        )
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