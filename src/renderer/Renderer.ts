export interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

export interface RenderContext {
    canvas: HTMLCanvasElement;
    viewport: Viewport;
    tileSize: number;
}

export class Renderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private ctxOverride: CanvasRenderingContext2D | null = null;
    private viewport: Viewport;
    private tileSize: number = 48;
    private mapWidth: number = 80;
    private mapHeight: number = 50;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get 2D rendering context');
        }
        this.ctx = context;

        this.viewport = {
            x: 0,
            y: 0,
            zoom: 1.0
        };
        this.ctx.imageSmoothingEnabled = false;
    }

    public clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    public fillRect(x: number, y: number, width: number, height: number, color: string): void {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);
    }

    // Stroke a rectangle
    public strokeRect(x: number, y: number, width: number, height: number, color: string, lineWidth: number = 1): void {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.strokeRect(x, y, width, height);
    }

    // Fill a circle
    public fillCircle(x: number, y: number, radius: number, color: string): void {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    // Draw text
    public drawText(text: string, x: number, y: number, color: string, font: string = '12px Arial'): void {
        this.ctx.fillStyle = color;
        this.ctx.font = font;
        this.ctx.fillText(text, x, y);
    }

    // Draw a sprite/image
    public drawSprite(sprite: HTMLCanvasElement, x: number, y: number, width: number, height: number): void {
        this.ctx.drawImage(sprite, x, y, width, height);
    }

    // Convert world coordinates to screen coordinates
    public worldToScreen(worldX: number, worldY: number): { x: number, y: number } {
        // Handle horizontal wrapping by finding the shortest distance
        let deltaX = worldX - this.viewport.x;
        
        // Adjust deltaX to account for world wrapping (shortest path).
        // Use >= so a tile sitting exactly at mapWidth/2 distance is always
        // pulled to the nearer side, preventing a gap at the wrap seam.
        if (deltaX >= this.mapWidth / 2) {
            deltaX -= this.mapWidth;
        } else if (deltaX < -this.mapWidth / 2) {
            deltaX += this.mapWidth;
        }
        
        // Math.round snaps to whole pixels, preventing sub-pixel gaps between tiles.
        // Because adjacent tiles always differ by exactly tileSize before rounding,
        // round(n * tileSize) + tileSize === round((n+1) * tileSize) is guaranteed,
        // so no gaps or overlaps are introduced.
        const screenX = Math.round(deltaX * this.tileSize);
        const screenY = Math.round((worldY - this.viewport.y) * this.tileSize);
        return { x: screenX, y: screenY };
    }

    // Convert screen coordinates to world coordinates
    public screenToWorld(screenX: number, screenY: number): { x: number, y: number } {
        const deltaX = screenX / this.tileSize;
        const worldX = deltaX + this.viewport.x;
        const worldY = screenY / this.tileSize + this.viewport.y;
        
        // Handle horizontal wrapping
        const normalizedX = ((worldX % this.mapWidth) + this.mapWidth) % this.mapWidth;
        
        return { x: Math.floor(normalizedX), y: Math.floor(worldY) };
    }

    // Get render context
    public getRenderContext(): RenderContext {
        return {
            canvas: this.canvas,
            viewport: { ...this.viewport },
            tileSize: this.tileSize
        };
    }

    // Viewport controls
    public setMapDimensions(width: number, height: number): void {
        this.mapWidth = width;
        this.mapHeight = height;
    }

    private clampViewportY(y: number): number {
        const minY = 0;
        const maxY = this.mapHeight - Math.ceil(this.canvas.height / this.tileSize);
        return Math.max(minY, Math.min(Math.max(maxY, 0), y));
    }

    public setViewport(x: number, y: number): void {
        // Snap to the nearest integer-pixel boundary so that every tile's drawImage
        // call lands on a whole pixel column/row.  Without this, centerOn() can
        // produce viewport values whose fractional part * tileSize lands right on a
        // floating-point 0.5 boundary, causing consecutive tiles to round
        // inconsistently and leaving a 1 px background-colour seam between rows or
        // columns.  Manual drag scrolling is immune because each accumulated delta
        // is always an integer number of pixels / tileSize, which is already a
        // pixel-aligned fraction; programmatic centering is not.
        this.viewport.x = Math.round(x * this.tileSize) / this.tileSize;
        this.viewport.y = this.clampViewportY(Math.round(y * this.tileSize) / this.tileSize);
    }

    public moveViewport(deltaX: number, deltaY: number): void {
        this.viewport.x += deltaX; // Allow horizontal wrapping, no clamping
        this.viewport.y = this.clampViewportY(this.viewport.y + deltaY);
    }

    // Center viewport on specific world coordinates
    public centerOn(worldX: number, worldY: number): void {
        const tilesWidth = this.canvas.width / this.tileSize;
        const tilesHeight = this.canvas.height / this.tileSize;

        const centerX = worldX - tilesWidth / 2;
        const centerY = worldY - tilesHeight / 2;

        this.setViewport(centerX, centerY);
    }

    public zoomViewport(): void {
        // Zoom disabled for now - do nothing
    }

    // Fill text
    public fillText(text: string, x: number, y: number, color: string, font: string = '12px Arial', align: CanvasTextAlign = 'left'): void {
        this.ctx.fillStyle = color;
        this.ctx.font = font;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x, y);
    }

    // Fill a triangle
    public fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: string): void {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.lineTo(x3, y3);
        this.ctx.closePath();
        this.ctx.fill();
    }

    // Fill a diamond (rotated square)
    public fillDiamond(centerX: number, centerY: number, size: number, color: string): void {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY - size);
        this.ctx.lineTo(centerX + size, centerY);
        this.ctx.lineTo(centerX, centerY + size);
        this.ctx.lineTo(centerX - size, centerY);
        this.ctx.closePath();
        this.ctx.fill();
    }

    // Draw a line
    public drawLine(x1: number, y1: number, x2: number, y2: number, color: string, width: number = 1): void {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    // Get visible tile range for the current viewport
    public getVisibleTileRange(): { startX: number, endX: number, startY: number, endY: number } {
        const tilesWidth = Math.ceil(this.canvas.width / this.tileSize) + 1;
        const tilesHeight = Math.ceil(this.canvas.height / this.tileSize) + 1;

        return {
            startX: Math.floor(this.viewport.x),
            endX: Math.floor(this.viewport.x) + tilesWidth,
            startY: Math.floor(this.viewport.y),
            endY: Math.floor(this.viewport.y) + tilesHeight
        };
    }

    // Get context for advanced drawing operations (returns override when active)
    public getContext(): CanvasRenderingContext2D {
        return this.ctxOverride ?? this.ctx;
    }

    /** Redirect all subsequent draw calls to an offscreen canvas context. */
    public useOffscreenContext(ctx: CanvasRenderingContext2D): void {
        this.ctxOverride = ctx;
    }

    /** Restore draw calls back to the main canvas context. */
    public restoreContext(): void {
        this.ctxOverride = null;
    }

    // Get viewport
    public getViewport(): Viewport {
        return { ...this.viewport };
    }

    // Resize canvas
    public resize(width: number, height: number): void {
        console.log(`Renderer.resize: ${width}x${height}`);
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.imageSmoothingEnabled = false;
    }
}