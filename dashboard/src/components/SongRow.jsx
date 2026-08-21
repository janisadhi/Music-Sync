import { useState } from "react";
import { Link } from "react-router-dom";
import {
    CheckSquare,
    MoreVertical,
    Music,
    Pause,
    Play,
    Plus,
    RefreshCw,
    Sparkles,
    Square,
    Trash2,
} from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { useSongSelection } from "../context/SongSelectionContext";
import "../styles/songRow.css";

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function SongRow({ song, queue = [], trackIndex = null, isCompact = false, onDelete, onRetry, onRetryEnrichedLyrics }) {
    const { currentSong, isPlaying, playSong, togglePlay, addToQueue } = usePlayer();
    const { isSelected, toggleSelectSong } = useSongSelection();
    const [showMenu, setShowMenu] = useState(false);

    if (!song) return null;

    const isCurrent = currentSong?.id === song.id;
    const isThisPlaying = isCurrent && isPlaying;
    const selected = isSelected(song.id);

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

    const handleCheckboxClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSelectSong(song.id);
    };

    if (isCompact) {
        return (
            <div className={`song-row compact-row ${isCurrent ? "active-row" : ""} ${selected ? "selected-row" : ""}`}>
                <div className="compact-left">
                    <button
                        type="button"
                        className={`song-row-checkbox ${selected ? "selected" : ""}`}
                        onClick={handleCheckboxClick}
                        title={selected ? "Deselect track" : "Select track"}
                    >
                        {selected ? <CheckSquare size={14} /> : <Square size={14} />}
                    </button>

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
        <div className={`song-row standard-row ${isCurrent ? "active-row" : ""} ${selected ? "selected-row" : ""}`}>
            <div className="row-col-select">
                <button
                    type="button"
                    className={`song-row-checkbox ${selected ? "selected" : ""}`}
                    onClick={handleCheckboxClick}
                    title={selected ? "Deselect track" : "Select track"}
                >
                    {selected ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
            </div>

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
                            {song.download_status === "downloaded" && onRetryEnrichedLyrics && (
                                <button onClick={() => { onRetryEnrichedLyrics(song.id); setShowMenu(false); }}>
                                    <Sparkles size={14} /> Retry Enriched Lyrics
                                </button>
                            )}
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
