import api from "./api";

export const getSongs = async () => {
    const response = await api.get("/songs");
    return response.data;
};

export const getSong = async (songId) => {
    const response = await api.get(`/songs/${songId}`);
    return response.data;
};

export const getLyrics = async (songId) => {
    const response = await api.get(`/songs/${songId}/lyrics`);
    return response.data;
};

export const getAudioUrl = (songId) => {
    return `${api.defaults.baseURL}/songs/${songId}/audio`;
};
