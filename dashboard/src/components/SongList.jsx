import { useEffect, useState } from "react";
import { getSongs } from "../services/songs";

function SongList({ onSelectSong }) {
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSongs = async () => {
        try {
            setLoading(true);
            const data = await getSongs();
            setSongs(data);
        } catch (err) {
            console.error(err);
            setError("Failed to load songs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSongs();
    }, []);

    if (loading) {
        return <p>Loading songs...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    return (
        <section>
            <h2>Music Library</h2>

            {songs.length === 0 ? (
                <p>No songs found.</p>
            ) : (
                <div>
                    {songs.map((song) => (
                        <div
                            key={song.id}
                            onClick={() => onSelectSong(song)}
                            style={{
                                padding: "12px",
                                borderBottom: "1px solid #ddd",
                                cursor: "pointer",
                            }}
                        >
                            <strong>{song.title}</strong>

                            <div>
                                {song.duration
                                    ? `${Math.floor(song.duration / 60)}:${String(
                                          song.duration % 60
                                      ).padStart(2, "0")}`
                                    : "Unknown duration"}
                            </div>

                            <small>
                                Download: {song.download_status} | Lyrics:{" "}
                                {song.lyrics_status}
                            </small>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default SongList;
