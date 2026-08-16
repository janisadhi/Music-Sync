import difflib
import logging
from dataclasses import dataclass
from typing import Any

from metadata_service.normalizer import normalize_string, clean_title, clean_artist

logger = logging.getLogger("metadata_service.matcher")


@dataclass
class MatchResult:
    score: float
    confidence: str  # "HIGH", "MEDIUM", "LOW"
    source: str      # "MusicBrainz", "Embedded Tags", "YouTube Fallback"
    title: str
    artist: str
    album: str | None = None
    album_artist: str | None = None
    genre: str | None = None
    track_number: int | None = None
    release_year: int | None = None
    recording_id: str | None = None
    artist_id: str | None = None
    reason: str = ""


class CandidateMatcher:
    """Multi-signal candidate matching & scoring engine."""

    @staticmethod
    def calculate_string_similarity(str1: str, str2: str) -> float:
        norm1 = normalize_string(str1)
        norm2 = normalize_string(str2)
        if not norm1 or not norm2:
            return 0.0
        if norm1 == norm2:
            return 1.0
        # Check substring containment
        if norm1 in norm2 or norm2 in norm1:
            ratio = min(len(norm1), len(norm2)) / max(len(norm1), len(norm2))
            return max(ratio, 0.8)
        return difflib.SequenceMatcher(None, norm1, norm2).ratio()

    @staticmethod
    def score_duration(target_sec: int | None, candidate_sec: int | None) -> tuple[float, float]:
        """
        Returns (score, penalty).
        Tolerance:
        <= 3s diff: score 1.0, penalty 0.0
        3-10s diff: score 0.7, penalty 0.0
        10-30s diff: score 0.3, penalty 0.0
        >30s diff: score 0.0, penalty 0.25
        """
        if target_sec is None or candidate_sec is None:
            return 0.5, 0.0

        diff = abs(target_sec - candidate_sec)
        if diff <= 3:
            return 1.0, 0.0
        elif diff <= 10:
            return 0.7, 0.0
        elif diff <= 30:
            return 0.3, 0.0
        else:
            return 0.0, 0.25

    def score_candidate(
        self,
        target: dict[str, Any],
        candidate: dict[str, Any],
    ) -> tuple[float, dict[str, float]]:
        """
        Calculates weighted composite score for candidate against target.
        Weights: Title (40%), Artist (35%), Duration (15%), Album/Year (10%)
        """
        target_title = target.get("title") or ""
        candidate_title = candidate.get("title") or ""
        title_score = self.calculate_string_similarity(target_title, candidate_title)

        target_artist = target.get("artist") or target.get("uploader") or ""
        candidate_artist = candidate.get("artist") or ""
        artist_score = self.calculate_string_similarity(target_artist, candidate_artist)

        dur_score, dur_penalty = self.score_duration(
            target.get("duration_seconds"),
            candidate.get("duration_seconds"),
        )

        album_score = 0.0
        if target.get("album") and candidate.get("album"):
            album_score = self.calculate_string_similarity(target["album"], candidate["album"])

        year_score = 0.0
        if target.get("release_year") and candidate.get("release_year"):
            if target["release_year"] == candidate["release_year"]:
                year_score = 1.0

        album_year_score = (album_score * 0.7) + (year_score * 0.3)

        composite_score = (
            (title_score * 0.40)
            + (artist_score * 0.35)
            + (dur_score * 0.15)
            + (album_year_score * 0.10)
        ) - dur_penalty

        composite_score = max(0.0, min(1.0, composite_score))

        breakdown = {
            "title_score": title_score,
            "artist_score": artist_score,
            "duration_score": dur_score,
            "duration_penalty": dur_penalty,
            "album_year_score": album_year_score,
        }

        return composite_score, breakdown

    def evaluate(
        self,
        target: dict[str, Any],
        candidates: list[dict[str, Any]],
        fallback_metadata: dict[str, Any],
    ) -> MatchResult:
        """
        Evaluates candidate pool and returns best validated MatchResult.
        """
        best_candidate = None
        best_score = 0.0
        best_breakdown = {}

        for cand in candidates:
            score, breakdown = self.score_candidate(target, cand)
            if score > best_score:
                best_score = score
                best_candidate = cand
                best_breakdown = breakdown

        if best_candidate and best_score >= 0.82:
            return MatchResult(
                score=round(best_score, 3),
                confidence="HIGH",
                source="MusicBrainz",
                title=best_candidate["title"],
                artist=best_candidate["artist"],
                album=best_candidate.get("album"),
                album_artist=best_candidate.get("artist"),
                release_year=best_candidate.get("release_year"),
                recording_id=best_candidate.get("recording_id"),
                artist_id=best_candidate.get("artist_id"),
                reason=f"Strong external MusicBrainz match (Score: {best_score:.2f})",
            )

        if best_candidate and best_score >= 0.65:
            # Medium confidence requires both title AND artist similarity >= 0.65
            if best_breakdown.get("title_score", 0) >= 0.65 and best_breakdown.get("artist_score", 0) >= 0.65:
                return MatchResult(
                    score=round(best_score, 3),
                    confidence="MEDIUM",
                    source="MusicBrainz",
                    title=best_candidate["title"],
                    artist=best_candidate["artist"],
                    album=best_candidate.get("album"),
                    album_artist=best_candidate.get("artist"),
                    release_year=best_candidate.get("release_year"),
                    recording_id=best_candidate.get("recording_id"),
                    artist_id=best_candidate.get("artist_id"),
                    reason=f"Moderate external MusicBrainz match (Score: {best_score:.2f})",
                )

        # Fallback to cleaned metadata (YouTube hints / embedded fallback)
        fallback_artist = clean_artist(fallback_metadata.get("artist"), fallback_metadata.get("uploader"))
        fallback_title = clean_title(fallback_metadata.get("title") or "Unknown Title")

        return MatchResult(
            score=round(best_score, 3),
            confidence="LOW",
            source="YouTube Fallback",
            title=fallback_title,
            artist=fallback_artist or "Unknown Artist",
            album=fallback_metadata.get("album"),
            album_artist=fallback_artist,
            genre=fallback_metadata.get("genre"),
            track_number=fallback_metadata.get("track_number"),
            release_year=fallback_metadata.get("release_year"),
            reason="No high-confidence external match found; safe fallback to normalized metadata",
        )
