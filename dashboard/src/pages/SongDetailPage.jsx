import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Calendar,
    Disc,
    FileText,
    ListMusic,
    Music,
    Pause,
    Play,
    RefreshCw,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
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
        loadSongDetails();
    }, [songId]);

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
            <button className="back-btn" onClick={() => navigate(-1)}>
                <ArrowLeft size={18} /> Back
            </button>

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

            {/* Grid Layout: Left Details Table & Right Lyrics */}
            <div className="song-detail-grid">
                {/* Metadata Details Card */}
                <div className="detail-card">
                    <h3>Metadata & Track Information</h3>
                    <table className="meta-table">
                        <tbody>
                            <tr>
                                <td>Title</td>
                                <td>{title}</td>
                            </tr>
                            <tr>
                                <td>Artist</td>
                                <td>{artist}</td>
                            </tr>
                            <tr>
                                <td>Album</td>
                                <td>{album}</td>
                            </tr>
                            {song.album_artist && (
                                <tr>
                                    <td>Album Artist</td>
                                    <td>{song.album_artist}</td>
                                </tr>
                            )}
                            {song.release_year && (
                                <tr>
                                    <td>Release Year</td>
                                    <td>{song.release_year}</td>
                                </tr>
                            )}
                            {song.genre && (
                                <tr>
                                    <td>Genre</td>
                                    <td>{song.genre}</td>
                                </tr>
                            )}
                            {song.track_number && (
                                <tr>
                                    <td>Track Number</td>
                                    <td>{song.track_number}</td>
                                </tr>
                            )}
                            <tr>
                                <td>Duration</td>
                                <td>{formatTime(song.duration_seconds)}</td>
                            </tr>
                            <tr>
                                <td>Download Status</td>
                                <td>
                                    <span className={`status-pill pill-${song.download_status}`}>
                                        {song.download_status}
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td>Metadata State</td>
                                <td>
                                    <span className={`status-pill pill-${song.metadata_state || "raw"}`}>
                                        {song.metadata_state || "raw"}
                                    </span>
                                </td>
                            </tr>
                            {song.file_path && (
                                <tr>
                                    <td>File Path</td>
                                    <td className="path-cell">{song.file_path}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Dedicated Lyrics Card */}
                <div className="detail-card lyrics-card">
                    <div className="lyrics-header">
                        <h3><FileText size={18} /> Lyrics</h3>
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

                    <div className="lyrics-body">
                        {lyricsData?.lyrics ? (
                            <Lyrics lyrics={lyricsData.lyrics} currentTime={currentTime} />
                        ) : (
                            <div className="lyrics-empty">
                                <FileText size={40} />
                                <p>No lyrics available for this track.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
