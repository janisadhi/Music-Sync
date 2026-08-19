# API Error Handling

## Error Response Format

FastAPI handles errors by throwing `HTTPException` instances, returning standard JSON payloads with a `detail` field.

### Standard Error Schema:
```json
{
  "detail": "Error description message explaining the failure cause."
}
```

---

## Standard Status Codes Used

| Status Code | Code Name | Cause / Trigger Conditions |
| :--- | :--- | :--- |
| `200` | OK | Request completed successfully. |
| `201` | Created | Resource created successfully (`POST /playlists`). |
| `400` | Bad Request | Validation errors (invalid YouTube URL, sync interval < 10s, invalid password). |
| `401` | Unauthorized | Missing, invalid, or expired Bearer token on protected auth endpoints. |
| `404` | Not Found | Requested playlist ID or song ID does not exist in PostgreSQL. |
| `500` | Internal Server Error | Unhandled backend exceptions (file unlinking failures, sync errors). |

---

## Validation Error Handling

Pydantic validators in `app/api/schemas.py` and `app/api/settings.py` validate request payloads before hitting route handlers.

### Example Validation Error Response (`PATCH /settings` with `sync_interval_seconds = 5`):
```json
{
  "detail": [
    {
      "type": "greater_than_equal",
      "loc": ["body", "sync_interval_seconds"],
      "msg": "Input should be greater than or equal to 10",
      "input": 5,
      "ctx": {
        "ge": 10
      }
    }
  ]
}
```
