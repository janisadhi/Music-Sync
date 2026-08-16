from metadata_service.normalizer import (
    clean_title,
    clean_artist,
    parse_youtube_title,
    normalize_string,
    is_known_record_label_or_channel,
)


def test_youtube_channel_does_not_override_artist_from_title():
    # 1. YouTube channel CapturedTracks should be recognized as a label/channel
    assert is_known_record_label_or_channel("CapturedTracks") is True

    # 2. Extract artist from "Mac DeMarco // \"My Kind Of Woman\""
    artist, title = parse_youtube_title("Mac DeMarco // \"My Kind Of Woman\"")
    assert artist == "Mac DeMarco"
    assert title == "My Kind Of Woman"

    # 3. Clean artist should ignore CapturedTracks as fallback uploader
    cleaned = clean_artist(artist_hint=artist, uploader_name="CapturedTracks")
    assert cleaned == "Mac DeMarco"


def test_artist_title_extraction_slash_slash():
    artist, title = parse_youtube_title("Mac DeMarco // \"My Kind Of Woman\"")
    assert artist == "Mac DeMarco"
    assert title == "My Kind Of Woman"

    artist2, title2 = parse_youtube_title("Mac DeMarco // On the Level (Official Audio)")
    assert artist2 == "Mac DeMarco"
    assert title2 == "On the Level"


def test_artist_title_extraction_hyphen_dash_emdash():
    artist1, title1 = parse_youtube_title("The Garden - Thy Mission")
    assert artist1 == "The Garden"
    assert title1 == "Thy Mission"

    artist2, title2 = parse_youtube_title("MAC DEMARCO - ON THE SQUARE")
    assert artist2 == "Mac Demarco"
    assert title2 == "on the Square"

    artist3, title3 = parse_youtube_title("Artist Name — Song Title")
    assert artist3 == "Artist Name"
    assert title3 == "Song Title"


def test_official_audio_removal():
    assert clean_title("Song Name (Official Audio)") == "Song Name"
    assert clean_title("Song Name [Official Audio]") == "Song Name"


def test_official_video_removal():
    assert clean_title("Song Name (Official Video)") == "Song Name"
    assert clean_title("Song Name [Official Music Video]") == "Song Name"


def test_punctuation_and_casing_normalization():
    assert normalize_string("Café - Daft Punk! (2013)") == "cafe daft punk 2013"
    assert clean_title("MAC DEMARCO - ON THE SQUARE") == "Mac Demarco - on the Square"
