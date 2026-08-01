import { useEffect, useState } from "react";
import { getSongLyrics } from "../services/songs";
import { parseLRC } from "../utils/lrcParser";

function Lyrics({ song, currentTime }) {
    const [lyrics, setLyrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!song) {
            setLyrics([]);
            return;
        }

        const fetchLyrics = async () => {
            try {
                setLoading(true);
                setError(null);

                const data = await getSongLyrics(song.id);

                const parsedLyrics = parseLRC(
                    data.lyrics
                );

                setLyrics(parsedLyrics);
            } catch (error) {
                console.error(
                    "Failed to fetch lyrics:",
                    error
                );

                setError("Failed to load lyrics.");
            } finally {
                setLoading(false);
            }
        };

        fetchLyrics();
    }, [song]);

    if (!song) {
        return (
            <section>
                <h2>Lyrics</h2>
                <p>Select a song to view lyrics.</p>
            </section>
        );
    }

    if (loading) {
        return (
            <section>
                <h2>Lyrics</h2>
                <p>Loading lyrics...</p>
            </section>
        );
    }

    if (error) {
        return (
            <section>
                <h2>Lyrics</h2>
                <p>{error}</p>
            </section>
        );
    }

    if (lyrics.length === 0) {
        return (
            <section>
                <h2>Lyrics</h2>
                <p>No timestamped lyrics available.</p>
            </section>
        );
    }

    let activeIndex = -1;

    for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= currentTime) {
            activeIndex = i;
        } else {
            break;
        }
    }

    return (
        <section>
            <h2>Lyrics</h2>

            <div>
                {lyrics.map((line, index) => (
                    <p
                        key={`${line.time}-${index}`}
                        style={{
                            fontWeight:
                                index === activeIndex
                                    ? "bold"
                                    : "normal",

                            opacity:
                                index === activeIndex
                                    ? 1
                                    : 0.5,

                            transition:
                                "all 0.2s ease",
                        }}
                    >
                        {line.text}
                    </p>
                ))}
            </div>
        </section>
    );
}

export default Lyrics;