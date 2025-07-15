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

    // Fill a rectangle
    public fillRect(x: number, y: number, width: number, height: number, color: string): void {
        console.log(`fillRect: (${x},${y}) ${width}x${height} color:${color}`);
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
        console.debug(`drawSprite: sprite ${sprite.width}x${sprite.height} at (${x},${y}) size ${width}x${height}`);
        this.ctx.drawImage(sprite, x, y, width, height);
    }

    // Convert world coordinates to screen coordinates
    public worldToScreen(worldX: number, worldY: number): { x: number, y: number } {
        // Handle horizontal wrapping by finding the shortest distance
        let deltaX = worldX - this.viewport.x;
        
        // Adjust deltaX to account for world wrapping (shortest path)
        if (deltaX > this.mapWidth / 2) {
            deltaX -= this.mapWidth;
        } else if (deltaX < -this.mapWidth / 2) {
            deltaX += this.mapWidth;
        }
        
        const screenX = deltaX * this.tileSize;
        const screenY = (worldY - this.viewport.y) * this.tileSize;
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
        const tilesHeight = Math.ceil(this.canvas.height / this.tileSize);
        const minY = 0;
        const maxY = 31;
        console.log(`clampViewportY: y=${y}, tilesHeight=${tilesHeight}, mapHeight=${this.mapHeight}, maxY=${maxY}`);
        return Math.max(minY, Math.min(maxY, y));
    }

    public setViewport(x: number, y: number): void {
        this.viewport.x = x; // Allow horizontal wrapping, no clamping
        this.viewport.y = this.clampViewportY(y);
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

    // Get context for advanced drawing operations
    public getContext(): CanvasRenderingContext2D {
        return this.ctx;
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