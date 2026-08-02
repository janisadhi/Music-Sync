from datetime import datetime

from sqlalchemy import Boolean,Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[int] = mapped_column(primary_key=True)

    youtube_playlist_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    songs: Mapped[list["Song"]] = relationship(
        back_populates="playlist",
        cascade="all, delete-orphan",
    )


class Song(Base):
    __tablename__ = "songs"

    id: Mapped[int] = mapped_column(primary_key=True)

    playlist_id: Mapped[int] = mapped_column(
        ForeignKey("playlists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    youtube_video_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    artist: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    album: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    duration: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    position: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    download_status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
    )

    lyrics_status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
    )

    file_path: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    lyrics_path: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    error_message = Column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    playlist: Mapped["Playlist"] = relationship(
        back_populates="songs",
    )
class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        default=1,
    )

    sync_interval_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=60,
    )

    download_limit: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    lyrics_limit: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    youtube_playlist_url: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )