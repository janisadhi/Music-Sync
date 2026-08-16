/**
 * Utility to extract dominant and accent colors from an image URL
 * for dynamic Liquid Glass background generation.
 */

const FALLBACK_PALETTE = {
    dominant: "rgb(30, 41, 59)",
    secondary: "rgb(15, 23, 42)",
    accent: "rgb(59, 130, 246)",
    dark: "rgba(15, 23, 42, 0.92)",
    glow: "rgba(59, 130, 246, 0.35)",
};

const paletteCache = new Map();

export async function extractColorsFromImage(imageUrl) {
    if (!imageUrl) return FALLBACK_PALETTE;

    if (paletteCache.has(imageUrl)) {
        return paletteCache.get(imageUrl);
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;

        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = 32;
                canvas.height = 32;

                ctx.drawImage(img, 0, 0, 32, 32);
                const imageData = ctx.getImageData(0, 0, 32, 32);
                const pixels = imageData.data;

                let rSum = 0, gSum = 0, bSum = 0, count = 0;
                let maxSat = -1;
                let vibrantR = 59, vibrantG = 130, vibrantB = 246;

                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i];
                    const g = pixels[i + 1];
                    const b = pixels[i + 2];
                    const a = pixels[i + 3];

                    if (a < 128) continue; // Skip transparent

                    rSum += r;
                    gSum += g;
                    bSum += b;
                    count++;

                    // Calculate saturation to find vibrant accent color
                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    const sat = max === 0 ? 0 : (max - min) / max;

                    if (sat > maxSat && max > 50) {
                        maxSat = sat;
                        vibrantR = r;
                        vibrantG = g;
                        vibrantB = b;
                    }
                }

                if (count === 0) {
                    resolve(FALLBACK_PALETTE);
                    return;
                }

                const domR = Math.round(rSum / count);
                const domG = Math.round(gSum / count);
                const domB = Math.round(bSum / count);

                const palette = {
                    dominant: `rgb(${domR}, ${domG}, ${domB})`,
                    secondary: `rgb(${Math.max(0, domR - 40)}, ${Math.max(0, domG - 40)}, ${Math.max(0, domB - 40)})`,
                    accent: `rgb(${vibrantR}, ${vibrantG}, ${vibrantB})`,
                    dark: `rgba(${Math.round(domR * 0.2)}, ${Math.round(domG * 0.2)}, ${Math.round(domB * 0.2)}, 0.92)`,
                    glow: `rgba(${vibrantR}, ${vibrantG}, ${vibrantB}, 0.35)`,
                };

                paletteCache.set(imageUrl, palette);
                resolve(palette);
            } catch {
                resolve(FALLBACK_PALETTE);
            }
        };

        img.onerror = () => {
            resolve(FALLBACK_PALETTE);
        };
    });
}
