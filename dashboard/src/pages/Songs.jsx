import { useEffect, useState } from "react";
import {
    getSongs,
    getSongAudioUrl,
} from "../services/songs";

function Songs({ onSelectSong, selectedSong }) {
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSongs = async () => {
        try {
            setLoading(true);
            setError(null);

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

    const formatDuration = (seconds) => {
        if (!seconds) {
            return "Unknown";
        }

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return `${minutes}:${String(
            remainingSeconds
        ).padStart(2, "0")}`;
    };

    if (loading) {
        return (
            <div>
                <h2>Music Library</h2>
                <p>Loading songs...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <h2>Music Library</h2>
                <p>{error}</p>

                <button onClick={fetchSongs}>
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            <h2>Music Library</h2>

            <p>
                {songs.length}{" "}
                {songs.length === 1
                    ? "song"
                    : "songs"}
            </p>

            {songs.length === 0 ? (
                <p>No songs found.</p>
            ) : (
                <div>
                    {songs.map((song) => {
                        const isSelected =
                            selectedSong?.id === song.id;

                        return (
                            <div
                                key={song.id}
                                style={{
                                    padding: "15px",
                                    marginBottom: "10px",
                                    border: isSelected
                                        ? "2px solid #61dafb"
                                        : "1px solid #ddd",
                                    borderRadius: "8px",
                                }}
                            >
                                <h3>{song.title}</h3>

                                <p>
                                    Duration:{" "}
                                    {formatDuration(
                                        song.duration
                                    )}
                                </p>

                                <p>
                                    Download:{" "}
                                    {song.download_status}
                                </p>

                                <p>
                                    Lyrics:{" "}
                                    {song.lyrics_status}
                                </p>

                                <button
                                    onClick={() =>
                                        onSelectSong?.(
                                            song
                                        )
                                    }
                                    disabled={
                                        song.download_status !==
                                        "downloaded"
                                    }
                                >
                                    {isSelected
                                        ? "Selected"
                                        : "Play"}
                                </button>

                                {song.download_status ===
                                    "downloaded" && (
                                    <audio
                                        controls
                                        preload="metadata"
                                        src={getSongAudioUrl(
                                            song.id
                                        )}
                                        style={{
                                            display: "block",
                                            width: "100%",
                                            marginTop: "10px",
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Songs;