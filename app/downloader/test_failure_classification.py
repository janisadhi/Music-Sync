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

    # ---------------------------------------------------------
    # TEST 5: HTTP 403 and Network Unreachable (Retryable)
    # ---------------------------------------------------------
    error_403 = yt_dlp.utils.DownloadError("ERROR: unable to download video data: HTTP Error 403: Forbidden")
    assert downloader._is_retryable_error(error_403) is True

    error_net = yt_dlp.utils.DownloadError("[download] Got error: [Errno 101] Network is unreachable")
    assert downloader._is_retryable_error(error_net) is True
    print("PASS: HTTP 403 and Network Unreachable errors are retryable.")

    # ---------------------------------------------------------
    # TEST 6: Missing Executables & Permanent Failures (Unretryable)
    # ---------------------------------------------------------
    error_ffmpeg = yt_dlp.utils.PostProcessingError("ffmpeg not found. Please install ffmpeg.")
    assert downloader._is_retryable_error(error_ffmpeg) is False

    error_unavail = yt_dlp.utils.DownloadError("ERROR: [youtube] Video unavailable")
    assert downloader._is_retryable_error(error_unavail) is False
    print("PASS: Missing binaries and video unavailable are permanent/unretryable.")

    print()
    print("=" * 60)
    print("ALL FAILURE CLASSIFICATION TESTS PASSED")
    print("NO YOUTUBE DOWNLOAD WAS PERFORMED")
    print("=" * 60)


if __name__ == "__main__":
    main()
