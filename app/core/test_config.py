import pytest
from app.core.config import Settings


def test_cors_origins_default(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    s = Settings(database_url="postgresql://user:pass@localhost/db")
    assert s.cors_origins == ["*"]


def test_cors_origins_comma_separated(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000, http://127.0.0.1:3000")
    s = Settings(database_url="postgresql://user:pass@localhost/db")
    assert s.cors_origins == ["http://localhost:3000", "http://127.0.0.1:3000"]


def test_cors_origins_json_array(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", '["http://localhost:3000", "http://example.com"]')
    s = Settings(database_url="postgresql://user:pass@localhost/db")
    assert s.cors_origins == ["http://localhost:3000", "http://example.com"]


def test_cors_origins_wildcard(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "*")
    s = Settings(database_url="postgresql://user:pass@localhost/db")
    assert s.cors_origins == ["*"]


def test_cors_origins_trailing_slashes_and_quotes(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "'https://music.janis.com.np/', \"http://localhost:3000/\"")
    s = Settings(database_url="postgresql://user:pass@localhost/db")
    assert s.cors_origins == ["https://music.janis.com.np", "http://localhost:3000"]

