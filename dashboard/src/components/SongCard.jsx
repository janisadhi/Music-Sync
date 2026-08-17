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
    Square,
    Trash2,
} from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { useSongSelection } from "../context/SongSelectionContext";
import "../styles/songCard.css";

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function SongCard({ song, queue = [], cardSize = "medium", onDelete, onRetry }) {
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

    return (
        <div className={`song-card card-size-${cardSize} ${isCurrent ? "active-card" : ""} ${selected ? "selected-card" : ""}`}>
            {/* Square 1:1 Album Artwork Container */}
            <div className="song-card-art-wrap">
                {artwork ? (
                    <img src={artwork} alt={title} className="song-card-art" loading="lazy" />
                ) : (
                    <div className="song-card-art-fallback">
                        <Music size={cardSize === "large" ? 48 : cardSize === "small" ? 24 : 36} />
                    </div>
                )}

                {/* Selection Checkbox Overlay */}
                <button
                    type="button"
                    className={`song-card-checkbox ${selected ? "selected" : ""}`}
                    onClick={handleCheckboxClick}
                    title={selected ? "Deselect track" : "Select track"}
                >
                    {selected ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>

                {/* Hover Play Button Overlay */}
                <div className="song-card-overlay">
                    <button
                        type="button"
                        className="song-card-play-btn"
                        onClick={handlePlayClick}
                        title={isThisPlaying ? "Pause" : "Play"}
                    >
                        {isThisPlaying ? <Pause size={22} /> : <Play size={22} className="play-icon-offset" />}
                    </button>
                </div>

                {/* Playing Tag Badge */}
                {isCurrent && (
                    <div className="playing-badge">
                        <span className="badge-dot" /> Playing
                    </div>
                )}
            </div>

            {/* Song Information */}
            <div className="song-card-info">
                <div className="song-card-title-row">
                    <Link to={`/songs/${song.id}/detail`} className="song-card-title" title={title}>
                        {title}
                    </Link>

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
                            <div className="song-card-menu-dropdown" onClick={(e) => e.stopPropagation()}>
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

                <div className="song-card-meta">
                    <span className="song-card-artist" title={artist}>
                        {artist}
                    </span>
                    {cardSize !== "small" && (
                        <span className="song-card-album" title={album}>
                            {album}
                        </span>
                    )}
                </div>

                {cardSize === "large" && (
                    <div className="song-card-extra">
                        {song.release_year && <span className="extra-tag">{song.release_year}</span>}
                        {song.genre && <span className="extra-tag">{song.genre}</span>}
                        {duration && <span className="extra-duration">{duration}</span>}
                    </div>
                )}
            </div>
        </div>
    );
}
