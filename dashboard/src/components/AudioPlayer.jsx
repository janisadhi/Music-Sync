import { getAudioUrl } from "../services/songs";

function AudioPlayer({ song }) {
    if (!song) {
        return <p>Select a song to play.</p>;
    }

    return (
        <section>
            <h2>Now Playing</h2>

            <p>
                <strong>{song.title}</strong>
            </p>

            <audio
                controls
                autoPlay
                src={getAudioUrl(song.id)}
                style={{ width: "100%" }}
            />
        </section>
    );
}

export default AudioPlayer;
