import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Calendar,
    Disc,
    FileText,
    ListMusic,
    Maximize2,
    Music,
    Pause,
    Play,
    RefreshCw,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
    Sparkles,
    Tag,
    User,
    Volume2,
    VolumeX,
} from "lucide-react";
import Lyrics from "../components/Lyrics";
import { usePlayer } from "../context/PlayerContext";
import { getSong, getSongLyrics, retryLyrics } from "../services/songs";
import "../styles/songDetailPage.css";

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function SongDetailPage() {
    const { songId } = useParams();
    const navigate = useNavigate();
    const [song, setSong] = useState(null);
    const [lyricsData, setLyricsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [retryingLyrics, setRetryingLyrics] = useState(false);

    const {
        currentSong,
        isPlaying,
        currentTime,
        duration,
        volume,
        shuffle,
        repeat,
        playSong,
        togglePlay,
        next,
        previous,
        seek,
        setVolume,
        toggleShuffle,
        toggleRepeat,
    } = usePlayer();

    const isThisSongCurrent = currentSong?.id === Number(songId);
    const initialCurrentSongIdRef = useRef(currentSong?.id);

    const loadSongDetails = async () => {
        try {
            setLoading(true);
            const data = await getSong(songId);
            setSong(data);
            try {
                const lyrics = await getSongLyrics(songId);
                setLyricsData(lyrics);
            } catch {
                setLyricsData(null);
            }
        } catch (err) {
            console.error("Failed to load song detail:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        initialCurrentSongIdRef.current = currentSong?.id;
        loadSongDetails();
    }, [songId]);

    // Handle track transitions while on detail view (e.g. Next/Prev clicked or track finished)
    useEffect(() => {
        if (!currentSong) return;

        if (currentSong.id === Number(songId)) {
            initialCurrentSongIdRef.current = currentSong.id;
            return;
        }

        if (currentSong.id !== initialCurrentSongIdRef.current) {
            initialCurrentSongIdRef.current = currentSong.id;
            navigate(`/songs/${currentSong.id}/detail`, { replace: true });
        }
    }, [currentSong, songId, navigate]);

    const handleRetryLyrics = async () => {
        try {
            setRetryingLyrics(true);
            await retryLyrics(songId);
            await loadSongDetails();
        } catch (err) {
            alert(err.response?.data?.detail || "Failed to retry lyrics.");
        } finally {
            setRetryingLyrics(false);
        }
    };

    if (loading) {
        return (
            <div className="song-detail-loading">
                <RefreshCw size={32} className="spin-icon" />
                <p>Loading song details...</p>
            </div>
        );
    }

    if (!song) {
        return (
            <div className="song-detail-not-found">
                <Music size={48} />
                <h2>Song Not Found</h2>
                <button className="btn btn-secondary" onClick={() => navigate("/songs")}>
                    <ArrowLeft size={16} /> Back to Songs
                </button>
            </div>
        );
    }

    const artwork = song.thumbnail_url;
    const title = song.title || song.raw_title || "Unknown Track";
    const artist = song.artist || "Unknown Artist";
    const album = song.album || "Unknown Album";

    return (
        <div className="song-detail-container">
            {/* Top Navigation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={18} /> Back
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Link to="/now-playing" className="btn btn-secondary btn-sm">
                        <Maximize2 size={14} /> Full Screen Player
                    </Link>

                    {song.downloaded_track_id && (
                        <Link to={`/metadata/tracks/${song.downloaded_track_id}`} className="btn btn-secondary btn-sm">
                            <Sparkles size={14} /> View Track Metadata Details
                        </Link>
                    )}
                </div>
            </div>

            {/* Hero Section */}
            <div className="song-detail-hero">
                <div className="hero-artwork-wrap">
                    {artwork ? (
                        <img src={artwork} alt={title} className="hero-artwork" />
                    ) : (
                        <div className="hero-artwork-fallback">
                            <Music size={80} />
                        </div>
                    )}
                </div>

                <div className="hero-info">
                    <span className="hero-badge">Beets Enriched Track</span>
                    <h1 className="hero-title">{title}</h1>

                    <div className="hero-meta-row">
                        <span className="hero-meta-item">
                            <User size={16} /> {artist}
                        </span>
                        <span className="meta-bullet">•</span>
                        <span className="hero-meta-item">
                            <Disc size={16} /> {album}
                        </span>
                        {song.release_year && (
                            <>
                                <span className="meta-bullet">•</span>
                                <span className="hero-meta-item">
                                    <Calendar size={16} /> {song.release_year}
                                </span>
                            </>
                        )}
                        {song.genre && (
                            <>
                                <span className="meta-bullet">•</span>
                                <span className="hero-meta-item">
                                    <Tag size={16} /> {song.genre}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Integrated Player Card */}
                    <div className="hero-player-card">
                        <div className="card-controls-row">
                            <button className={`player-btn ${shuffle ? "active" : ""}`} onClick={toggleShuffle}>
                                <Shuffle size={18} />
                            </button>
                            <button className="player-btn" onClick={previous}>
                                <SkipBack size={22} />
                            </button>
                            <button
                                className="player-btn main-play-btn"
                                onClick={() => {
                                    if (isThisSongCurrent) {
                                        togglePlay();
                                    } else {
                                        playSong(song, [song]);
                                    }
                                }}
                            >
                                {isThisSongCurrent && isPlaying ? <Pause size={24} /> : <Play size={24} className="play-icon-offset" />}
                            </button>
                            <button className="player-btn" onClick={next}>
                                <SkipForward size={22} />
                            </button>
                            <button className={`player-btn ${repeat !== "off" ? "active" : ""}`} onClick={toggleRepeat}>
                                {repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
                            </button>
                        </div>

                        {/* Progress Bar (if current song) */}
                        {isThisSongCurrent && (
                            <div className="card-progress-row">
                                <span>{formatTime(currentTime)}</span>
                                <input
                                    type="range"
                                    className="card-progress-slider"
                                    min={0}
                                    max={duration || 100}
                                    value={currentTime || 0}
                                    onChange={(e) => seek(parseFloat(e.target.value))}
                                />
                                <span>{formatTime(duration)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Spotify-style Lyrics Section */}
            <div className="spotify-lyrics-card">
                <div className="spotify-lyrics-header">
                    <h3><FileText size={20} /> Lyrics</h3>
                    {song.lyrics_status === "failed" || song.lyrics_status === "unavailable" ? (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleRetryLyrics}
                            disabled={retryingLyrics}
                        >
                            {retryingLyrics ? <RefreshCw size={14} className="spin-icon" /> : <RefreshCw size={14} />} Retry Fetch
                        </button>
                    ) : null}
                </div>

                <Lyrics song={song} lyrics={lyricsData?.lyrics} currentTime={isThisSongCurrent ? currentTime : 0} />
            </div>
        </div>
    );
}
