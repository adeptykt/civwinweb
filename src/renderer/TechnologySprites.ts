import { TechnologyType } from '../game/TechnologyDefinitions.js';

/**
 * Interface for defining sprite positions in the tech-icons.png sprite sheet
 */
interface SpritePosition {
    x: number;      // X position in the sprite sheet (in pixels or grid units)
    y: number;      // Y position in the sprite sheet (in pixels or grid units)
    width: number;  // Width of the sprite (default: use standard size)
    height: number; // Height of the sprite (default: use standard size)
}

const WIDTH = 110;
const HEIGHT = 70;

/**
 * Technology sprite management system for handling technology icons from sprite sheet.
 * Extracts individual technology icons from the tech-icons.png sprite sheet.
 */
export class TechnologySprites {
    private static spriteCache = new Map<string, HTMLCanvasElement>();
    private static baseImage: HTMLImageElement | null = null;
    private static imageLoadPromise: Promise<HTMLImageElement> | null = null;

    /**
     * Mapping of technologies to their positions in the tech-icons.png sprite sheet
     * Grid layout: 10 columns × 6 rows
     * Each sprite is 110×70 pixels
     * Based on authentic Civilization 1 technology tree
     */
    private static readonly SPRITE_POSITIONS: Record<TechnologyType, SpritePosition> = {
        // Row 0 - Starting Technologies
        [TechnologyType.POTTERY]: { x: 4, y: 5, width: WIDTH, height: HEIGHT },
        [TechnologyType.ALPHABET]: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
        [TechnologyType.CEREMONIAL_BURIAL]: { x: 8, y: 0, width: WIDTH, height: HEIGHT },
        [TechnologyType.BRONZE_WORKING]: { x: 7, y: 0, width: WIDTH, height: HEIGHT },
        [TechnologyType.MASONRY]: { x: 0, y: 4, width: WIDTH, height: HEIGHT },
        [TechnologyType.HORSEBACK_RIDING]: { x: 1, y: 3, width: WIDTH, height: HEIGHT },
        [TechnologyType.THE_WHEEL]: { x: 8, y: 6, width: WIDTH, height: HEIGHT },
        [TechnologyType.MYSTICISM]: { x: 6, y: 4, width: WIDTH, height: HEIGHT },

        // Row 1 - Early Technologies
        [TechnologyType.CURRENCY]: { x: 8, y: 1, width: WIDTH, height: HEIGHT },
        [TechnologyType.IRON_WORKING]: { x: 4, y: 3, width: WIDTH, height: HEIGHT },
        [TechnologyType.MAPMAKING]: { x: 8, y: 3, width: WIDTH, height: HEIGHT },
        [TechnologyType.MATHEMATICS]: { x: 2, y: 4, width: WIDTH, height: HEIGHT },
        [TechnologyType.WRITING]: { x: 3, y: 7, width: WIDTH, height: HEIGHT },
        [TechnologyType.CODE_OF_LAWS]: { x: 2, y: 1, width: WIDTH, height: HEIGHT },
        [TechnologyType.MONARCHY]: { x: 5, y: 4, width: WIDTH, height: HEIGHT },
        [TechnologyType.TRADE]: { x: 1, y: 7, width: WIDTH, height: HEIGHT },
        [TechnologyType.CONSTRUCTION]: { x: 7, y: 1, width: WIDTH, height: HEIGHT },

        // Row 2 - Middle Technologies
        [TechnologyType.LITERACY]: { x: 6, y: 3, width: WIDTH, height: HEIGHT },
        [TechnologyType.THE_REPUBLIC]: { x: 7, y: 6, width: WIDTH, height: HEIGHT },
        [TechnologyType.FEUDALISM]: { x: 5, y: 2, width: WIDTH, height: HEIGHT },
        [TechnologyType.CHIVALRY]: { x: 1, y: 1, width: WIDTH, height: HEIGHT },
        [TechnologyType.BRIDGE_BUILDING]: { x: 6, y: 0, width: WIDTH, height: HEIGHT },
        [TechnologyType.ENGINEERING]: { x: 3, y: 2, width: WIDTH, height: HEIGHT },
        [TechnologyType.ASTRONOMY]: { x: 1, y: 0, width: WIDTH, height: HEIGHT },
        [TechnologyType.NAVIGATION]: { x: 7, y: 4, width: WIDTH, height: HEIGHT },
        [TechnologyType.BANKING]: { x: 5, y: 0, width: WIDTH, height: HEIGHT },
        [TechnologyType.INVENTION]: { x: 3, y: 3, width: WIDTH, height: HEIGHT },

        // Row 3 - Advanced Technologies
        [TechnologyType.PHILOSOPHY]: { x: 1, y: 5, width: WIDTH, height: HEIGHT },
        [TechnologyType.DEMOCRACY]: { x: 0, y: 2, width: WIDTH, height: HEIGHT },
        [TechnologyType.UNIVERSITY]: { x: 2, y: 7, width: WIDTH, height: HEIGHT },
        [TechnologyType.PHYSICS]: { x: 2, y: 5, width: WIDTH, height: HEIGHT },
        [TechnologyType.GUNPOWDER]: { x: 0, y: 3, width: WIDTH, height: HEIGHT },
        [TechnologyType.MEDICINE]: { x: 3, y: 4, width: WIDTH, height: HEIGHT },
        [TechnologyType.METALLURGY]: { x: 4, y: 3, width: WIDTH, height: HEIGHT },
        [TechnologyType.CHEMISTRY]: { x: 0, y: 1, width: WIDTH, height: HEIGHT },
        [TechnologyType.THEORY_OF_GRAVITY]: { x: 0, y: 7, width: WIDTH, height: HEIGHT },
        [TechnologyType.RELIGION]: { x: 8, y: 5, width: WIDTH, height: HEIGHT },

        // Row 4 - Industrial Technologies
        [TechnologyType.STEAM_ENGINE]: { x: 3, y: 6, width: WIDTH, height: HEIGHT },
        [TechnologyType.MAGNETISM]: { x: 7, y: 3, width: WIDTH, height: HEIGHT },
        [TechnologyType.EXPLOSIVES]: { x: 4, y: 3, width: WIDTH, height: HEIGHT },
        [TechnologyType.RAILROAD]: { x: 5, y: 5, width: WIDTH, height: HEIGHT },
        [TechnologyType.ELECTRICITY]: { x: 1, y: 2, width: WIDTH, height: HEIGHT },
        [TechnologyType.STEEL]: { x: 4, y: 6, width: WIDTH, height: HEIGHT },
        [TechnologyType.INDUSTRIALIZATION]: { x: 2, y: 3, width: WIDTH, height: HEIGHT },
        [TechnologyType.CONSCRIPTION]: { x: 6, y: 1, width: WIDTH, height: HEIGHT },
        [TechnologyType.THE_CORPORATION]: { x:  6, y: 6, width: WIDTH, height: HEIGHT },
        [TechnologyType.REFINING]: { x: 7, y: 5, width: WIDTH, height: HEIGHT },

        // Row 5 - Modern Technologies
        [TechnologyType.COMBUSTION]: { x: 3, y: 1, width: WIDTH, height: HEIGHT },
        [TechnologyType.ELECTRONICS]: { x: 2, y: 2, width: WIDTH, height: HEIGHT },
        [TechnologyType.AUTOMOBILE]: { x: 4, y: 0, width: WIDTH, height: HEIGHT },
        [TechnologyType.FLIGHT]: { x: 6, y: 2, width: WIDTH, height: HEIGHT },
        [TechnologyType.ADVANCED_FLIGHT]: { x: 2, y: 0, width: WIDTH, height: HEIGHT },
        [TechnologyType.ATOMIC_THEORY]: { x: 3, y: 0, width: WIDTH, height: HEIGHT },
        [TechnologyType.MASS_PRODUCTION]: { x: 1, y: 4, width: WIDTH, height: HEIGHT },
        [TechnologyType.NUCLEAR_FISSION]: { x: 8, y: 4, width: WIDTH, height: HEIGHT },
        [TechnologyType.NUCLEAR_POWER]: { x: 0, y: 5, width: WIDTH, height: HEIGHT },
        [TechnologyType.ROCKETRY]: { x: 1, y: 6, width: WIDTH, height: HEIGHT },

        // Row 6 - Advanced Modern Technologies
        [TechnologyType.COMPUTERS]: { x: 5, y: 1, width: WIDTH, height: HEIGHT },
        [TechnologyType.SPACE_FLIGHT]: { x: 2, y: 6, width: WIDTH, height: HEIGHT },
        [TechnologyType.PLASTICS]: { x: 3, y: 5, width: WIDTH, height: HEIGHT },
        [TechnologyType.COMMUNISM]: { x: 4, y: 1, width: WIDTH, height: HEIGHT },
        [TechnologyType.LABOR_UNION]: { x: 5, y: 3, width: WIDTH, height: HEIGHT },
        [TechnologyType.RECYCLING]: { x: 6, y: 5, width: WIDTH, height: HEIGHT },
        [TechnologyType.ROBOTICS]: { x: 0, y: 6, width: WIDTH, height: HEIGHT },
        [TechnologyType.SUPERCONDUCTOR]: { x: 5, y: 6, width: WIDTH, height: HEIGHT },
        [TechnologyType.GENETIC_ENGINEERING]: { x: 8, y: 2, width: WIDTH, height: HEIGHT },
        [TechnologyType.FUSION_POWER]: { x: 0, y: 5, width: WIDTH, height: HEIGHT },
        [TechnologyType.FUTURE_TECH]: { x: 5, y: 1, width: WIDTH, height: HEIGHT },
    };

