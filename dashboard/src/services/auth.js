import api from "./api";

const TOKEN_KEY = "music_sync_token";
const USER_KEY = "music_sync_user";

export async function login(username, password) {
    const response = await api.post("/api/auth/login", {
        username,
        password,
    });
    const { access_token, user } = response.data;
    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return response.data;
}

export async function changePassword(currentPassword, newPassword) {
    const response = await api.post("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
    });
    const { user } = response.data;
    if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    return response.data;
}

export async function fetchMe() {
    const response = await api.get("/api/auth/me");
    localStorage.setItem(USER_KEY, JSON.stringify(response.data));
    return response.data;
}

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

export function isAuthenticated() {
    return Boolean(getToken());
}
