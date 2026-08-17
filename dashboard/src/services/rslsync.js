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

export async function generateShareInfo(folderId = "music-downloads", permission = "read_write") {
    const response = await api.post("/api/rslsync/shares/generate", {
        folder_id: folderId,
        permission: permission,
    });
    return response.data;
}

export async function getPairingStatus(folderId = "music-downloads") {
    const response = await api.get("/api/rslsync/pairing-status", {
        params: { folder_id: folderId },
    });
    return response.data;
}

export async function revokePeer(peerId) {
    const response = await api.delete(`/api/rslsync/peers/${peerId}`);
    return response.data;
}

