import api from "./api";

export const getSongs = async (params = {}) => {
    const response = await api.get("/songs", { params });
    return response.data;
};

export const getArtists = async () => {
    const response = await api.get("/songs/artists");
    return response.data;
};;

export const getSongLyrics = async (songId) => {
    const response = await api.get(
        `/songs/${songId}/lyrics`
    );

    return response.data;
};

export const getSongAudioUrl = (songId) => {
    return `${api.defaults.baseURL}/songs/${songId}/audio`;
};

export const retryDownload = async (songId) => {
    const response = await api.post(
        `/songs/${songId}/retry-download`
    );

    return response.data;
};

export const retryLyrics = async (songId) => {
    const response = await api.post(
        `/songs/${songId}/retry-lyrics`
    );

    return response.data;
};

export const deleteSong = async (songId) => {
    const response = await api.delete(
        `/songs/${songId}`
    );

    return response.data;
};