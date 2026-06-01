import type { ProjectionContext, ProjectionStrategy, RenderMode } from './ProjectionStrategy';
import { IsoProjection } from './iso/IsoProjection';
import { OrthoProjection, ORTHO_BASE_TILE_SIZE } from './ortho/OrthoProjection';
import { canvasUiFont } from '../utils/fonts.js';

export type { RenderMode };

const DEFAULT_CANVAS_FONT = canvasUiFont(12);

export interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

export interface RenderContext {
    canvas: HTMLCanvasElement;
    viewport: Viewport;
    tileSize: number;
    displayWidth: number;
    displayHeight: number;
    renderMode: RenderMode;
}

export class Renderer {
    static readonly MIN_ZOOM = 0.625;
    static readonly MAX_ZOOM = 1.75;

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private ctxOverride: CanvasRenderingContext2D | null = null;
    private viewport: Viewport;
    private projection: ProjectionStrategy;
    private mapWidth: number = 80;
    private mapHeight: number = 50;
    private displayWidth: number = 0;
    private displayHeight: number = 0;

    constructor(canvas: HTMLCanvasElement, renderMode: RenderMode = 'ortho') {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get 2D rendering context');
        }
        this.ctx = context;

        this.viewport = {
            x: 0,
            y: 0,
            zoom: 1.0,
        };
        this.ctx.imageSmoothingEnabled = false;
        this.displayWidth = canvas.clientWidth || canvas.width;
        this.displayHeight = canvas.clientHeight || canvas.height;
        this.projection = this.createProjection(renderMode);
    }

    private createProjection(mode: RenderMode): ProjectionStrategy {
        return mode === 'iso' ? new IsoProjection() : new OrthoProjection();
    }

    public setRenderMode(mode: RenderMode): void {
        if (this.projection.mode === mode) {
            return;
        }
        this.projection = this.createProjection(mode);
        if (mode === 'iso') {
            this.viewport.zoom = 1.0;
        }
        this.viewport.y = this.clampViewportY(this.viewport.y);
    }

    public getRenderMode(): RenderMode {
        return this.projection.mode;
    }

    public isIsoMode(): boolean {
        return this.projection.mode === 'iso';
    }

    public getProjectionContext(): ProjectionContext {
        return {
            viewport: { ...this.viewport },
            canvas: this.canvas,
            mapWidth: this.mapWidth,
            mapHeight: this.mapHeight,
            displayWidth: this.displayWidth,
            displayHeight: this.displayHeight,
            effectiveTileSize: this.getEffectiveTileSize(),
        };
    }

    private getEffectiveTileSize(): number {
        if (this.isIsoMode()) {
            return this.projection.getTileSize();
        }
        return ORTHO_BASE_TILE_SIZE * this.viewport.zoom;
    }

    public clear(): void {
        const ctx = this.getContext();
        ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);
    }

    public fillRect(x: number, y: number, width: number, height: number, color: string): void {
        const ctx = this.getContext();
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
    }

    public strokeRect(x: number, y: number, width: number, height: number, color: string, lineWidth: number = 1): void {
        const ctx = this.getContext();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(x, y, width, height);
    }

    public fillCircle(x: number, y: number, radius: number, color: string): void {
        const ctx = this.getContext();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
    }

    public drawText(text: string, x: number, y: number, color: string, font: string = DEFAULT_CANVAS_FONT): void {
        const ctx = this.getContext();
        ctx.fillStyle = color;
        ctx.font = font;
        ctx.fillText(text, x, y);
    }

    public drawSprite(sprite: HTMLCanvasElement, x: number, y: number, width: number, height: number): void {
        const ctx = this.getContext();
        ctx.drawImage(sprite, x, y, width, height);
    }

    public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
        return this.projection.worldToScreen(worldX, worldY, this.getProjectionContext());
    }

    public isWorldPositionVisible(worldX: number, worldY: number): boolean {
        return this.projection.isWorldPositionVisible(worldX, worldY, this.getProjectionContext());
    }

    public screenToWorldPrecise(screenX: number, screenY: number): { x: number; y: number } {
        const ts = this.getEffectiveTileSize();
        return {
            x: screenX / ts + this.viewport.x,
            y: screenY / ts + this.viewport.y,
        };
    }

    public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
        if (this.isIsoMode()) {
            return this.projection.screenToWorld(screenX, screenY, this.getProjectionContext());
        }
        const precise = this.screenToWorldPrecise(screenX, screenY);
        const normalizedX = ((precise.x % this.mapWidth) + this.mapWidth) % this.mapWidth;
        return { x: Math.floor(normalizedX), y: Math.floor(precise.y) };
    }

    public getRenderContext(): RenderContext {
        return {
            canvas: this.canvas,
            viewport: { ...this.viewport },
            tileSize: this.getEffectiveTileSize(),
            displayWidth: this.displayWidth,
            displayHeight: this.displayHeight,
            renderMode: this.projection.mode,
        };
    }

    public getTileSize(): number {
        return this.getEffectiveTileSize();
    }

    public setMapDimensions(width: number, height: number): void {
        this.mapWidth = width;
        this.mapHeight = height;
        this.viewport.y = this.clampViewportY(this.viewport.y);
    }

    private clampViewportY(y: number): number {
        return this.projection.clampViewportY(y, this.getProjectionContext());
    }

    public setViewport(x: number, y: number): void {
        const snapped = this.projection.snapViewport(x, y, this.getProjectionContext());
        this.viewport.x = snapped.x;
        this.viewport.y = this.clampViewportY(snapped.y);
    }

    public moveViewport(deltaX: number, deltaY: number): void {
        this.viewport.x += deltaX;
        this.viewport.y = this.clampViewportY(this.viewport.y + deltaY);
    }

    public moveViewportByScreenDelta(pixelDeltaX: number, pixelDeltaY: number): void {
        const { deltaX, deltaY } = this.projection.screenDragToViewportDelta(
            pixelDeltaX,
            pixelDeltaY,
            this.getProjectionContext()
        );
        this.moveViewport(deltaX, deltaY);
    }

    public centerOn(worldX: number, worldY: number): void {
        const center = this.projection.centerOn(worldX, worldY, this.getProjectionContext());
        this.setViewport(center.x, center.y);
    }

    public setZoom(zoom: number, focalScreenX?: number, focalScreenY?: number): void {
        if (this.isIsoMode()) {
            return;
        }

        const nextZoom = this.clampZoom(zoom);

        if (focalScreenX !== undefined && focalScreenY !== undefined) {
            const anchor = this.screenToWorldPrecise(focalScreenX, focalScreenY);
            this.viewport.zoom = nextZoom;
            const tileSize = this.getEffectiveTileSize();
            this.viewport.x = anchor.x - focalScreenX / tileSize;
            this.viewport.y = this.clampViewportY(anchor.y - focalScreenY / tileSize);
            return;
        }

        this.viewport.zoom = nextZoom;
        this.viewport.y = this.clampViewportY(this.viewport.y);
    }

    public zoomViewport(delta: number, focalScreenX?: number, focalScreenY?: number): void {
        if (this.isIsoMode()) {
            return;
        }
        const factor = 1 + delta;
        this.setZoom(this.viewport.zoom * factor, focalScreenX, focalScreenY);
    }

    private clampZoom(zoom: number): number {
        return Math.max(Renderer.MIN_ZOOM, Math.min(Renderer.MAX_ZOOM, zoom));
    }

    public fillText(text: string, x: number, y: number, color: string, font: string = DEFAULT_CANVAS_FONT, align: CanvasTextAlign = 'left'): void {
        const ctx = this.getContext();
        ctx.fillStyle = color;
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
    }

    public drawLine(x1: number, y1: number, x2: number, y2: number, color: string, width: number = 1): void {
        const ctx = this.getContext();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    public getVisibleTileRange(): { startX: number; endX: number; startY: number; endY: number } {
        return this.projection.getVisibleTileRange(this.getProjectionContext());
    }

    public getContext(): CanvasRenderingContext2D {
        return this.ctxOverride ?? this.ctx;
    }

    public useOffscreenContext(ctx: CanvasRenderingContext2D): void {
        this.ctxOverride = ctx;
    }

    public restoreContext(): void {
        this.ctxOverride = null;
    }

    public getViewport(): Viewport {
        return { ...this.viewport };
    }

    public resize(cssWidth: number, cssHeight: number): void {
        const dpr = this.getDevicePixelRatio();
        this.displayWidth = cssWidth;
        this.displayHeight = cssHeight;
        this.canvas.width = Math.round(cssWidth * dpr);
        this.canvas.height = Math.round(cssHeight * dpr);
        if (this.canvas.style) {
            this.canvas.style.width = `${cssWidth}px`;
            this.canvas.style.height = `${cssHeight}px`;
        }
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
        this.ctx.imageSmoothingEnabled = false;
        this.viewport.y = this.clampViewportY(this.viewport.y);
    }

    private getDevicePixelRatio(): number {
        if (typeof globalThis !== 'undefined' && 'devicePixelRatio' in globalThis) {
            return globalThis.devicePixelRatio || 1;
        }
        return 1;
    }
}
