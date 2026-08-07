import { useEffect, useMemo, useRef, useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    Clock,
    Download,
    FileText,
    Filter,
    Music,
    Pause,
    Play,
    RefreshCw,
    RotateCcw,
    Search,
    Trash2,
    Volume2,
    VolumeX,
    X,
} from "lucide-react";
import {
    getSongs,
    getSongAudioUrl,
    retryDownload,
    retryLyrics,
    deleteSong,
    getArtists,
} from "../services/songs";
import { getPlaylists } from "../services/playlists";
import Lyrics from "../components/Lyrics";
import "../styles/songs.css";

function Songs() {
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [search, setSearch] = useState("");
    const [songFilter, setSongFilter] = useState("all");
    const [lyricsFilter, setLyricsFilter] = useState("all");
    const [artistFilter, setArtistFilter] = useState("all");
    const [playlistFilter, setPlaylistFilter] = useState("all");
    const [artists, setArtists] = useState([]);
    const [playlists, setPlaylists] = useState([]);

    const [expandedSongId, setExpandedSongId] = useState(null);
    const [currentSong, setCurrentSong] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsPlayingMuted] = useState(false);

    const audioRef = useRef(null);

    const fetchArtists = async () => {
        try {
            const data = await getArtists();
            setArtists(data);
        } catch (err) {
            console.error("Failed to fetch artists", err);
        }
    };

    const fetchPlaylists = async () => {
        try {
            const data = await getPlaylists();
            setPlaylists(data);
        } catch (err) {
            console.error("Failed to fetch playlists", err);
        }
    };

    const fetchSongs = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = {};
            if (artistFilter !== "all") {
                params.artist = artistFilter;
            }
            if (playlistFilter !== "all") {
                params.playlist_id = playlistFilter;
            }

            const data = await getSongs(params);
            setSongs(data);
            await fetchArtists();
            await fetchPlaylists();
        } catch (err) {
            console.error("Failed to fetch songs:", err);
            setError("Failed to load songs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSongs();
    }, [artistFilter, playlistFilter]);

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

    const formatDuration = (seconds) => {
        if (!seconds || isNaN(seconds)) return "00:00";
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    };

    const getSongStatus = (status) => {
        switch (status) {
            case "downloaded":
            case "completed":
                return "success";
            case "failed":
                return "failed";
            case "pending":
                return "pending";
            default:
                return "unavailable";
        }
    };

    const getLyricsStatus = (song) => {
        switch (song.lyrics_status) {
            case "downloaded":
            case "completed":
                return "success";
            case "failed":
                return "failed";
            case "pending":
                return "pending";
            case "unavailable":
            default:
                return "unavailable";
        }
    };

    const filteredSongs = useMemo(() => {
        const query = search.trim().toLowerCase();

        return songs.filter((song) => {
            if (query) {
                const searchableText = [song.title, song.artist, song.album]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                if (!searchableText.includes(query)) return false;
            }

            if (songFilter !== "all") {
                const status = getSongStatus(song.download_status);
                if (songFilter === "downloaded" && status !== "success") return false;
                if (songFilter === "pending" && status !== "pending") return false;
                if (songFilter === "failed" && status !== "failed") return false;
            }

            if (lyricsFilter !== "all") {
                const status = getLyricsStatus(song);
                if (lyricsFilter === "available" && status !== "success") return false;
                if (lyricsFilter === "pending" && status !== "pending") return false;
                if (lyricsFilter === "failed" && status !== "failed") return false;
                if (lyricsFilter === "unavailable" && status !== "unavailable") return false;
            }

            if (artistFilter !== "all" && song.artist) {
                if (song.artist.toLowerCase() !== artistFilter.toLowerCase()) return false;
            }

            if (playlistFilter !== "all") {
                if (Number(song.playlist_id) !== Number(playlistFilter)) return false;
            }

            return true;
        });
    }, [songs, search, songFilter, lyricsFilter, artistFilter, playlistFilter]);

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
        return () => {
            audio.removeEventListener("canplay", handleCanPlay);
        };
    }, [currentSong]);

    const handleTimeUpdate = () => {
        const audio = audioRef.current;
        if (!audio) return;
        setCurrentTime(audio.currentTime);
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
            setIsPlayingMuted(newVolume === 0);
        }
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isMuted) {
            audio.muted = false;
            setIsPlayingMuted(false);
        } else {
            audio.muted = true;
            setIsPlayingMuted(true);
        }
    };

    const handleRetryDownloadSong = async (songId) => {
        try {
            await retryDownload(songId);
            await fetchSongs();
        } catch (err) {
            console.error("Retry download failed:", err);
        }
    };

    const handleRetryLyricsSong = async (songId) => {
        try {
            await retryLyrics(songId);
            await fetchSongs();
        } catch (err) {
            console.error("Retry lyrics failed:", err);
        }
    };

    const handleDeleteSongItem = async (songId) => {
        if (!window.confirm("Are you sure you want to delete this song?")) return;
        try {
            await deleteSong(songId);
            if (currentSong?.id === songId) {
                setCurrentSong(null);
                setIsPlaying(false);
            }
            await fetchSongs();
        } catch (err) {
            console.error("Delete song failed:", err);
        }
    };

    if (loading) {
        return (
            <div className="songs-loading-screen">
                <RefreshCw className="spin-icon" size={32} />
                <p>Loading Music Catalog...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="songs-page">
                <div className="songs-error-card">
                    <AlertCircle size={40} className="error-icon" />
                    <h2>Unable to load music catalog</h2>
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={fetchSongs}>
                        <RefreshCw size={16} /> Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="songs-container">
            {/* Header */}
            <header className="songs-header">
                <div>
                    <h1>Songs Catalog</h1>
                    <p className="subtitle">
                        Browse, play, and synchronize tracks in your music library ({filteredSongs.length} of {songs.length} songs)
                    </p>
                </div>
                <div className="songs-header-actions">
                    <button className="btn btn-secondary" onClick={fetchSongs}>
                        <RefreshCw size={15} /> Refresh
                    </button>
                </div>
            </header>

            {/* Search & Filters Toolbar */}
            <section className="songs-toolbar-card">
                <div className="search-input-wrapper">
                    <Search size={18} className="search-input-icon" />
                    <input
                        type="text"
                        placeholder="Search by song title, artist, or album..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className="clear-search-btn" onClick={() => setSearch("")}>
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="filter-selects-group">
                    <select value={songFilter} onChange={(e) => setSongFilter(e.target.value)}>
                        <option value="all">All Download Statuses</option>
                        <option value="downloaded">Downloaded</option>
                        <option value="pending">Pending Download</option>
                        <option value="failed">Failed Download</option>
                    </select>

                    <select value={lyricsFilter} onChange={(e) => setLyricsFilter(e.target.value)}>
                        <option value="all">All Lyrics Statuses</option>
                        <option value="available">Lyrics Available</option>
                        <option value="pending">Lyrics Pending</option>
                        <option value="failed">Lyrics Failed</option>
                        <option value="unavailable">Lyrics Unavailable</option>
                    </select>

                    <select value={artistFilter} onChange={(e) => setArtistFilter(e.target.value)}>
                        <option value="all">All Artists</option>
                        {artists.map((a) => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>

                    <select value={playlistFilter} onChange={(e) => setPlaylistFilter(e.target.value)}>
                        <option value="all">All Playlists</option>
                        {playlists.map((pl) => (
                            <option key={pl.id} value={pl.id}>{pl.name}</option>
                        ))}
                    </select>

                    {(search || songFilter !== "all" || lyricsFilter !== "all" || artistFilter !== "all" || playlistFilter !== "all") && (
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                                setSearch("");
                                setSongFilter("all");
                                setLyricsFilter("all");
                                setArtistFilter("all");
                                setPlaylistFilter("all");
                            }}
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            </section>

            {/* Songs List */}
            {filteredSongs.length === 0 ? (
                <div className="songs-empty-card">
                    <Music size={36} className="text-muted" />
                    <h3>No matching songs found</h3>
                    <p>Try adjusting your search query or filters.</p>
                </div>
            ) : (
                <div className="songs-list-container">
                    {filteredSongs.map((song, index) => {
                        const isExpanded = expandedSongId === song.id;
                        const isCurrent = currentSong?.id === song.id;
                        const songStatus = getSongStatus(song.download_status);
                        const lyricsStatus = getLyricsStatus(song);

                        return (
                            <div
                                key={song.id}
                                className={`song-item-card ${isExpanded ? "expanded" : ""} ${isCurrent ? "playing" : ""}`}
                            >
                                {/* Main Row */}
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
                                        <span className={`status-pill ${songStatus}`}>
                                            <Download size={12} /> {song.download_status}
                                        </span>
                                        <span className={`status-pill ${lyricsStatus}`}>
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
                                            title={isCurrent && isPlaying ? "Pause" : "Play track"}
                                        >
                                            {isCurrent && isPlaying ? <Pause size={16} /> : <Play size={16} />}
                                        </button>
                                    )}

                                    <ChevronDown className={`expand-chevron ${isExpanded ? "open" : ""}`} size={18} />
                                </div>

                                {/* Expanded Section */}
                                {isExpanded && (
                                    <div className="song-expanded-details">
                                        {/* Player Panel with Seek Bar */}
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

                                                {/* Interactive Seek Bar */}
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
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => handleRetryDownloadSong(song.id)}
                                                >
                                                    <RotateCcw size={14} /> Retry Download
                                                </button>
                                            </div>
                                        )}

                                        {/* Action Bar */}
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

                                        {/* Synced Lyrics Component */}
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

            {/* Persistent Audio Element */}
            <audio
                ref={audioRef}
                preload="metadata"
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                }}
                style={{ display: "none" }}
            />
        </div>
    );
}

export default Songs;