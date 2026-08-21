import api from "./api";

export const triggerScan = async (forceReprocess = false) => {
    const response = await api.post("/api/metadata/scan", null, {
        params: { force_reprocess: forceReprocess },
    });
    return response.data;
};

export const getMetadataStatus = async () => {
    const response = await api.get("/api/metadata/status");
    return response.data;
};

export const getMetadataResults = async (params = {}) => {
    const response = await api.get("/api/metadata/results", { params });
    return response.data;
};

export const enrichTrack = async (trackId) => {
    const response = await api.post(`/api/metadata/enrich/${trackId}`);
    return response.data;
};

export const getTrackDetail = async (trackId) => {
    const response = await api.get(`/api/metadata/tracks/${trackId}`);
    return response.data;
};

export const embedArtworkUrl = async (trackId, imageUrl) => {
    const response = await api.post(`/api/metadata/artwork/${trackId}/url`, null, {
        params: { image_url: imageUrl },
    });
    return response.data;
};

export const fetchBeetsArtwork = async (trackId) => {
    const response = await api.post(`/api/metadata/artwork/${trackId}/fetch-beets`);
    return response.data;
};
