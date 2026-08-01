import { useEffect, useRef, useState } from "react";
import { getSongLyrics } from "../services/songs";
import { parseLRC } from "../utils/lrcParser";
import "../styles/songs.css";
function Lyrics({ song, currentTime = 0 }) {
    const [lyrics, setLyrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const activeLineRef = useRef(null);
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

                if (!data?.lyrics) {
                    setLyrics([]);
                    return;
                }

                const parsedLyrics = parseLRC(data.lyrics);

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
            <section className="lyrics-panel">
                <div className="lyrics-heading">
                    <div>
                        <span className="lyrics-icon">♪</span>
                        <h3>Lyrics</h3>
                    </div>
                </div>

                <div className="lyrics-message">
                    Select a song to view lyrics.
                </div>
            </section>
        );
    }

    if (loading) {
        return (
            <section className="lyrics-panel">
                <div className="lyrics-heading">
                    <div>
                        <span className="lyrics-icon">♪</span>
                        <h3>Lyrics</h3>
                    </div>
                </div>

                <div className="lyrics-message">
                    Loading lyrics...
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="lyrics-panel">
                <div className="lyrics-heading">
                    <div>
                        <span className="lyrics-icon">♪</span>
                        <h3>Lyrics</h3>
                    </div>
                </div>

                <div className="lyrics-message lyrics-unavailable">
                    {error}
                </div>
            </section>
        );
    }

    if (lyrics.length === 0) {
        return (
            <section className="lyrics-panel">
                <div className="lyrics-heading">
                    <div>
                        <span className="lyrics-icon">♪</span>
                        <h3>Lyrics</h3>
                    </div>
                </div>

                <div className="lyrics-message lyrics-unavailable">
                    No timestamped lyrics available.
                </div>
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
        <section className="lyrics-panel">
            <div className="lyrics-heading">
                <div>
                    <span className="lyrics-icon">♪</span>

                    <div>
                        <h3>Lyrics</h3>

                        <span>
                            Synced lyrics
                        </span>
                    </div>
                </div>
            </div>

            <div className="lyrics-content">
                {lyrics.map((line, index) => (
                    <p
                        key={`${line.time}-${index}`}
                        className={
                            index === activeIndex
                                ? "lyric-line active"
                                : "lyric-line"
                        }
                    >
                        {line.text}
                    </p>
                ))}
            </div>
        </section>
    );
}

export default Lyrics;