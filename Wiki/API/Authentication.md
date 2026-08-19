# API Authentication

## Bearer Token Specification

Authentication headers use standard HTTP `Authorization: Bearer <jwt_token>` format.

---

## 1. Login Request (`POST /api/auth/login`)

### Request Payload:
```json
{
  "username": "admin",
  "password": "adminpassword"
}
```

### Success Response (`200 OK`):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc1NTkwNzIwMCwiaWF0IjoxNzU1MzAyNDAwfQ...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "admin",
    "must_change_password": true
  }
}
```

---

## 2. Password Change (`POST /api/auth/change-password`)

Requires active Bearer token in headers (`Authorization: Bearer <token>`).

### Request Payload:
```json
{
  "current_password": "adminpassword",
  "new_password": "NewSecurePassword123!"
}
```

### Success Response (`200 OK`):
```json
{
  "message": "Password changed successfully.",
  "user": {
    "id": 1,
    "username": "admin",
    "must_change_password": false
  }
}
```

---

## 3. Frontend Interceptor Implementation

The React SPA dashboard manages tokens automatically via Axios request/response interceptors in `dashboard/src/services/api.js`:

```javascript
// Attach Authorization Bearer token to all outgoing requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("music_sync_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 Unauthorized responses globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem("music_sync_token");
            localStorage.removeItem("music_sync_user");
            if (window.location.pathname !== "/login") {
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);
```
