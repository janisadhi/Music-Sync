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

export async function getPairingStatus(folderId = "music-downloads", knownPeers = []) {
    const params = { folder_id: folderId };
    if (knownPeers && knownPeers.length > 0) {
        params.known_peers = knownPeers.join(",");
    }
    const response = await api.get("/api/rslsync/pairing-status", { params });
    return response.data;
}

export async function revokePeer(peerId, folderId = null) {
    const params = folderId ? { folder_id: folderId } : {};
    const response = await api.delete(`/api/rslsync/peers/${peerId}`, { params });
    return response.data;
}

export async function getResilioLicense() {
    const response = await api.get("/api/rslsync/license");
    return response.data;
}

export async function updateResilioLicense(licenseKey) {
    const response = await api.post("/api/rslsync/license", {
        license_key: licenseKey,
    });
    return response.data;
}

export async function deleteResilioLicense() {
    const response = await api.delete("/api/rslsync/license");
    return response.data;
}


