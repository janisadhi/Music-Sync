import logging
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("metadata_service.release_selector")


@dataclass
class ReleaseCandidate:
    release_id: str | None = None
    release_group_id: str | None = None
    album_title: str = ""
    artist: str | None = None
    primary_type: str | None = None          # "Album", "Single", "EP", etc.
    secondary_types: list[str] = field(default_factory=list)  # ["Live"], ["Compilation"], etc.
    status: str | None = None                 # "Official", "Bootleg", "Promotion", etc.
    release_date: str | None = None
    release_year: int | None = None
    country: str | None = None
    track_number: int | None = None
    score: float = 0.0
    score_reasons: list[str] = field(default_factory=list)


@dataclass
class ReleaseSelectionResult:
    selected_candidate: ReleaseCandidate | None = None
    all_candidates: list[ReleaseCandidate] = field(default_factory=list)
    album: str | None = None
    release_year: int | None = None
    musicbrainz_release_id: str | None = None
    musicbrainz_release_group_id: str | None = None
    debug_log: list[str] = field(default_factory=list)


class ReleaseSelector:
    """Intelligent release group & release scoring engine.
    Separates recording identification from canonical studio album release selection.
    """

    # String patterns for secondary penalization when MusicBrainz release-group type tags are incomplete
    LIVE_PATTERNS = re.compile(
        r"\b(live|concert|session|radio|broadcast|unplugged|in\s+chicago|at\s+|bbc|bootleg)\b",
        re.IGNORECASE,
    )
    COMPILATION_PATTERNS = re.compile(
        r"\b(compilation|greatest\s+hits|best\s+of|anthology|collection|essential|ultimate|total\s+rock)\b",
        re.IGNORECASE,
    )

    @classmethod
    def score_candidate(
        self,
        candidate: ReleaseCandidate,
        identified_artist: str | None = None,
        target_album_context: str | None = None,
    ) -> float:
        """Calculates explicit suitability score for a release candidate."""
        score = 50.0
        reasons: list[str] = ["Base score: 50.0"]

        primary = (candidate.primary_type or "").lower()
        secondary = [s.lower() for s in (candidate.secondary_types or [])]
        status = (candidate.status or "").lower()
        album_title = candidate.album_title or ""

        # 1. PRIMARY TYPE SCORING
        if primary == "album":
            score += 25.0
            reasons.append("+25.0: Primary type is Album")
        elif primary == "ep":
            score += 10.0
            reasons.append("+10.0: Primary type is EP")
        elif primary == "single":
            score += 0.0
            reasons.append("+0.0: Primary type is Single")
        else:
            score -= 10.0
            reasons.append("-10.0: Non-standard primary type")

        # 2. SECONDARY TYPES PENALIZATION (MusicBrainz structured type metadata)
        if "live" in secondary:
            score -= 40.0
            reasons.append("-40.0: Secondary type includes Live")
        if "compilation" in secondary:
            score -= 35.0
            reasons.append("-35.0: Secondary type includes Compilation")
        if "bootleg" in secondary or status == "bootleg":
            score -= 50.0
            reasons.append("-50.0: Bootleg status/type")
        if "soundtrack" in secondary:
            score -= 25.0
            reasons.append("-25.0: Secondary type includes Soundtrack")
        if "remix" in secondary:
            score -= 20.0
            reasons.append("-20.0: Secondary type includes Remix")
        if "dj-mix" in secondary:
            score -= 30.0
            reasons.append("-30.0: Secondary type includes DJ-mix")
        if "demo" in secondary:
            score -= 35.0
            reasons.append("-35.0: Secondary type includes Demo")
        if "interview" in secondary or "spokenword" in secondary:
            score -= 50.0
            reasons.append("-50.0: Interview/Spokenword release")
        if "broadcast" in secondary:
            score -= 40.0
            reasons.append("-40.0: Broadcast/Radio release")

        # 3. TITLE STRING HEURISTICS (Fallback penalty for live/compilation titles)
        if self.LIVE_PATTERNS.search(album_title):
            score -= 30.0
            reasons.append("-30.0: Title contains live/session/concert keywords")
        if self.COMPILATION_PATTERNS.search(album_title):
            score -= 25.0
            reasons.append("-25.0: Title contains compilation/greatest hits keywords")

        # 4. RELEASE STATUS
        if status == "official":
            score += 15.0
            reasons.append("+15.0: Official release status")
        elif status == "promotion":
            score -= 20.0
            reasons.append("-20.0: Promotional release status")
        elif status == "pseudo-release":
            score -= 30.0
            reasons.append("-30.0: Pseudo-release status")

        # 5. CONTEXTUAL ALBUM MATCH (YouTube album hint or embedded ID3 tag signal)
        if target_album_context and album_title:
            from metadata_service.matcher import CandidateMatcher
            sim = CandidateMatcher.calculate_string_similarity(target_album_context, album_title)
            if sim >= 0.8:
                score += 40.0
                reasons.append(f"+40.0: Strong match with target album context '{target_album_context}' (sim={sim:.2f})")
            elif sim < 0.4 and not self.COMPILATION_PATTERNS.search(target_album_context):
                score -= 15.0
                reasons.append(f"-15.0: Mismatch with target album context '{target_album_context}' (sim={sim:.2f})")

        # 6. ARTIST MATCH
        if identified_artist and candidate.artist:
            from metadata_service.matcher import CandidateMatcher
            art_sim = CandidateMatcher.calculate_string_similarity(identified_artist, candidate.artist)
            if art_sim >= 0.8:
                score += 10.0
                reasons.append(f"+10.0: Artist matches identified artist '{identified_artist}'")

        # 7. ORIGINALITY / RELEASE YEAR BONUS (Prefer earlier release date for original studio album)
        if candidate.release_year and 1900 <= candidate.release_year <= 2030:
            year_bonus = (2030 - candidate.release_year) * 0.1
            score += year_bonus
            reasons.append(f"+{year_bonus:.1f}: Originality bonus for release year {candidate.release_year}")

        candidate.score = round(score, 2)
        candidate.score_reasons = reasons
        return candidate.score

    def select_best_release(
        self,
        candidates: list[ReleaseCandidate],
        identified_artist: str | None = None,
        target_album_context: str | None = None,
    ) -> ReleaseSelectionResult:
        """Scores candidate releases and returns best validated canonical release."""
        result = ReleaseSelectionResult()

        if not candidates:
            result.debug_log.append("[release_selector] No candidate releases provided for scoring.")
            return result

        result.debug_log.append(f"[release_selector] Evaluating {len(candidates)} candidate releases...")
        if target_album_context:
            result.debug_log.append(f"[release_selector] Context album hint: '{target_album_context}'")

        scored_candidates: list[ReleaseCandidate] = []
        for cand in candidates:
            self.score_candidate(
                candidate=cand,
                identified_artist=identified_artist,
                target_album_context=target_album_context,
            )
            scored_candidates.append(cand)

        # Sort descending by score
        scored_candidates.sort(key=lambda c: c.score, reverse=True)
        result.all_candidates = scored_candidates

        # Log detailed candidates breakdown
        for idx, cand in enumerate(scored_candidates[:5], 1):
            log_msg = (
                f"[release_selector] Candidate #{idx}: '{cand.album_title}' | Score: {cand.score:.1f} | "
                f"Type: {cand.primary_type} | Secondary: {cand.secondary_types} | Status: {cand.status} | Year: {cand.release_year}"
            )
            result.debug_log.append(log_msg)

        best = scored_candidates[0]
        result.selected_candidate = best
        result.album = best.album_title
        result.release_year = best.release_year
        result.musicbrainz_release_id = best.release_id
        result.musicbrainz_release_group_id = best.release_group_id

        result.debug_log.append(
            f"[release_selector] Selected canonical release: '{best.album_title}' (Score: {best.score:.1f}) "
            f"Reasons: {'; '.join(best.score_reasons)}"
        )

        logger.info(
            f"ReleaseSelector selected '{best.album_title}' (Score: {best.score:.1f}) "
            f"over {len(candidates) - 1} other releases."
        )

        return result
