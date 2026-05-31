import { City } from '../types/game.js';

/**
 * City sprite management system for handling city graphics with player-specific recoloring.
 * Creates simple single-block city structures that match the player's color.
 */
export class CitySprites {
    private static spriteCache = new Map<string, HTMLCanvasElement>();

    /**
     * Get a cached city sprite (synchronous)
     */
    public static getCachedSprite(
        playerColor: string,
        tileSize: number,
        population: number = 1,
        hasUnits: boolean = false
    ): HTMLCanvasElement | null {
        const cacheKey = `city-${playerColor}-${tileSize}-${population}-${hasUnits}`;
        return this.spriteCache.get(cacheKey) || null;
    }

    /**
     * Get a city sprite with player-specific coloring
     */
    public static getCitySprite(
        playerColor: string,
        tileSize: number,
        population: number = 1,
        hasUnits: boolean = false
    ): HTMLCanvasElement {
        const cacheKey = `city-${playerColor}-${tileSize}-${population}-${hasUnits}`;

        if (this.spriteCache.has(cacheKey)) {
            return this.spriteCache.get(cacheKey)!;
        }

        // Create new sprite
        const sprite = this.createCitySprite(playerColor, tileSize, population, hasUnits);

        // Cache the result
        this.spriteCache.set(cacheKey, sprite);
        return sprite;
    }

    /**
     * Create a single block city sprite with player color
     */
    private static createCitySprite(
        playerColor: string,
        tileSize: number,
        population: number = 1,
        hasUnits: boolean = false
    ): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        const ctx = canvas.getContext('2d')!;

        // Parse player color
        const color = this.parsePlayerColor(playerColor);
        if (!color) {
            console.warn(`Invalid player color: ${playerColor}`);
            return canvas;
        }
        const blockSize = tileSize;
        const startX = 0;
        const startY = 0;

        this.drawCityBlock(ctx, startX, startY, blockSize, color, population, hasUnits);

