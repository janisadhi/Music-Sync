import { useEffect, useRef, useState } from "react";

function MusicPlayer({ song, onNext, onPrevious }) {
    const audioRef = useRef(null);

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        if (!song || !audioRef.current) {
            return;
        }

        audioRef.current.load();

        setCurrentTime(0);
        setDuration(song.duration || 0);
        setPlaying(false);
    }, [song]);

    const togglePlay = async () => {
        if (!song || !audioRef.current) {
            return;
        }

        if (audioRef.current.paused) {
            try {
                await audioRef.current.play();
                setPlaying(true);
            } catch (error) {
                console.error(
                    "Failed to play audio:",
                    error
                );
            }
        } else {
            audioRef.current.pause();
            setPlaying(false);
        }
    };

    const handleTimeUpdate = () => {
        setCurrentTime(audioRef.current.currentTime);
    };

    const handleLoadedMetadata = () => {
        setDuration(audioRef.current.duration);
    };

    const handleEnded = () => {
        setPlaying(false);
        onNext();
    };

    const seek = (event) => {
        const value = Number(event.target.value);

        audioRef.current.currentTime = value;
        setCurrentTime(value);
    };

    const formatTime = (seconds) => {
        if (!Number.isFinite(seconds)) {
            return "0:00";
        }

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);

        return `${minutes}:${String(
            remainingSeconds
        ).padStart(2, "0")}`;
    };

    if (!song) {
        return (
            <div>
                <p>Select a song to start playing.</p>
            </div>
        );
    }

    return (
        <div
            style={{
                padding: "20px",
                borderTop: "1px solid #ddd",
            }}
        >
            <audio
                ref={audioRef}
                src={`http://localhost:8000/songs/${song.id}/audio`}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
            />

            <div>
                <strong>{song.title}</strong>

                {song.artist && (
                    <div>{song.artist}</div>
                )}
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginTop: "15px",
                }}
            >
                <button onClick={onPrevious}>
                    Previous
                </button>

                <button onClick={togglePlay}>
                    {playing ? "Pause" : "Play"}
                </button>

                <button onClick={onNext}>
                    Next
                </button>
            </div>

            <div style={{ marginTop: "15px" }}>
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.1"
                    value={currentTime}
                    onChange={seek}
                    style={{
                        width: "100%",
                    }}
                />

                <div
                    style={{
                        display: "flex",
                        justifyContent:
                            "space-between",
                    }}
                >
                    <span>
                        {formatTime(currentTime)}
                    </span>

                    <span>
                        {formatTime(duration)}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default MusicPlayer;