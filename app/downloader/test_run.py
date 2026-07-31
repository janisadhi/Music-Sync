from app.downloader.service import SongDownloader


def main():
    downloader = SongDownloader()
    downloader.download_pending(limit=1)


if __name__ == "__main__":
    main()
