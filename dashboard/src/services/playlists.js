import api from "./api";

export const getPlaylists = async () => {
    const response = await api.get("/playlists");
    return response.data;
};

export const getPlaylist = async (playlistId) => {
    const response = await api.get(
        `/playlists/${playlistId}`
    );

    return response.data;
};

export const getPlaylistSongs = async (playlistId) => {
    const response = await api.get(
        `/playlists/${playlistId}/songs`
    );

    return response.data;
};

export const createPlaylist = async (data) => {
    const response = await api.post(
        "/playlists",
        data
    );

    return response.data;
};

export const updatePlaylist = async (
    playlistId,
    data
) => {
    const response = await api.patch(
        `/playlists/${playlistId}`,
        data
    );

    return response.data;
};

export const deletePlaylist = async (playlistId) => {
    const response = await api.delete(
        `/playlists/${playlistId}`
    );

    return response.data;
};

export const syncPlaylist = async (playlistId) => {
    const response = await api.post(
        `/playlists/${playlistId}/sync`
    );

    return response.data;
};