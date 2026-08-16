import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Calendar,
    Disc,
    FileText,
    ListMusic,
    Minimize2,
    Music,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
    Tag,
    User,
    Volume2,
    VolumeX,
    X,
} from "lucide-react";
import Lyrics from "../components/Lyrics";
import { usePlayer } from "../context/PlayerContext";
import { getSongLyrics } from "../services/songs";
import { extractColorsFromImage } from "../utils/colorExtractor";
import "../styles/nowPlaying.css";

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function NowPlaying() {
    const navigate = useNavigate();
    const {
        currentSong,
        isPlaying,
        currentTime,
        duration,
        volume,
        shuffle,
        repeat,
        queue,
        playSong,
        togglePlay,
        next,
        previous,
        seek,
        setVolume,
        toggleShuffle,
        toggleRepeat,
    } = usePlayer();

    const [showLyrics, setShowLyrics] = useState(false);
    const [showQueue, setShowQueue] = useState(false);
    const [lyricsData, setLyricsData] = useState(null);
    const [palette, setPalette] = useState({
        dominant: "rgb(30, 41, 59)",
        secondary: "rgb(15, 23, 42)",
        accent: "rgb(59, 130, 246)",
        dark: "rgba(15, 23, 42, 0.95)",
        glow: "rgba(59, 130, 246, 0.35)",
    });

    const artwork = currentSong?.thumbnail_url;
    const title = currentSong?.title || currentSong?.raw_title || "Unknown Track";
    const artist = currentSong?.artist || "Unknown Artist";
    const album = currentSong?.album || "Unknown Album";

    // Request HTML5 native browser fullscreen mode (like pressing F11)
    useEffect(() => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }

        return () => {
            if (document.fullscreenElement) {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        };
    }, []);

    const handleExit = () => {
        if (document.fullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
        navigate(-1);
    };

    // Extract dynamic colors when artwork changes
    useEffect(() => {
        if (!artwork) return;
        extractColorsFromImage(artwork).then((colors) => {
            setPalette(colors);
        });
    }, [artwork]);

    // Load lyrics for current song
    useEffect(() => {
        if (!currentSong) {
            setLyricsData(null);
            return;
        }

        const fetchLyrics = async () => {
            try {
                const data = await getSongLyrics(currentSong.id);
                setLyricsData(data);
            } catch {
                setLyricsData(null);
            }
        };

        fetchLyrics();
    }, [currentSong?.id]);

    const hasLyrics = Boolean(lyricsData?.lyrics);

    if (!currentSong) {
        return (
            <div className="now-playing-fullscreen empty-state-canvas">
                <div className="glass-empty-card">
                    <Music size={64} className="empty-icon" />
                    <h2>No Song Currently Playing</h2>
                    <p>Select a track from your music library to begin playback.</p>
                    <button className="btn btn-primary" onClick={handleExit}>
                        <ArrowLeft size={16} /> Browse Music Library
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="now-playing-fullscreen"
            style={{
                "--dominant-color": palette.dominant,
                "--secondary-color": palette.secondary,
                "--accent-color": palette.accent,
                "--dark-color": palette.dark,
                "--glow-color": palette.glow,
            }}
        >
            {/* Ambient Blurred Background Layers */}
            <div className="ambient-background">
                {artwork && (
                    <img src={artwork} alt="" className="ambient-art-blur" />
                )}
                <div className="ambient-gradient-overlay" />
                <div className="ambient-glass-tint" />
            </div>

            {/* Exit / Back Navigation Link */}
            <header className="now-playing-top-bar">
                <button
                    className="glass-icon-btn exit-btn"
                    onClick={handleExit}
                    title="Exit Full Screen Player"
                >
                    <Minimize2 size={18} />
                    <span>Exit Full Screen</span>
                </button>
            </header>

            {/* Main Full-Screen Layout Wrapper (Transforms to 2-panel when lyrics open) */}
            <main className={`now-playing-content ${showLyrics ? "lyrics-open" : ""}`}>
                {/* Left Panel: Artwork, Title, Artist, & Player Controls */}
                <div className="left-music-panel">
                    <div className="artwork-stage">
                        <div className="glass-art-card">
                            {artwork ? (
                                <img src={artwork} alt={title} className="fullscreen-art" />
                            ) : (
                                <div className="fullscreen-art-fallback">
                                    <Music size={100} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="song-meta-stage">
                        <h1 className="song-title">{title}</h1>
                        <p className="song-artist">{artist}</p>

                        <div className="song-sub-tags">
                            {album && (
                                <span className="meta-tag">
                                    <Disc size={13} /> {album}
                                </span>
                            )}
                            {currentSong?.release_year && (
                                <span className="meta-tag">
                                    <Calendar size={13} /> {currentSong.release_year}
                                </span>
                            )}
                            {currentSong?.genre && (
                                <span className="meta-tag">
                                    <Tag size={13} /> {currentSong.genre}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Floating Liquid Glass Control Panel */}
                    <div className="glass-controls-panel">
                        {/* Time & Progress Bar */}
                        <div className="progress-section">
                            <span className="time-display">{formatTime(currentTime)}</span>
                            <input
                                type="range"
                                className="glass-progress-slider"
                                min={0}
                                max={duration || 100}
                                value={currentTime || 0}
                                onChange={(e) => seek(parseFloat(e.target.value))}
                            />
                            <span className="time-display">
                                -{formatTime(Math.max(0, (duration || 0) - (currentTime || 0)))}
                            </span>
                        </div>

                        {/* Main Buttons Row */}
                        <div className="controls-row">
                            <div className="controls-group-left">
                                <button
                                    className={`glass-btn ${shuffle ? "active" : ""}`}
                                    onClick={toggleShuffle}
                                    title="Shuffle"
                                >
                                    <Shuffle size={18} />
                                </button>

                                <button className="glass-btn" onClick={previous} title="Previous">
                                    <SkipBack size={20} />
                                </button>

                                <button
                                    className="glass-btn main-play-btn"
                                    onClick={togglePlay}
                                    title={isPlaying ? "Pause" : "Play"}
                                >
                                    {isPlaying ? (
                                        <Pause size={26} />
                                    ) : (
                                        <Play size={26} className="play-offset" />
                                    )}
                                </button>

                                <button className="glass-btn" onClick={next} title="Next">
                                    <SkipForward size={20} />
                                </button>

                                <button
                                    className={`glass-btn ${repeat !== "off" ? "active" : ""}`}
                                    onClick={toggleRepeat}
                                    title={`Repeat: ${repeat}`}
                                >
                                    {repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
                                </button>
                            </div>

                            <div className="controls-group-right">
                                <div className="volume-control-wrap">
                                    <button
                                        className="glass-btn icon-only"
                                        onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
                                        title={volume === 0 ? "Unmute" : "Mute"}
                                    >
                                        {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                    </button>
                                    <input
                                        type="range"
                                        className="glass-volume-slider"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={volume}
                                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                                    />
                                </div>

                                <button
                                    className={`glass-btn icon-only ${showQueue ? "active" : ""}`}
                                    onClick={() => setShowQueue(!showQueue)}
                                    title="Queue"
                                >
                                    <ListMusic size={18} />
                                </button>

                                {hasLyrics && (
                                    <button
                                        className={`glass-btn lyrics-toggle-btn ${showLyrics ? "active" : ""}`}
                                        onClick={() => setShowLyrics(!showLyrics)}
                                        title="Toggle Synced Lyrics"
                                    >
                                        <FileText size={16} />
                                        <span>Lyrics</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Animated Liquid Glass Lyrics Panel */}
                {showLyrics && (
                    <div className="right-lyrics-panel">
                        <div className="lyrics-glass-card">
                            <div className="lyrics-card-header">
                                <h3><FileText size={20} /> Lyrics</h3>
                                <button
                                    className="glass-icon-btn close-lyrics-btn"
                                    onClick={() => setShowLyrics(false)}
                                    title="Close Lyrics"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <Lyrics
                                song={currentSong}
                                lyrics={lyricsData?.lyrics}
                                currentTime={currentTime}
                            />
                        </div>
                    </div>
                )}
            </main>

            {/* Queue Popup Drawer */}
            {showQueue && (
                <div className="fullscreen-queue-drawer">
                    <div className="queue-drawer-header">
                        <h3>Up Next ({queue.length})</h3>
                        <button
                            className="glass-icon-btn"
                            onClick={() => setShowQueue(false)}
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="queue-drawer-list">
                        {queue.map((song, idx) => {
                            const isCurrent = song.id === currentSong.id;
                            return (
                                <div
                                    key={`${song.id}-${idx}`}
                                    className={`queue-drawer-item ${isCurrent ? "active" : ""}`}
                                    onClick={() => playSong(song, queue)}
                                >
                                    <div className="queue-item-art">
                                        {song.thumbnail_url ? (
                                            <img src={song.thumbnail_url} alt="" />
                                        ) : (
                                            <Music size={16} />
                                        )}
                                    </div>
                                    <div className="queue-item-details">
                                        <span className="q-title">{song.title || song.raw_title}</span>
                                        <span className="q-artist">{song.artist || "Unknown Artist"}</span>
                                    </div>
                                    {isCurrent && <span className="q-playing-badge">Now Playing</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