        return canvas;
    }

    /**
     * Draw a single city block
     */
    private static drawCityBlock(
        ctx: CanvasRenderingContext2D,
        startX: number,
        startY: number,
        blockSize: number,
        color: { r: number; g: number; b: number },
        population: number = 1,
        hasUnits: boolean = false
    ): void {
        const baseColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
        const highlightColor = `rgb(${Math.min(255, color.r + 30)}, ${Math.min(255, color.g + 30)}, ${Math.min(255, color.b + 30)})`;
        const shadowColor = `rgb(${Math.floor(color.r * 0.7)}, ${Math.floor(color.g * 0.7)}, ${Math.floor(color.b * 0.7)})`;
        const darkShadowColor = `rgb(${Math.floor(color.r * 0.5)}, ${Math.floor(color.g * 0.5)}, ${Math.floor(color.b * 0.5)})`;

        ctx.fillStyle = baseColor;
        ctx.fillRect(startX, startY, blockSize, blockSize);

        // Add 3D effect with highlights and shadows
        const borderSize = Math.max(1, Math.floor(blockSize * 0.1));

        // Top and left highlights
        ctx.fillStyle = highlightColor;
        ctx.fillRect(startX, startY, blockSize, borderSize); // Top
        ctx.fillRect(startX, startY, borderSize, blockSize); // Left

        // Bottom and right shadows
        ctx.fillStyle = shadowColor;
        ctx.fillRect(startX, startY + blockSize - borderSize, blockSize, borderSize); // Bottom
        ctx.fillRect(startX + blockSize - borderSize, startY, borderSize, blockSize); // Right

        // Add random vertical and horizontal road lines
        const roadColor = darkShadowColor;
        const roadWidth = Math.max(1, Math.floor(blockSize * 0.03));

        ctx.fillStyle = roadColor;

        // Use population as seed for consistent randomness
        const seed = population * 137; // Prime number for better distribution

        // Random vertical lines - more equidistant spacing
        const numVerticalLines = 5;
        const verticalSpacing = blockSize / (numVerticalLines + 1); // Even spacing
        for (let i = 0; i < numVerticalLines; i++) {
            const baseX = startX + verticalSpacing * (i + 1);
            const xVariation = ((seed + i * 47) % 20) - 10; // Small random offset ±10
            const x = baseX + xVariation;
            const startOffset = (seed + i * 23) % (blockSize * 0.25);
            const endOffset = (seed + i * 67) % (blockSize * 0.25);
            const lineStart = startY + startOffset;
            const lineEnd = startY + blockSize - endOffset;

            ctx.fillRect(Math.floor(x), Math.floor(lineStart), roadWidth, Math.floor(lineEnd - lineStart));
        }

        // Random horizontal lines - more equidistant spacing
        const numHorizontalLines = 5;
        const horizontalSpacing = blockSize / (numHorizontalLines + 1);
        for (let i = 0; i < numHorizontalLines; i++) {
            const baseY = startY + horizontalSpacing * (i + 1);
            const yVariation = ((seed + i * 89) % 20) - 10;
            const y = baseY + yVariation;
            const startOffset = (seed + i * 31) % (blockSize * 0.25);
            const endOffset = (seed + i * 73) % (blockSize * 0.25);
            const lineStart = startX + startOffset;
            const lineEnd = startX + blockSize - endOffset;

            ctx.fillRect(Math.floor(lineStart), Math.floor(y), Math.floor(lineEnd - lineStart), roadWidth);
        }

        // Add prominent black border - thickness based on whether city has units
        ctx.strokeStyle = 'black';
        ctx.lineWidth = hasUnits ? 6 : 2; // Thick border (6px) if units, thin border (2px) if no units
        ctx.strokeRect(startX, startY, blockSize, blockSize);

        // Draw population number in the center
        const centerX = startX + blockSize / 2;
        const centerY = startY + blockSize / 2;

        // Calculate font size based on tile size (large and prominent)
        const fontSize = Math.max(12, Math.floor(blockSize * 0.5));
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Add text shadow for better readability
        ctx.fillStyle = 'white';
        ctx.fillText(population.toString(), centerX + 1, centerY + 1);

        // Draw main text in white
        ctx.fillStyle = 'black';
        ctx.fillText(population.toString(), centerX, centerY);
    }

    /**
     * Parse player color string to RGB
     */
    private static parsePlayerColor(colorStr: string): { r: number; g: number; b: number } | null {
        // Handle hex colors
        if (colorStr.startsWith('#')) {
            const hex = colorStr.slice(1);
            if (hex.length === 6) {
                return {
                    r: parseInt(hex.substr(0, 2), 16),
                    g: parseInt(hex.substr(2, 2), 16),
                    b: parseInt(hex.substr(4, 2), 16)
                };
            }
        }

        // Handle named colors (basic set)
        const namedColors: { [key: string]: { r: number; g: number; b: number } } = {
            'red': { r: 255, g: 0, b: 0 },
            'blue': { r: 0, g: 0, b: 255 },
            'green': { r: 0, g: 255, b: 0 },
            'yellow': { r: 255, g: 255, b: 0 },
            'purple': { r: 128, g: 0, b: 128 },
            'orange': { r: 255, g: 165, b: 0 },
            'cyan': { r: 0, g: 255, b: 255 },
            'pink': { r: 255, g: 192, b: 203 }
        };

        return namedColors[colorStr.toLowerCase()] || null;
    }

    /**
     * Clear sprite cache (useful for memory management or when tile size changes)
     */
    public static clearCache(): void {
        this.spriteCache.clear();
    }

    /**
     * Preload city sprites for all player colors
     */
    public static async preloadSprites(
        playerColors: string[],
        tileSize: number
    ): Promise<void> {
        for (const color of playerColors) {
            // Preload both variants: with and without units
            this.getCitySprite(color, tileSize, 1, false); // No units
            this.getCitySprite(color, tileSize, 1, true);  // With units
        }
        console.log(`Preloaded ${playerColors.length * 2} city sprites (with and without units)`);
    }
}
