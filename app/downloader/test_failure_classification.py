import yt_dlp

from app.downloader.service import SongDownloader


def main():
    downloader = SongDownloader()

    print("=" * 60)
    print("DOWNLOAD FAILURE CLASSIFICATION TEST")
    print("=" * 60)

    # ---------------------------------------------------------
    # TEST 1: yt-dlp DownloadError
    # ---------------------------------------------------------
    error = yt_dlp.utils.DownloadError(
        "Controlled YouTube download failure"
    )

    result = downloader._is_retryable_error(error)

    assert result is True

    print(
        "PASS: DownloadError is retryable."
    )

    # ---------------------------------------------------------
    # TEST 2: yt-dlp PostProcessingError
    # ---------------------------------------------------------
    error = yt_dlp.utils.PostProcessingError(
        "Controlled FFmpeg failure"
    )

    result = downloader._is_retryable_error(error)

    assert result is True

    print(
        "PASS: PostProcessingError is retryable."
    )

    # ---------------------------------------------------------
    # TEST 3: OSError
    # ---------------------------------------------------------
    error = OSError(
        "Controlled filesystem failure"
    )

    result = downloader._is_retryable_error(error)

    assert result is True

    print(
        "PASS: OSError is retryable."
    )

    # ---------------------------------------------------------
    # TEST 4: ValueError
    # ---------------------------------------------------------
    error = ValueError(
        "Controlled application error"
    )

    result = downloader._is_retryable_error(error)

    assert result is False

    print(
        "PASS: ValueError is not retryable."
    )

    print()
    print("=" * 60)
    print("ALL FAILURE CLASSIFICATION TESTS PASSED")
    print("NO YOUTUBE DOWNLOAD WAS PERFORMED")
    print("=" * 60)


if __name__ == "__main__":
    main()
