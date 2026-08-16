import re
import unicodedata

# Common YouTube title noise expressions
YOUTUBE_NOISE_PATTERNS = [
    # Bracketed / Parenthetical tags
    r"[\(\[\{]\s*(?:official\s*(?:music\s*)?(?:video|audio|lyric\s*video|lyrics|visualizer|single|release|clip|stream|hd|4k)?|lyric\s*video|lyrics|visualizer|hd|4k|4k\s*hd|audio)\s*[\)\]\}]",
    r"[\(\[\{]\s*(?:remastered|remaster|live|acoustic|radio\s*edit|live\s*session)\s*[\)\]\}]",
    # Pipe, slash, or hyphen trailing noise tags
    r"\s*[\|/\-—–]\s*(?:official\s*(?:music\s*)?(?:video|audio|lyric\s*video|lyrics|visualizer)|lyric\s*video|official\s*audio|visualizer)\s*$",
    # Standalone noise words at end of string
    r"\b(?:official\s*music\s*video|official\s*video|official\s*audio|lyric\s*video|lyrics\s*video|visualizer|official\s*single)\b",
]

COMPILED_NOISE_REGEX = [re.compile(p, re.IGNORECASE) for p in YOUTUBE_NOISE_PATTERNS]

KNOWN_LABEL_OR_CHANNEL_NOISE = [
    r"-\s*Topic$",
    r"VEVO$",
    r"\s*Official\s*Channel$",
    r"\s*Official$",
    r"\s*Records$",
    r"\s*Recordings$",
    r"\s*Music$",
    r"\s*Entertainment$",
    r"^CapturedTracks$",
    r"^SubPop$",
    r"^AtlanticRecords$",
    r"^SonyMusic$",
]
COMPILED_ARTIST_NOISE = [re.compile(p, re.IGNORECASE) for p in KNOWN_LABEL_OR_CHANNEL_NOISE]


def normalize_string(text: str | None) -> str:
    """
    Normalizes string for comparison:
    - Lowercases
    - Strips diacritics / accents
    - Removes non-alphanumeric chars
    - Collapses extra spaces
    """
    if not text:
        return ""

    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(c for c in normalized if not unicodedata.combining(c))
    ascii_text = ascii_text.lower()
    clean = re.sub(r"[^\w\s]", "", ascii_text)
    return re.sub(r"\s+", " ", clean).strip()


def fix_title_casing(text: str) -> str:
    """Converts ALL CAPS or all lower strings into clean Title Case."""
    if not text:
        return ""
    stripped = text.strip()
    if stripped.isupper() or stripped.islower():
        # Title case while keeping short words lowercase except first word
        words = stripped.split()
        title_words = []
        short_words = {"a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "so", "the", "to", "up", "yet"}
        for i, word in enumerate(words):
            word_lower = word.lower()
            if i > 0 and word_lower in short_words:
                title_words.append(word_lower)
            else:
                title_words.append(word.capitalize())
        return " ".join(title_words)
    return stripped


def clean_title(title: str | None) -> str:
    """Strips YouTube metadata noise from titles while preserving song semantics."""
    if not title:
        return ""

    result = title.strip()

    for regex in COMPILED_NOISE_REGEX:
        result = regex.sub("", result)

    # Strip surrounding quotes, slashes, pipes, dashes, and whitespace
    result = re.sub(r"^[\"\'\s/\\|—–-]+|[\"\'\s/\\|—–-]+$", "", result).strip()
    result = re.sub(r"\s+", " ", result).strip()

    return fix_title_casing(result) if result else title.strip()


def is_known_record_label_or_channel(name: str | None) -> bool:
    """Returns True if candidate name is a record label or generic channel (e.g. CapturedTracks, VEVO, - Topic)."""
    if not name or not name.strip():
        return True
    cleaned = name.strip()
    for regex in COMPILED_ARTIST_NOISE:
        if regex.search(cleaned):
            return True
    return False


def clean_artist(artist_hint: str | None, uploader_name: str | None = None) -> str | None:
    """
    Cleans artist string or fallback uploader name.
    Ignores generic record labels or topic channels.
    """
    candidate = artist_hint if artist_hint and artist_hint.strip() else None

    # Only fallback to uploader_name if candidate is empty AND uploader is not a record label/topic channel
    if not candidate and uploader_name and uploader_name.strip():
        if not is_known_record_label_or_channel(uploader_name):
            candidate = uploader_name

    if not candidate or not candidate.strip():
        return None

    cleaned = candidate.strip()
    for regex in COMPILED_ARTIST_NOISE:
        cleaned = regex.sub("", cleaned)

    cleaned = cleaned.strip(" -_")
    return fix_title_casing(cleaned) if cleaned else None


def parse_youtube_title(raw_title: str | None) -> tuple[str | None, str]:
    """
    Extracts (artist_hint, title_clean) from YouTube title.
    Supports patterns:
    - Artist // "Song" / Artist // Song
    - Artist - Song / Artist – Song / Artist — Song
    - Artist | Song
    - Artist: Song
    - "Song" by Artist
    """
    if not raw_title:
        return None, ""

    cleaned = clean_title(raw_title)

    # 1. Pattern: "Song Title" by Artist Name
    by_match = re.match(r"^[\"\'](.+?)[\"\']\s+by\s+(.+)$", cleaned, re.IGNORECASE)
    if by_match:
        song_part = clean_title(by_match.group(1))
        artist_part = clean_artist(by_match.group(2))
        if artist_part and song_part:
            return artist_part, song_part

    # 2. Separators: //, —, –, -, |, :
    separators = [r"\s*//\s*", r"\s*—\s*", r"\s*–\s*", r"\s*-\s*", r"\s*\|\s*", r"\s*:\s*"]
    for sep_regex in separators:
        parts = re.split(sep_regex, cleaned, maxsplit=1)
        if len(parts) == 2:
            potential_artist = clean_artist(parts[0])
            potential_title = clean_title(parts[1])
            if potential_artist and potential_title:
                return potential_artist, potential_title

    return None, cleaned
