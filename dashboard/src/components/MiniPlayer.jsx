import { useState } from "react";
import { Link } from "react-router-dom";
import {
    ChevronUp,
    ListMusic,
    Maximize2,
    Music,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
} from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import "../styles/miniPlayer.css";

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function MiniPlayer() {
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

    const [showQueue, setShowQueue] = useState(false);
    const [prevVolume, setPrevVolume] = useState(0.8);

    if (!currentSong) return null;

    const artwork = currentSong.thumbnail_url;
    const title = currentSong.title || currentSong.raw_title || "Unknown Track";
    const artist = currentSong.artist || "Unknown Artist";

    const handleVolumeToggle = () => {
        if (volume > 0) {
            setPrevVolume(volume);
            setVolume(0);
        } else {
            setVolume(prevVolume || 0.8);
        }
    };

    return (
        <>
            {/* Queue Popup Drawer */}
            {showQueue && (
                <div className="queue-drawer">
                    <div className="queue-header">
                        <h3>Up Next ({queue.length})</h3>
                        <button
                            className="queue-close-btn"
                            onClick={() => setShowQueue(false)}
                        >
                            ✕
                        </button>
                    </div>
                    <div className="queue-list">
                        {queue.map((song, idx) => {
                            const isCurrent = song.id === currentSong.id;
                            return (
                                <div
                                    key={`${song.id}-${idx}`}
                                    className={`queue-item ${isCurrent ? "active" : ""}`}
                                    onClick={() => playSong(song, queue)}
                                >
                                    <div className="queue-item-art">
                                        {song.thumbnail_url ? (
                                            <img src={song.thumbnail_url} alt="" />
                                        ) : (
                                            <Music size={16} />
                                        )}
                                    </div>
                                    <div className="queue-item-info">
                                        <span className="queue-title">{song.title || song.raw_title}</span>
                                        <span className="queue-artist">{song.artist || "Unknown Artist"}</span>
                                    </div>
                                    {isCurrent && <span className="queue-playing-tag">Playing</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Floating / Fixed Bottom Mini Player */}
            <div className="mini-player-bar">
                {/* Progress bar line along top of mini-player */}
                <div className="mini-player-progress-container">
                    <input
                        type="range"
                        className="mini-player-progress-bar"
                        min={0}
                        max={duration || 100}
                        value={currentTime || 0}
                        onChange={(e) => seek(parseFloat(e.target.value))}
                    />
                </div>

                <div className="mini-player-content">
                    {/* Left: Artwork + Title + Artist */}
                    <div className="mini-player-left">
                        <Link to={`/songs/${currentSong.id}/detail`} className="mini-player-art-link">
                            {artwork ? (
                                <img src={artwork} alt={title} className="mini-player-art" />
                            ) : (
                                <div className="mini-player-art-placeholder">
                                    <Music size={20} />
                                </div>
                            )}
                        </Link>
                        <div className="mini-player-track-info">
                            <Link to={`/songs/${currentSong.id}/detail`} className="mini-player-title">
                                {title}
                            </Link>
                            <span className="mini-player-artist">{artist}</span>
                        </div>
                    </div>

                    {/* Center: Playback Controls */}
                    <div className="mini-player-center">
                        <div className="mini-player-controls">
                            <button
                                className={`mini-btn ${shuffle ? "active" : ""}`}
                                onClick={toggleShuffle}
                                title="Shuffle"
                            >
                                <Shuffle size={16} />
                            </button>
                            <button className="mini-btn" onClick={previous} title="Previous">
                                <SkipBack size={18} />
                            </button>
                            <button className="mini-btn main-play-btn" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
                                {isPlaying ? <Pause size={20} /> : <Play size={20} className="play-icon-offset" />}
                            </button>
                            <button className="mini-btn" onClick={next} title="Next">
                                <SkipForward size={18} />
                            </button>
                            <button
                                className={`mini-btn ${repeat !== "off" ? "active" : ""}`}
                                onClick={toggleRepeat}
                                title={`Repeat: ${repeat}`}
                            >
                                {repeat === "one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
                            </button>
                        </div>

                        <div className="mini-player-time">
                            <span>{formatTime(currentTime)}</span>
                            <span>/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Right: Volume + Queue + Expand */}
                    <div className="mini-player-right">
                        <div className="mini-player-volume">
                            <button className="mini-btn icon-only" onClick={handleVolumeToggle}>
                                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                            </button>
                            <input
                                type="range"
                                className="mini-player-volume-slider"
                                min={0}
                                max={1}
                                step={0.01}
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                            />
                        </div>

                        <button
                            className={`mini-btn icon-only ${showQueue ? "active" : ""}`}
                            onClick={() => setShowQueue(!showQueue)}
                            title="Queue"
                        >
                            <ListMusic size={18} />
                        </button>

                        <Link to={`/songs/${currentSong.id}/detail`} className="mini-btn icon-only" title="Full Screen Detail">
                            <Maximize2 size={18} />
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
