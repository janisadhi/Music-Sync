import { useEffect, useState } from "react";

import {
    getSongs,
    getSongAudioUrl,
    retryDownload,
    retryLyrics,
    deleteSong,
} from "../services/songs";


function Songs({ onSelectSong, selectedSong }) {
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] =
        useState(null);


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

        const remainingSeconds =
            seconds % 60;

        return `${minutes}:${String(
            remainingSeconds
        ).padStart(2, "0")}`;
    };


    const handleRetryDownload = async (songId) => {
        try {
            setActionLoading(
                `download-${songId}`
            );

            setError(null);

            await retryDownload(songId);

            await fetchSongs();

        } catch (error) {
            console.error(
                "Failed to retry download:",
                error
            );

            setError(
                error.response?.data?.detail ||
                "Failed to retry download."
            );
        } finally {
            setActionLoading(null);
        }
    };


    const handleRetryLyrics = async (songId) => {
        try {
            setActionLoading(
                `lyrics-${songId}`
            );

            setError(null);

            await retryLyrics(songId);

            await fetchSongs();

        } catch (error) {
            console.error(
                "Failed to retry lyrics:",
                error
            );

            setError(
                error.response?.data?.detail ||
                "Failed to retry lyrics."
            );
        } finally {
            setActionLoading(null);
        }
    };


    const handleDelete = async (songId) => {
        const confirmed =
            window.confirm(
                "Are you sure you want to delete this song?"
            );

        if (!confirmed) {
            return;
        }

        try {
            setActionLoading(
                `delete-${songId}`
            );

            setError(null);

            await deleteSong(songId);

            if (
                selectedSong?.id === songId
            ) {
                onSelectSong?.(null);
            }

            await fetchSongs();

        } catch (error) {
            console.error(
                "Failed to delete song:",
                error
            );

            setError(
                error.response?.data?.detail ||
                "Failed to delete song."
            );
        } finally {
            setActionLoading(null);
        }
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


    if (error && songs.length === 0) {
        return (
            <div>
                <h2>Music Library</h2>

                <p>{error}</p>

                <button
                    onClick={fetchSongs}
                >
                    Retry
                </button>
            </div>
        );
    }


    return (
        <div>

            <div>
                <h2>
                    Music Library
                </h2>

                <p>
                    {songs.length}{" "}
                    {songs.length === 1
                        ? "song"
                        : "songs"}
                </p>
            </div>


            {error && (
                <div>
                    <p>{error}</p>
                </div>
            )}


            {songs.length === 0 ? (
                <p>
                    No songs found.
                </p>
            ) : (
                <div>

                    {songs.map((song) => {

                        const isSelected =
                            selectedSong?.id ===
                            song.id;

                        const retryDownloadLoading =
                            actionLoading ===
                            `download-${song.id}`;

                        const retryLyricsLoading =
                            actionLoading ===
                            `lyrics-${song.id}`;

                        const deleteLoading =
                            actionLoading ===
                            `delete-${song.id}`;


                        return (
                            <div
                                key={song.id}
                                style={{
                                    padding: "15px",
                                    marginBottom: "10px",
                                    border:
                                        isSelected
                                            ? "2px solid #61dafb"
                                            : "1px solid #ddd",
                                    borderRadius: "8px",
                                }}
                            >

                                <h3>
                                    {song.title}
                                </h3>


                                {song.artist && (
                                    <p>
                                        Artist:{" "}
                                        {song.artist}
                                    </p>
                                )}


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


                                {song.error_message && (
                                    <p>
                                        Error:{" "}
                                        {
                                            song.error_message
                                        }
                                    </p>
                                )}


                                <div
                                    style={{
                                        display: "flex",
                                        gap: "8px",
                                        flexWrap: "wrap",
                                    }}
                                >

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
                                                display:
                                                    "block",
                                                width:
                                                    "100%",
                                                marginTop:
                                                    "10px",
                                            }}
                                        />
                                    )}


                                    {song.download_status ===
                                        "failed" && (
                                        <button
                                            onClick={() =>
                                                handleRetryDownload(
                                                    song.id
                                                )
                                            }
                                            disabled={
                                                retryDownloadLoading
                                            }
                                        >
                                            {retryDownloadLoading
                                                ? "Retrying..."
                                                : "↻ Retry Download"}
                                        </button>
                                    )}


                                    {(
                                        song.lyrics_status ===
                                            "failed" ||
                                        song.lyrics_status ===
                                            "unavailable"
                                    ) &&
                                        song.download_status ===
                                            "downloaded" && (
                                        <button
                                            onClick={() =>
                                                handleRetryLyrics(
                                                    song.id
                                                )
                                            }
                                            disabled={
                                                retryLyricsLoading
                                            }
                                        >
                                            {retryLyricsLoading
                                                ? "Retrying..."
                                                : "↻ Retry Lyrics"}
                                        </button>
                                    )}


                                    <button
                                        onClick={() =>
                                            handleDelete(
                                                song.id
                                            )
                                        }
                                        disabled={
                                            deleteLoading
                                        }
                                    >
                                        {deleteLoading
                                            ? "Deleting..."
                                            : "Delete"}
                                    </button>

                                </div>

                            </div>
                        );
                    })}

                </div>
            )}

        </div>
    );
}

export default Songs;