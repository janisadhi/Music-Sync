import { useEffect, useRef, useState } from "react";
import { FileText, Music } from "lucide-react";
import { getSongLyrics } from "../services/songs";
import { parseLRC } from "../utils/lrcParser";
import "../styles/songs.css";

function Lyrics({ song, currentTime = 0, lyrics: rawLyricsProp }) {
    const [lyrics, setLyrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const containerRef = useRef(null);
    const activeLineRef = useRef(null);

    useEffect(() => {
        if (rawLyricsProp) {
            if (typeof rawLyricsProp === "string") {
                setLyrics(parseLRC(rawLyricsProp));
            } else if (Array.isArray(rawLyricsProp)) {
                setLyrics(rawLyricsProp);
            }
            return;
        }

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
            } catch (err) {
                console.error("Failed to fetch lyrics:", err);
                setError("Failed to load lyrics.");
            } finally {
                setLoading(false);
            }
        };

        fetchLyrics();
    }, [song, rawLyricsProp]);

    // Calculate active line index based on playback time
    let activeIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= currentTime) {
            activeIndex = i;
        } else {
            break;
        }
    }

    // Auto-scroll active lyric line into center of container
    useEffect(() => {
        if (activeLineRef.current && containerRef.current) {
            const container = containerRef.current;
            const activeLine = activeLineRef.current;

            const topOffset = activeLine.offsetTop - container.offsetTop;
            const targetScrollTop =
                topOffset - container.clientHeight / 2 + activeLine.clientHeight / 2;

            container.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: "smooth",
            });
        }
    }, [activeIndex]);

    if (!song) {
        return (
            <section className="lyrics-panel">
                <div className="lyrics-heading">
                    <div className="heading-title">
                        <FileText size={18} className="lyrics-icon-primary" />
                        <h3>Lyrics</h3>
                    </div>
                </div>
                <div className="lyrics-message">Select a song to view lyrics.</div>
            </section>
        );
    }

    if (loading) {
        return (
            <section className="lyrics-panel">
                <div className="lyrics-heading">
                    <div className="heading-title">
                        <FileText size={18} className="lyrics-icon-primary" />
                        <h3>Lyrics</h3>
                    </div>
                </div>
                <div className="lyrics-message">Loading synced lyrics...</div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="lyrics-panel">
                <div className="lyrics-heading">
                    <div className="heading-title">
                        <FileText size={18} className="lyrics-icon-primary" />
                        <h3>Lyrics</h3>
                    </div>
                </div>
                <div className="lyrics-message lyrics-unavailable">{error}</div>
            </section>
        );
    }

    if (lyrics.length === 0) {
        return (
            <section className="lyrics-panel">
                <div className="lyrics-heading">
                    <div className="heading-title">
                        <FileText size={18} className="lyrics-icon-primary" />
                        <h3>Lyrics</h3>
                    </div>
                </div>
                <div className="lyrics-message lyrics-unavailable">
                    No timestamped lyrics available for this song.
                </div>
            </section>
        );
    }

    return (
        <section className="lyrics-panel">
            <div className="lyrics-heading">
                <div className="heading-title">
                    <FileText size={18} className="lyrics-icon-primary" />
                    <div>
                        <h3>Synced Lyrics</h3>
                        <span className="subtitle">Real-time synchronized scrolling</span>
                    </div>
                </div>
            </div>

            <div className="lyrics-content" ref={containerRef}>
                {lyrics.map((line, index) => {
                    const isActive = index === activeIndex;
                    return (
                        <p
                            key={`${line.time}-${index}`}
                            ref={isActive ? activeLineRef : null}
                            className={isActive ? "lyric-line active" : "lyric-line"}
                        >
                            {line.text}
                        </p>
                    );
                })}
            </div>
        </section>
    );
}

export default Lyrics;