import { useEffect, useRef } from "react";
import { getSongAudioUrl } from "../services/songs";

function AudioPlayer({
    song,
    onTimeUpdate,
    onNext,
    onPrevious,
}) {
    const audioRef = useRef(null);

    useEffect(() => {
        if (!song || !audioRef.current) {
            return;
        }

        audioRef.current.load();

        audioRef.current.play().catch(() => {
            // Browser may block autoplay.
        });
    }, [song]);

    if (!song) {
        return (
            <section>
                <h2>Player</h2>
                <p>Select a song to start playing.</p>
            </section>
        );
    }

    if (song.download_status !== "downloaded") {
        return (
            <section>
                <h2>Player</h2>
                <p>
                    This song has not been downloaded yet.
                </p>
            </section>
        );
    }

    return (
        <section>
            <h2>Now Playing</h2>

            <h3>{song.title}</h3>

            <div>
                <button
                    onClick={onPrevious}
                    disabled={!onPrevious}
                >
                    Previous
                </button>

                <button
                    onClick={onNext}
                    disabled={!onNext}
                    style={{ marginLeft: "10px" }}
                >
                    Next
                </button>
            </div>

            <audio
                ref={audioRef}
                controls
                preload="metadata"
                onTimeUpdate={(event) => {
                    onTimeUpdate?.(
                        event.currentTarget.currentTime
                    );
                }}
                onEnded={() => {
                    onNext?.();
                }}
                style={{
                    width: "100%",
                    marginTop: "15px",
                }}
            >
                <source
                    src={getSongAudioUrl(song.id)}
                    type="audio/ogg; codecs=opus"
                />

                Your browser does not support audio playback.
            </audio>
        </section>
    );
}

export default AudioPlayer;