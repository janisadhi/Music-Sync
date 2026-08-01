export function parseLRC(lrcText) {
    if (!lrcText) {
        return [];
    }

    const lines = lrcText.split("\n");

    const lyrics = [];

    for (const line of lines) {
        const match = line.match(
            /^\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)$/
        );

        if (!match) {
            continue;
        }

        const minutes = Number(match[1]);
        const seconds = Number(match[2]);
        const text = match[3].trim();

        const time = minutes * 60 + seconds;

        lyrics.push({
            time,
            text,
        });
    }

    return lyrics.sort(
        (a, b) => a.time - b.time
    );
}
