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
        } catch (error) {
            console.error(
                "Failed to fetch songs:",
                error
            );

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
                            onClick={() =>
                                onSelectSong(song)
                            }
                            style={{
                                padding: "15px",
                                marginBottom: "10px",
                                border: "1px solid #ddd",
                                cursor: "pointer",
                            }}
                        >
                            <h3>{song.title}</h3>

                            <p>
                                Duration:{" "}
                                {song.duration
                                    ? `${Math.floor(
                                          song.duration / 60
                                      )}:${String(
                                          song.duration % 60
                                      ).padStart(2, "0")}`
                                    : "Unknown"}
                            </p>

                            <p>
                                Download:{" "}
                                {song.download_status}
                            </p>

                            <p>
                                Lyrics:{" "}
                                {song.lyrics_status}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default SongList;