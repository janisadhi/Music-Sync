import api from "./api";

export const getSongs = async () => {
    const response = await api.get("/songs");
    return response.data;
};

export const getSongLyrics = async (songId) => {
    const response = await api.get(
        `/songs/${songId}/lyrics`
    );

    return response.data;
};

export const getSongAudioUrl = (songId) => {
    return `${api.defaults.baseURL}/songs/${songId}/audio`;
};