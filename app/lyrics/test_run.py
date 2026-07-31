from app.lyrics.service import LyricsService


def main():
    service = LyricsService()
    service.process_pending(limit=10)


if __name__ == "__main__":
    main()
