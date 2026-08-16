import { useEffect, useRef, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { getSongLyrics } from "../services/songs";
import { parseLRC } from "../utils/lrcParser";
import "../styles/songs.css";

export default function Lyrics({ song, currentTime = 0, lyrics: rawLyricsProp }) {
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

    if (loading) {
        return (
            <div className="lyrics-empty-state">
                <RefreshCw size={24} className="spin-icon" />
                <p>Loading synced lyrics...</p>
            </div>
        );
    }

    if (error || lyrics.length === 0) {
        return (
            <div className="lyrics-empty-state">
                <FileText size={32} />
                <p>{error || "No timestamped lyrics available for this song."}</p>
            </div>
        );
    }

    return (
        <div className="spotify-lyrics-viewport" ref={containerRef}>
            {lyrics.map((line, index) => {
                const isActive = index === activeIndex;
                return (
                    <p
                        key={`${line.time}-${index}`}
                        ref={isActive ? activeLineRef : null}
                        className={`spotify-lyric-line ${isActive ? "active" : ""}`}
                    >
                        {line.text}
                    </p>
                );
            })}
        </div>
    );
}