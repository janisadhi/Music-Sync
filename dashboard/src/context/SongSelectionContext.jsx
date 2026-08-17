import { createContext, useContext, useState, useCallback } from "react";

const SongSelectionContext = createContext(null);

export function SongSelectionProvider({ children }) {
    const [selectedSongIds, setSelectedSongIds] = useState([]);

    const toggleSelectSong = useCallback((songId) => {
        setSelectedSongIds((prev) => {
            if (prev.includes(songId)) {
                return prev.filter((id) => id !== songId);
            } else {
                return [...prev, songId];
            }
        });
    }, []);

    const selectSongs = useCallback((songIds) => {
        setSelectedSongIds((prev) => Array.from(new Set([...prev, ...songIds])));
    }, []);

    const deselectSongs = useCallback((songIds) => {
        const removeSet = new Set(songIds);
        setSelectedSongIds((prev) => prev.filter((id) => !removeSet.has(id)));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedSongIds([]);
    }, []);

    const isSelected = useCallback(
        (songId) => selectedSongIds.includes(songId),
        [selectedSongIds]
    );

    const isAllSelected = useCallback(
        (visibleSongs = []) => {
            if (!visibleSongs || visibleSongs.length === 0) return false;
            return visibleSongs.every((s) => selectedSongIds.includes(s.id));
        },
        [selectedSongIds]
    );

    const toggleSelectAll = useCallback(
        (visibleSongs = []) => {
            const visibleIds = visibleSongs.map((s) => s.id);
            if (isAllSelected(visibleSongs)) {
                deselectSongs(visibleIds);
            } else {
                selectSongs(visibleIds);
            }
        },
        [isAllSelected, deselectSongs, selectSongs]
    );

    return (
        <SongSelectionContext.Provider
            value={{
                selectedSongIds,
                toggleSelectSong,
                selectSongs,
                deselectSongs,
                clearSelection,
                isSelected,
                isAllSelected,
                toggleSelectAll,
            }}
        >
            {children}
        </SongSelectionContext.Provider>
    );
}

export function useSongSelection() {
    const context = useContext(SongSelectionContext);
    if (!context) {
        throw new Error("useSongSelection must be used within a SongSelectionProvider");
    }
    return context;
}
