import { useState } from "react";
import { Link } from "react-router-dom";
import {
    MoreVertical,
    Music,
    Pause,
    Play,
    Plus,
    RefreshCw,
    Trash2,
} from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import "../styles/songRow.css";

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function SongRow({ song, queue = [], trackIndex = null, isCompact = false, onDelete, onRetry }) {
    const { currentSong, isPlaying, playSong, togglePlay, addToQueue } = usePlayer();
    const [showMenu, setShowMenu] = useState(false);

    if (!song) return null;

    const isCurrent = currentSong?.id === song.id;
    const isThisPlaying = isCurrent && isPlaying;

    const title = song.title || song.raw_title || "Unknown Track";
    const artist = song.artist || "Unknown Artist";
    const album = song.album || "Unknown Album";
    const artwork = song.thumbnail_url;
    const duration = formatDuration(song.duration_seconds);

    const handlePlayClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isCurrent) {
            togglePlay();
        } else {
            playSong(song, queue.length > 0 ? queue : [song]);
        }
    };

    if (isCompact) {
        return (
            <div className={`song-row compact-row ${isCurrent ? "active-row" : ""}`}>
                <div className="compact-left">
                    <button className="row-play-btn" onClick={handlePlayClick}>
                        {isThisPlaying ? <Pause size={14} /> : <Play size={14} className="play-icon-offset" />}
                    </button>
                    {artwork && <img src={artwork} alt="" className="compact-art" />}
                    <Link to={`/songs/${song.id}/detail`} className="compact-title">
                        {title}
                    </Link>
                    <span className="compact-sep">—</span>
                    <span className="compact-artist">{artist}</span>
                </div>
                <div className="compact-right">
                    {duration && <span className="row-duration">{duration}</span>}
                </div>
            </div>
        );
    }

    return (
        <div className={`song-row standard-row ${isCurrent ? "active-row" : ""}`}>
            <div className="row-col-index">
                {trackIndex !== null ? (
                    <span className="index-num">{trackIndex + 1}</span>
                ) : (
                    <button className="row-play-btn" onClick={handlePlayClick}>
                        {isThisPlaying ? <Pause size={16} /> : <Play size={16} className="play-icon-offset" />}
                    </button>
                )}
            </div>

            <div className="row-col-track">
                <div className="row-art-wrap" onClick={handlePlayClick}>
                    {artwork ? (
                        <img src={artwork} alt={title} className="row-art" />
                    ) : (
                        <div className="row-art-placeholder">
                            <Music size={18} />
                        </div>
                    )}
                    <div className="row-art-play-overlay">
                        {isThisPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </div>
                </div>

                <div className="row-track-details">
                    <Link to={`/songs/${song.id}/detail`} className="row-title" title={title}>
                        {title}
                    </Link>
                    <span className="row-artist">{artist}</span>
                </div>
            </div>

            <div className="row-col-album">
                <span className="row-album" title={album}>
                    {album}
                </span>
            </div>

            <div className="row-col-genre">
                {song.genre ? <span className="row-genre-badge">{song.genre}</span> : <span className="row-empty">—</span>}
            </div>

            <div className="row-col-duration">
                <span>{duration}</span>
            </div>

            <div className="row-col-actions">
                <div className="song-card-menu-container">
                    <button
                        type="button"
                        className="song-card-menu-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                    >
                        <MoreVertical size={16} />
                    </button>
                    {showMenu && (
                        <div className="song-card-menu-dropdown right-aligned" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => { playSong(song, queue); setShowMenu(false); }}>
                                <Play size={14} /> Play Now
                            </button>
                            <button onClick={() => { addToQueue(song); setShowMenu(false); }}>
                                <Plus size={14} /> Add to Queue
                            </button>
                            <Link to={`/songs/${song.id}/detail`} onClick={() => setShowMenu(false)}>
                                <Music size={14} /> Song Details
                            </Link>
                            {song.download_status === "failed" && onRetry && (
                                <button onClick={() => { onRetry(song.id); setShowMenu(false); }}>
                                    <RefreshCw size={14} /> Retry Download
                                </button>
                            )}
                            {onDelete && (
                                <button className="menu-danger" onClick={() => { onDelete(song.id); setShowMenu(false); }}>
                                    <Trash2 size={14} /> Delete Song
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
