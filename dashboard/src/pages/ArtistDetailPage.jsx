import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, RefreshCw, Shuffle, User } from "lucide-react";
import SongRow from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";
import { getSongs } from "../services/songs";
import "../styles/songDetailPage.css";

export default function ArtistDetailPage() {
    const { artistName } = useParams();
    const navigate = useNavigate();
    const decodedArtist = decodeURIComponent(artistName);

    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);

    const { playPlaylist } = usePlayer();

    useEffect(() => {
        const loadArtistSongs = async () => {
            try {
                setLoading(true);
                const data = await getSongs({ artist: decodedArtist });
                setSongs(data);
            } catch (err) {
                console.error("Failed to load artist songs:", err);
            } finally {
                setLoading(false);
            }
        };
        loadArtistSongs();
    }, [decodedArtist]);

    if (loading) {
        return (
            <div className="song-detail-loading">
                <RefreshCw size={32} className="spin-icon" />
                <p>Loading artist details...</p>
            </div>
        );
    }

    const artwork = songs.find((s) => s.thumbnail_url)?.thumbnail_url;

    return (
        <div className="song-detail-container">
            <button className="back-btn" onClick={() => navigate(-1)}>
                <ArrowLeft size={18} /> Back
            </button>

            {/* Artist Hero Header */}
            <div className="song-detail-hero">
                <div className="hero-artwork-wrap" style={{ borderRadius: "50%" }}>
                    {artwork ? (
                        <img src={artwork} alt={decodedArtist} className="hero-artwork" />
                    ) : (
                        <div className="hero-artwork-fallback">
                            <User size={80} />
                        </div>
                    )}
                </div>

                <div className="hero-info">
                    <span className="hero-badge">Artist</span>
                    <h1 className="hero-title">{decodedArtist}</h1>

                    <div className="hero-meta-row">
                        <span>{songs.length} {songs.length === 1 ? "song" : "songs"} in library</span>
                    </div>

                    <div className="header-actions" style={{ marginTop: "16px" }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => playPlaylist(songs, 0, false)}
                            disabled={songs.length === 0}
                        >
                            <Play size={16} /> Play All
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

            {/* Artist Tracklist */}
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
