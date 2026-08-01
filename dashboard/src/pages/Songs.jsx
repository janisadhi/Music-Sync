import { useEffect, useMemo, useRef, useState } from "react";
import {
    getSongs,
    getSongAudioUrl,
} from "../services/songs";
import Lyrics from "../components/Lyrics";

function Songs({ onSelectSong, selectedSong }) {
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [search, setSearch] = useState("");
    const [songFilter, setSongFilter] = useState("all");
    const [lyricsFilter, setLyricsFilter] = useState("all");

    const [expandedSongId, setExpandedSongId] = useState(null);
    const [currentSong, setCurrentSong] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const audioRef = useRef(null);

    const fetchSongs = async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await getSongs();

            setSongs(data);
        } catch (err) {
            console.error(
                "Failed to fetch songs:",
                err
            );

            setError("Failed to load songs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSongs();
    }, []);

    /*
     * Keep the audio element synchronized
     * with the selected song.
     */
    useEffect(() => {
        const audio = audioRef.current;

        if (!audio || !currentSong) {
            return;
        }

        const url = getSongAudioUrl(
            currentSong.id
        );

        if (audio.src !== url) {
            audio.src = url;
            audio.load();

            setCurrentTime(0);
            setIsPlaying(false);
        }
    }, [currentSong]);

    const formatDuration = (seconds) => {
        if (!seconds) {
            return "--:--";
        }

        const minutes = Math.floor(
            seconds / 60
        );

        const remainingSeconds = Math.floor(
            seconds % 60
        );

        return `${minutes}:${String(
            remainingSeconds
        ).padStart(2, "0")}`;
    };

    /*
     * Convert backend status into
     * UI status.
     *
     * Green  = success
     * Red    = failed
     * Yellow = pending
     * Grey   = unavailable
     */
    const getSongStatus = (status) => {
        switch (status) {
            case "downloaded":
            case "completed":
                return "success";

            case "failed":
                return "failed";

            case "pending":
                return "pending";

            default:
                return "unavailable";
        }
    };

    const getLyricsStatus = (song) => {
        switch (song.lyrics_status) {
            case "downloaded":
            case "completed":
                return "success";

            case "failed":
                return "failed";

            case "pending":
                return "pending";

            case "unavailable":
            default:
                return "unavailable";
        }
    };

    /*
     * Search + filters
     */
    const filteredSongs = useMemo(() => {
        const query = search
            .trim()
            .toLowerCase();

        return songs.filter((song) => {
            /*
             * Search
             */
            if (query) {
                const searchableText = [
                    song.title,
                    song.artist,
                    song.album,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                if (
                    !searchableText.includes(
                        query
                    )
                ) {
                    return false;
                }
            }

            /*
             * Song filter
             */
            if (songFilter !== "all") {
                const status =
                    getSongStatus(
                        song.download_status
                    );

                if (
                    songFilter ===
                    "downloaded" &&
                    status !== "success"
                ) {
                    return false;
                }

                if (
                    songFilter === "pending" &&
                    status !== "pending"
                ) {
                    return false;
                }

                if (
                    songFilter === "failed" &&
                    status !== "failed"
                ) {
                    return false;
                }
            }

            /*
             * Lyrics filter
             */
            if (lyricsFilter !== "all") {
                const status =
                    getLyricsStatus(song);

                if (
                    lyricsFilter ===
                    "available" &&
                    status !== "success"
                ) {
                    return false;
                }

                if (
                    lyricsFilter === "pending" &&
                    status !== "pending"
                ) {
                    return false;
                }

                if (
                    lyricsFilter === "failed" &&
                    status !== "failed"
                ) {
                    return false;
                }

                if (
                    lyricsFilter ===
                    "unavailable" &&
                    status !== "unavailable"
                ) {
                    return false;
                }
            }

            return true;
        });
    }, [
        songs,
        search,
        songFilter,
        lyricsFilter,
    ]);

    /*
     * Select a song.
     */
    const selectSong = async (song) => {
        if (
            song.download_status !==
            "downloaded"
        ) {
            return;
        }

        /*
         * If clicking the currently selected
         * song, just toggle playback.
         */
        if (
            currentSong?.id === song.id
        ) {
            const audio = audioRef.current;

            if (!audio) {
                return;
            }

            if (audio.paused) {
                try {
                    await audio.play();
                    setIsPlaying(true);
                } catch (err) {
                    console.error(
                        "Failed to play audio:",
                        err
                    );
                }
            } else {
                audio.pause();
                setIsPlaying(false);
            }

            setExpandedSongId(song.id);

            return;
        }

        /*
         * Select new song.
         */
        setCurrentSong(song);
        setExpandedSongId(song.id);
        setCurrentTime(0);

        /*
         * The audio element updates after
         * currentSong changes, so playback
         * is started by the effect below.
         */
    };

    /*
     * Automatically play a newly selected song.
     */
    useEffect(() => {
        const audio = audioRef.current;

        if (!audio || !currentSong) {
            return;
        }

        const handleCanPlay = async () => {
            try {
                await audio.play();
                setIsPlaying(true);
            } catch (err) {
                /*
                 * Browser autoplay restrictions
                 * may prevent automatic playback.
                 *
                 * The Play button still works.
                 */
                console.debug(
                    "Autoplay prevented:",
                    err
                );

                setIsPlaying(false);
            }
        };

        audio.addEventListener(
            "canplay",
            handleCanPlay,
            { once: true }
        );

        return () => {
            audio.removeEventListener(
                "canplay",
                handleCanPlay
            );
        };
    }, [currentSong]);

    /*
     * Audio time update.
     *
     * This is what drives Lyrics.jsx.
     */
    const handleTimeUpdate = () => {
        const audio = audioRef.current;

        if (!audio) {
            return;
        }

        setCurrentTime(
            audio.currentTime
        );
    };

    const handlePlay = () => {
        setIsPlaying(true);
    };

    const handlePause = () => {
        setIsPlaying(false);
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    /*
     * Status dot.
     */
    const renderStatusDot = (
        status,
        label
    ) => {
        let backgroundColor =
            "#9ca3af";

        if (status === "success") {
            backgroundColor =
                "#22c55e";
        }

        if (status === "failed") {
            backgroundColor =
                "#ef4444";
        }

        if (status === "pending") {
            backgroundColor =
                "#eab308";
        }

        return (
            <span
                title={label}
                aria-label={label}
                style={{
                    display: "inline-block",
                    width: "11px",
                    height: "11px",
                    borderRadius:
                        "50%",
                    backgroundColor,
                    flexShrink: 0,
                }}
            />
        );
    };

    if (loading) {
        return (
            <div>
                <h2>Music Library</h2>

                <p>
                    Loading songs...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <h2>Music Library</h2>

                <p>{error}</p>

                <button
                    className="btn btn-primary"
                    onClick={fetchSongs}
                >
                    ↻ Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent:
                        "space-between",
                    alignItems: "center",
                    marginBottom:
                        "20px",
                    gap: "15px",
                    flexWrap:
                        "wrap",
                }}
            >
                <div>
                    <h2>
                        Music Library
                    </h2>

                    <p
                        style={{
                            margin: 0,
                            color: "#666",
                        }}
                    >
                        {
                            filteredSongs.length
                        }{" "}
                        of{" "}
                        {songs.length}{" "}
                        songs
                    </p>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={fetchSongs}
                    disabled={loading}
                >
                    ↻ Refresh
                </button>
            </div>

            {/* Search + filters */}
            <div
                style={{
                    display: "flex",
                    gap: "10px",
                    marginBottom:
                        "20px",
                    flexWrap:
                        "wrap",
                }}
            >
                <input
                    type="text"
                    placeholder="Search songs, artists or albums..."
                    value={search}
                    onChange={(event) =>
                        setSearch(
                            event.target
                                .value
                        )
                    }
                    style={{
                        flex: "1 1 300px",
                        minWidth:
                            "250px",
                        padding:
                            "10px 12px",
                        border:
                            "1px solid #ddd",
                        borderRadius:
                            "6px",
                    }}
                />

                <select
                    value={songFilter}
                    onChange={(
                        event
                    ) =>
                        setSongFilter(
                            event.target
                                .value
                        )
                    }
                    style={{
                        padding:
                            "10px 12px",
                        border:
                            "1px solid #ddd",
                        borderRadius:
                            "6px",
                    }}
                >
                    <option value="all">
                        All Songs
                    </option>

                    <option value="downloaded">
                        Downloaded
                    </option>

                    <option value="pending">
                        Pending
                    </option>

                    <option value="failed">
                        Failed
                    </option>
                </select>

                <select
                    value={
                        lyricsFilter
                    }
                    onChange={(
                        event
                    ) =>
                        setLyricsFilter(
                            event.target
                                .value
                        )
                    }
                    style={{
                        padding:
                            "10px 12px",
                        border:
                            "1px solid #ddd",
                        borderRadius:
                            "6px",
                    }}
                >
                    <option value="all">
                        All Lyrics
                    </option>

                    <option value="available">
                        Lyrics Available
                    </option>

                    <option value="pending">
                        Lyrics Pending
                    </option>

                    <option value="failed">
                        Lyrics Failed
                    </option>

                    <option value="unavailable">
                        Lyrics Unavailable
                    </option>
                </select>
            </div>

            {/* Song list */}
            {filteredSongs.length ===
                0 ? (
                <div
                    style={{
                        padding:
                            "40px",
                        textAlign:
                            "center",
                        color: "#777",
                    }}
                >
                    No songs found.
                </div>
            ) : (
                <div>
                    {filteredSongs.map((song) => {
                        const isExpanded =
                            expandedSongId === song.id;

                        const songStatus =
                            getSongStatus(song.download_status);

                        const lyricsStatus =
                            getLyricsStatus(song);

                        const isCurrent =
                            currentSong?.id === song.id;



                        return (
                            <div
                                key={
                                    song.id
                                }
                                style={{
                                    marginBottom:
                                        "8px",

                                    border:
                                        isExpanded
                                            ? "1px solid #61dafb"
                                            : "1px solid #e5e5e5",

                                    borderRadius:
                                        "8px",

                                    overflow:
                                        "hidden",

                                    background:
                                        "#fff",
                                }}
                            >
                                {/* Row */}
                                <div
                                    onClick={() =>
                                        setExpandedSongId(
                                            isExpanded
                                                ? null
                                                : song.id
                                        )
                                    }
                                    style={{
                                        display:
                                            "flex",
                                        alignItems:
                                            "center",
                                        gap:
                                            "15px",
                                        padding:
                                            "14px 16px",
                                        cursor:
                                            "pointer",
                                    }}
                                >
                                    {/* Status dots */}
                                    <div
                                        style={{
                                            display:
                                                "flex",
                                            gap:
                                                "6px",
                                            alignItems:
                                                "center",
                                        }}
                                    >
                                        {renderStatusDot(
                                            songStatus,
                                            `Song: ${song.download_status}`
                                        )}

                                        {renderStatusDot(
                                            lyricsStatus,
                                            `Lyrics: ${song.lyrics_status}`
                                        )}
                                    </div>

                                    {/* Song */}
                                    <div
                                        style={{
                                            flex: 1,
                                            minWidth:
                                                0,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontWeight:
                                                    600,
                                                overflow:
                                                    "hidden",
                                                textOverflow:
                                                    "ellipsis",
                                                whiteSpace:
                                                    "nowrap",
                                            }}
                                        >
                                            {
                                                song.title
                                            }
                                        </div>

                                        <div
                                            style={{
                                                color:
                                                    "#777",
                                                fontSize:
                                                    "14px",
                                                marginTop:
                                                    "3px",
                                            }}
                                        >
                                            {song.artist ||
                                                "Unknown artist"}
                                        </div>
                                    </div>

                                    {/* Duration */}
                                    <div
                                        style={{
                                            color:
                                                "#777",
                                            fontSize:
                                                "14px",
                                        }}
                                        title="Duration"
                                    >
                                        {formatDuration(
                                            song.duration
                                        )}
                                    </div>

                                    {/* Playing */}
                                    {isCurrent &&
                                        isPlaying && (
                                            <span
                                                title="Playing"
                                                style={{
                                                    color:
                                                        "#61dafb",
                                                }}
                                            >
                                                ▶
                                            </span>
                                        )}

                                    {/* Expand */}
                                    <div
                                        style={{
                                            fontSize:
                                                "18px",
                                            transform:
                                                isExpanded
                                                    ? "rotate(180deg)"
                                                    : "rotate(0deg)",
                                            transition:
                                                "transform 0.2s",
                                        }}
                                    >
                                        ▼
                                    </div>
                                </div>

                                {/* Expanded section */}
                                {isExpanded && (
                                    <div
                                        style={{
                                            borderTop:
                                                "1px solid #eee",
                                        }}
                                    >
                                        {/* Player */}
                                        {song.download_status ===
                                            "downloaded" ? (
                                            <div
                                                style={{
                                                    padding:
                                                        "15px 20px",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display:
                                                            "flex",
                                                        alignItems:
                                                            "center",
                                                        gap:
                                                            "10px",
                                                        marginBottom:
                                                            "10px",
                                                    }}
                                                >
                                                    <button
                                                        className={`btn ${isCurrent && isPlaying
                                                            ? "btn-selected"
                                                            : "btn-primary"
                                                            }`}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            selectSong(song);
                                                        }}
                                                        disabled={
                                                            song.download_status !== "downloaded"
                                                        }
                                                    >
                                                        {isCurrent && isPlaying ? "Pause" : "Play"}
                                                    </button>

                                                    <span
                                                        style={{
                                                            color:
                                                                "#777",
                                                            fontSize:
                                                                "14px",
                                                        }}
                                                    >
                                                        {isCurrent
                                                            ? "Now playing"
                                                            : "Click Play to listen"}
                                                    </span>
                                                </div>

                                                <div
                                                    style={{
                                                        flex: 1,
                                                        height: "8px",
                                                        background: "#e5e7eb",
                                                        borderRadius: "999px",
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width:
                                                                isCurrent && currentSong?.duration
                                                                    ? `${Math.min(
                                                                        100,
                                                                        (currentTime /
                                                                            currentSong.duration) *
                                                                        100
                                                                    )}%`
                                                                    : "0%",
                                                            height: "100%",
                                                            background: "#61dafb",
                                                            transition: "width 0.1s linear",
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                style={{
                                                    padding:
                                                        "15px 20px",
                                                    color:
                                                        "#777",
                                                }}
                                            >
                                                Audio is not
                                                available.
                                            </div>
                                        )}

                                        {/* Lyrics */}
                                        <div
                                            style={{
                                                borderTop:
                                                    "1px solid #eee",
                                                padding:
                                                    "10px 20px 20px",
                                            }}
                                        >
                                            <Lyrics
                                                song={
                                                    song
                                                }
                                                currentTime={
                                                    isCurrent
                                                        ? currentTime
                                                        : 0
                                                }
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    }
                    )}
                </div>
            )}

            {/* Persistent audio element.
             *
             * This element is deliberately kept
             * outside the song list so its ref never
             * changes when rows expand/collapse.
             */}
            <audio
                ref={audioRef}
                preload="metadata"
                onTimeUpdate={
                    handleTimeUpdate
                }
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handleEnded}
                style={{
                    display: "none",
                }}
            />
        </div>
    );
}

export default Songs;