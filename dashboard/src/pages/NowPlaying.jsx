import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    ChevronDown,
    Disc,
    FileText,
    ListMusic,
    Music,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
    Tag,
    Volume2,
    VolumeX,
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

function parseYear(yearStr) {
    if (!yearStr) return null;
    const match = String(yearStr).match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
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
        dominant: "rgb(24, 32, 47)",
        secondary: "rgb(15, 23, 42)",
        accent: "rgb(59, 130, 246)",
        dark: "rgba(9, 13, 22, 0.96)",
        glow: "rgba(59, 130, 246, 0.35)",
    });

    const artwork = currentSong?.thumbnail_url;
    const title = currentSong?.title || currentSong?.raw_title || "Unknown Track";
    const artist = currentSong?.artist || "Unknown Artist";
    const album = currentSong?.album || "Unknown Album";
    const releaseYear = parseYear(currentSong?.release_year);

    // Request HTML5 native browser fullscreen mode (F11)
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

            {/* Top Navigation Bar */}
            <header className="now-playing-top-bar">
                <button
                    className="top-bar-btn"
                    onClick={handleExit}
                    title="Exit Full Screen Player"
                >
                    <ChevronDown size={22} />
                    <span>Exit Full Screen</span>
                </button>
                <div className="top-bar-title">Playing from Library</div>
                <div className="top-bar-placeholder" />
            </header>

            {/* Main Full-Screen Layout Viewport */}
            <main className={`now-playing-main ${showLyrics ? "lyrics-mode" : "centered-mode"}`}>
                {/* Left Music Stage */}
                <div className="music-stage-col">
                    <div className="artwork-wrap">
                        <div className="spotify-art-card">
                            {artwork ? (
                                <img src={artwork} alt={title} className="art-img" />
                            ) : (
                                <div className="art-fallback">
                                    <Music size={90} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="track-meta-wrap">
                        <h1 className="track-title">{title}</h1>
                        <p className="track-artist">{artist}</p>

                        {(album || releaseYear || currentSong?.genre) && (
                            <div className="track-pills">
                                {album && (
                                    <span className="meta-pill">
                                        <Disc size={13} /> {album}
                                    </span>
                                )}
                                {releaseYear && (
                                    <span className="meta-pill">{releaseYear}</span>
                                )}
                                {currentSong?.genre && (
                                    <span className="meta-pill">
                                        <Tag size={13} /> {currentSong.genre}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Clean Control Bar Surface */}
                    <div className="spotify-control-surface">
                        {/* Progress Bar & Timestamps */}
                        <div className="progress-bar-row">
                            <span className="timestamp">{formatTime(currentTime)}</span>
                            <input
                                type="range"
                                className="progress-slider"
                                min={0}
                                max={duration || 100}
                                value={currentTime || 0}
                                onChange={(e) => seek(parseFloat(e.target.value))}
                            />
                            <span className="timestamp">
                                -{formatTime(Math.max(0, (duration || 0) - (currentTime || 0)))}
                            </span>
                        </div>

                        {/* Controls Toolbar Grid */}
                        <div className="controls-toolbar">
                            {/* Left: Volume Group */}
                            <div className="toolbar-group volume-group">
                                <button
                                    className="control-icon-btn"
                                    onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
                                    title={volume === 0 ? "Unmute" : "Mute"}
                                >
                                    {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                </button>
                                <input
                                    type="range"
                                    className="volume-slider"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={volume}
                                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                                />
                            </div>

                            {/* Center: Playback Group */}
                            <div className="toolbar-group playback-group">
                                <button
                                    className={`control-icon-btn ${shuffle ? "active" : ""}`}
                                    onClick={toggleShuffle}
                                    title="Shuffle"
                                >
                                    <Shuffle size={18} />
                                </button>
                                <button className="control-icon-btn" onClick={previous} title="Previous">
                                    <SkipBack size={20} />
                                </button>
                                <button
                                    className="main-play-circle"
                                    onClick={togglePlay}
                                    title={isPlaying ? "Pause" : "Play"}
                                >
                                    {isPlaying ? (
                                        <Pause size={24} />
                                    ) : (
                                        <Play size={24} className="play-icon-offset" />
                                    )}
                                </button>
                                <button className="control-icon-btn" onClick={next} title="Next">
                                    <SkipForward size={20} />
                                </button>
                                <button
                                    className={`control-icon-btn ${repeat !== "off" ? "active" : ""}`}
                                    onClick={toggleRepeat}
                                    title={`Repeat: ${repeat}`}
                                >
                                    {repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
                                </button>
                            </div>

                            {/* Right: Actions Group */}
                            <div className="toolbar-group actions-group">
                                <button
                                    className={`control-icon-btn ${showQueue ? "active" : ""}`}
                                    onClick={() => setShowQueue(!showQueue)}
                                    title="Queue"
                                >
                                    <ListMusic size={18} />
                                </button>

                                {hasLyrics && (
                                    <button
                                        className={`control-icon-btn ${showLyrics ? "active" : ""}`}
                                        onClick={() => setShowLyrics(!showLyrics)}
                                        title="Toggle Lyrics"
                                    >
                                        <FileText size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Lyrics Stage (Frameless side-by-side lyrics view) */}
                {showLyrics && (
                    <div className="frameless-lyrics-column">
                        <Lyrics
                            song={currentSong}
                            lyrics={lyricsData?.lyrics}
                            currentTime={currentTime}
                        />
                    </div>
                )}
            </main>

            {/* Queue Popup Drawer */}
            {showQueue && (
                <div className="fullscreen-queue-drawer">
                    <div className="queue-drawer-header">
                        <h3>Up Next ({queue.length})</h3>
                        <button className="close-lyrics-btn" onClick={() => setShowQueue(false)}>
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
