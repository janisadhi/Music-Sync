import api from "./api";

export async function getResilioOverview(forceRefresh = false) {
    const response = await api.get("/api/rslsync/overview", {
        params: { force_refresh: forceRefresh },
    });
    return response.data;
}

export async function getResilioStatus() {
    const response = await api.get("/api/rslsync/status");
    return response.data;
}

export async function getResilioFolders() {
    const response = await api.get("/api/rslsync/folders");
    return response.data;
}

export async function getResilioPeers() {
    const response = await api.get("/api/rslsync/peers");
    return response.data;
}

export async function getResilioTransfers() {
    const response = await api.get("/api/rslsync/transfers");
    return response.data;
}

export async function getResilioErrors() {
    const response = await api.get("/api/rslsync/errors");
    return response.data;
}