    /**
     * Get a cached technology sprite (synchronous)
     */
    public static getCachedSprite(
        technologyType: TechnologyType,
        size: number = 48
    ): HTMLCanvasElement | null {
        const cacheKey = `${technologyType}-${size}`;
        return this.spriteCache.get(cacheKey) || null;
    }

    /**
     * Get a technology sprite from the sprite sheet
     */
    public static async getTechnologySprite(
        technologyType: TechnologyType,
        size: number = 48
    ): Promise<HTMLCanvasElement | null> {
        const cacheKey = `${technologyType}-${size}`;

        // Check cache first
        if (this.spriteCache.has(cacheKey)) {
            return this.spriteCache.get(cacheKey)!;
        }

        try {
            // Load base image if not already loaded
            const baseImage = await this.loadBaseImage();
            if (!baseImage) {
                console.error('Failed to load tech-icons.png');
                return null;
            }

            // Get sprite position
            const position = this.SPRITE_POSITIONS[technologyType];
            if (!position) {
                console.warn(`No sprite position defined for technology: ${technologyType}`);
                return null;
            }

            // Create sprite canvas
            const sprite = this.extractSprite(baseImage, position, size);

            // Cache the result
            this.spriteCache.set(cacheKey, sprite);

            return sprite;
        } catch (error) {
            console.error(`Error creating sprite for ${technologyType}:`, error);
            return null;
        }
    }

