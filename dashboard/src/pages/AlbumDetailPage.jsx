import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Disc, Play, RefreshCw, Shuffle, Tag, User } from "lucide-react";
import SongRow from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import { getSongs } from "../services/songs";
import "../styles/songDetailPage.css";

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "0 min";
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
}

export default function AlbumDetailPage() {
    const { albumName } = useParams();
    const navigate = useNavigate();
    const decodedAlbum = decodeURIComponent(albumName);

    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);

    const { playPlaylist } = usePlayer();

    useEffect(() => {
        const loadAlbumSongs = async () => {
            try {
                setLoading(true);
                const data = await getSongs({ album: decodedAlbum });
                setSongs(data);
            } catch (err) {
                console.error("Failed to load album songs:", err);
            } finally {
                setLoading(false);
            }
        };
        loadAlbumSongs();
    }, [decodedAlbum]);

    if (loading) {
        return (
            <div className="song-detail-loading">
                <RefreshCw size={32} className="spin-icon" />
                <p>Loading album details...</p>
            </div>
        );
    }

    const firstSong = songs[0] || {};
    const artist = firstSong.album_artist || firstSong.artist || "Unknown Artist";
    const year = firstSong.release_year;
    const genre = firstSong.genre;
    const artwork = songs.find((s) => s.thumbnail_url)?.thumbnail_url;
    const totalDuration = songs.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);

    return (
        <div className="song-detail-container">
            <button className="back-btn" onClick={() => navigate(-1)}>
                <ArrowLeft size={18} /> Back
            </button>

            {/* Album Hero Header */}
            <div className="song-detail-hero">
                <div className="hero-artwork-wrap">
                    {artwork ? (
                        <img src={artwork} alt={decodedAlbum} className="hero-artwork" />
                    ) : (
                        <div className="hero-artwork-fallback">
                            <Disc size={80} />
                        </div>
                    )}
                </div>

                <div className="hero-info">
                    <span className="hero-badge">Album</span>
                    <h1 className="hero-title">{decodedAlbum}</h1>

                    <div className="hero-meta-row">
                        <span className="hero-meta-item">
                            <User size={16} /> {artist}
                        </span>
                        {year && (
                            <>
                                <span className="meta-bullet">•</span>
                                <span className="hero-meta-item">
                                    <Calendar size={16} /> {year}
                                </span>
                            </>
                        )}
                        {genre && (
                            <>
                                <span className="meta-bullet">•</span>
                                <span className="hero-meta-item">
                                    <Tag size={16} /> {genre}
                                </span>
                            </>
                        )}
                        <span className="meta-bullet">•</span>
                        <span>{songs.length} {songs.length === 1 ? "track" : "tracks"} ({formatDuration(totalDuration)})</span>
                    </div>

                    <div className="header-actions" style={{ marginTop: "16px" }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => playPlaylist(songs, 0, false)}
                            disabled={songs.length === 0}
                        >
                            <Play size={16} /> Play Album
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => playPlaylist(songs, 0, true)}
                            disabled={songs.length === 0}
                        >
                            <Shuffle size={16} /> Shuffle
                        </button>
                    </div>
                </div>
            </div>

            {/* Album Tracklist */}
            <div className="list-layout">
                <div className="list-header">
                    <span style={{ width: "32px" }}>#</span>
                    <span style={{ flex: 2 }}>Title & Artist</span>
                    <span style={{ flex: 1.5 }}>Album</span>
                    <span style={{ width: "120px" }}>Genre</span>
                    <span style={{ width: "60px", textAlign: "right" }}>Duration</span>
                    <span style={{ width: "32px" }}></span>
                </div>
                {songs.map((song, idx) => (
                    <SongRow key={song.id} song={song} queue={songs} trackIndex={idx} />
                ))}
            </div>
        </div>
    );
}
