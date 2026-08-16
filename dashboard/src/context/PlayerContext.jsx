import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getSongAudioUrl } from "../services/songs";

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
    const audioRef = useRef(null);
    const [currentSong, setCurrentSong] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolumeState] = useState(() => {
        const saved = localStorage.getItem("player_volume");
        return saved !== null ? parseFloat(saved) : 0.8;
    });
    const [shuffle, setShuffle] = useState(false);
    const [repeat, setRepeat] = useState("off"); // "off" | "all" | "one"
    const [queue, setQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [shuffledQueue, setShuffledQueue] = useState([]);

    // Keep volume in sync with audio element and localStorage
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
        localStorage.setItem("player_volume", volume.toString());
    }, [volume]);

    // Handle song change
    useEffect(() => {
        if (!currentSong || !audioRef.current) return;

        const audio = audioRef.current;
        const songUrl = getSongAudioUrl(currentSong.id);
        
        if (audio.src !== songUrl) {
            audio.src = songUrl;
            audio.load();
        }

        audio.play()
            .then(() => setIsPlaying(true))
            .catch((err) => {
                console.warn("Autoplay blocked or playback error:", err);
                setIsPlaying(false);
            });
    }, [currentSong]);

    const activeQueue = shuffle ? shuffledQueue : queue;

    function generateShuffledQueue(list, startSong) {
        const copy = [...list];
        const index = copy.findIndex((s) => s.id === startSong?.id);
        if (index > -1) {
            copy.splice(index, 1);
        }
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return startSong ? [startSong, ...copy] : copy;
    }

    const playSong = (song, newQueue = null) => {
        if (!song) return;
        const targetQueue = newQueue && newQueue.length > 0 ? newQueue : [song];
        const index = targetQueue.findIndex((s) => s.id === song.id);

        setQueue(targetQueue);
        setCurrentIndex(index >= 0 ? index : 0);
        setCurrentSong(song);

        if (shuffle) {
            setShuffledQueue(generateShuffledQueue(targetQueue, song));
        }
    };

    const playPlaylist = (songsList, startIndex = 0, enableShuffle = false) => {
        if (!songsList || songsList.length === 0) return;

        const initialSong = enableShuffle
            ? songsList[Math.floor(Math.random() * songsList.length)]
            : songsList[startIndex] || songsList[0];

        setShuffle(enableShuffle);
        setQueue(songsList);
        const index = songsList.findIndex((s) => s.id === initialSong.id);
        setCurrentIndex(index >= 0 ? index : 0);
        setCurrentSong(initialSong);

        if (enableShuffle) {
            setShuffledQueue(generateShuffledQueue(songsList, initialSong));
        }
    };

    const togglePlay = () => {
        if (!audioRef.current || !currentSong) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(() => setIsPlaying(false));
        }
    };

    const pause = () => {
        if (audioRef.current && isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    };

    const resume = () => {
        if (audioRef.current && !isPlaying && currentSong) {
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(() => setIsPlaying(false));
        }
    };

    const next = () => {
        if (activeQueue.length === 0) return;

        if (repeat === "one" && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
            return;
        }

        const currentQIndex = activeQueue.findIndex((s) => s.id === currentSong?.id);
        let nextIndex = currentQIndex + 1;

        if (nextIndex >= activeQueue.length) {
            if (repeat === "all") {
                nextIndex = 0;
            } else {
                setIsPlaying(false);
                return;
            }
        }

        const nextSong = activeQueue[nextIndex];
        if (nextSong) {
            setCurrentSong(nextSong);
            setCurrentIndex(queue.findIndex((s) => s.id === nextSong.id));
        }
    };

    const previous = () => {
        if (!audioRef.current || activeQueue.length === 0) return;

        if (audioRef.current.currentTime > 3) {
            audioRef.current.currentTime = 0;
            return;
        }

        const currentQIndex = activeQueue.findIndex((s) => s.id === currentSong?.id);
        let prevIndex = currentQIndex - 1;

        if (prevIndex < 0) {
            prevIndex = repeat === "all" ? activeQueue.length - 1 : 0;
        }

        const prevSong = activeQueue[prevIndex];
        if (prevSong) {
            setCurrentSong(prevSong);
            setCurrentIndex(queue.findIndex((s) => s.id === prevSong.id));
        }
    };

    const seek = (time) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const setVolume = (val) => {
        const clamped = Math.max(0, Math.min(1, val));
        setVolumeState(clamped);
    };

    const toggleShuffle = () => {
        setShuffle((prev) => {
            const nextShuffle = !prev;
            if (nextShuffle && currentSong) {
                setShuffledQueue(generateShuffledQueue(queue, currentSong));
            }
            return nextShuffle;
        });
    };

    const toggleRepeat = () => {
        setRepeat((prev) => {
            if (prev === "off") return "all";
            if (prev === "all") return "one";
            return "off";
        });
    };

    const addToQueue = (song) => {
        if (!song) return;
        setQueue((prev) => [...prev, song]);
    };

    const onAudioTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration || 0);
        }
    };

    const onAudioEnded = () => {
        next();
    };

    const value = {
        currentSong,
        isPlaying,
        currentTime,
        duration,
        volume,
        shuffle,
        repeat,
        queue: activeQueue,
        rawQueue: queue,
        currentIndex,
        playSong,
        playPlaylist,
        togglePlay,
        pause,
        resume,
        next,
        previous,
        seek,
        setVolume,
        toggleShuffle,
        toggleRepeat,
        addToQueue,
    };

    return (
        <PlayerContext.Provider value={value}>
            {children}
            <audio
                ref={audioRef}
                onTimeUpdate={onAudioTimeUpdate}
                onEnded={onAudioEnded}
                onLoadedMetadata={onAudioTimeUpdate}
                style={{ display: "none" }}
            />
        </PlayerContext.Provider>
    );
}

export function usePlayer() {
    const context = useContext(PlayerContext);
    if (!context) {
        throw new Error("usePlayer must be used within a PlayerProvider");
    }
    return context;
}