    /**
     * Load the base tech-icons.png image
     */
    private static async loadBaseImage(): Promise<HTMLImageElement | null> {
        if (this.baseImage) {
            return this.baseImage;
        }

        if (this.imageLoadPromise) {
            return this.imageLoadPromise;
        }

        this.imageLoadPromise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.baseImage = img;
                resolve(img);
            };
            img.onerror = () => {
                reject(new Error('Failed to load tech-icons.png'));
            };
            img.src = '/src/assets/tech-icons.png';
        });

        return this.imageLoadPromise;
    }

    /**
     * Extract a sprite from the sprite sheet
     */
    private static extractSprite(
        sourceImage: HTMLImageElement,
        position: SpritePosition,
        targetSize: number
    ): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d')!;

        // Calculate source coordinates (convert grid position to pixels)
        const sourceX = position.x * WIDTH;
        const sourceY = position.y * HEIGHT;
        const sourceWidth = position.width;
        const sourceHeight = position.height;

        ctx.drawImage(
            sourceImage,
            sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle
            0, 0, targetSize, targetSize                    // Destination rectangle
        );

        return canvas;
    }

    /**
     * Preload all technology sprites for better performance
     */
    public static async preloadSprites(size: number = 116): Promise<void> {
        try {
            await this.loadBaseImage();

            const technologies = Object.values(TechnologyType);
            const promises = technologies.map(tech =>
                this.getTechnologySprite(tech, size)
            );

            await Promise.all(promises);
            console.log(`Preloaded ${technologies.length} technology sprites at size ${size}px`);
        } catch (error) {
            console.warn('Failed to preload technology sprites:', error);
        }
    }

    /**
     * Clear the sprite cache (useful for memory management)
     */
    public static clearCache(): void {
        this.spriteCache.clear();
    }

    /**
     * Get cache statistics
     */
    public static getCacheStats(): { size: number; technologies: string[] } {
        return {
            size: this.spriteCache.size,
            technologies: Array.from(this.spriteCache.keys())
        };
    }
}
