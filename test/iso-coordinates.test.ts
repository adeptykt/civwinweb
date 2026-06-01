import { describe, it, expect } from 'vitest';
import {
  tileToScreen,
  screenToTile,
  screenToTileFloat,
  wrappedDeltaX,
  centerViewportOnTile,
  getVisibleTileRange,
} from '../src/renderer/iso/IsoCoordinateSystem';
import { pointInTopAnchoredDiamond } from '../src/renderer/iso/IsoHitTest';
import { ISO_HALF_H, ISO_HALF_W, ISO_TILE_HEIGHT } from '../src/renderer/iso/IsoConfig';
import { Renderer } from '../src/renderer/Renderer';

function createMockCanvas(width = 1024, height = 768): HTMLCanvasElement {
  const ctx = {
    imageSmoothingEnabled: false,
    clearRect: () => {},
    fillStyle: '',
    fillRect: () => {},
    strokeStyle: '',
    lineWidth: 1,
    strokeRect: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    fillText: () => {},
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    drawImage: () => {},
  };
  const canvas = { width, height, getContext: () => ctx } as unknown as HTMLCanvasElement;
  (ctx as { canvas: HTMLCanvasElement }).canvas = canvas;
  return canvas;
}

describe('IsoCoordinateSystem', () => {
  const mapWidth = 80;
  const mapHeight = 50;
  const viewport = { x: 10, y: 8 };

  it('wraps delta X at the map seam', () => {
    expect(wrappedDeltaX(45, mapWidth)).toBe(-35);
    expect(wrappedDeltaX(-45, mapWidth)).toBe(35);
  });

  it('first column zigzag: (0,1) down-right of (0,0), (0,2) below (0,0)', () => {
    const vp = { x: 0, y: 0 };
    const r0 = tileToScreen(0, 0, vp, mapWidth);
    const r1 = tileToScreen(0, 1, vp, mapWidth);
    const r2 = tileToScreen(0, 2, vp, mapWidth);
    const r3 = tileToScreen(0, 3, vp, mapWidth);

    expect(r0).toEqual({ x: 0, y: 0 });
    expect(r1).toEqual({ x: ISO_HALF_W, y: ISO_HALF_H });
    expect(r2).toEqual({ x: 0, y: ISO_HALF_H * 2 });
    expect(r3).toEqual({ x: ISO_HALF_W, y: ISO_HALF_H * 3 });

    expect(r2.x).toBe(r0.x);
    expect(r2.y).toBeGreaterThan(r0.y);
  });

  it('even rows are horizontal: (0,0), (1,0), (2,0) share screen Y', () => {
    const vp = { x: 0, y: 0 };
    const a = tileToScreen(0, 0, vp, mapWidth);
    const b = tileToScreen(1, 0, vp, mapWidth);
    const c = tileToScreen(2, 0, vp, mapWidth);
    expect(a.y).toBe(b.y);
    expect(b.y).toBe(c.y);
    expect(b.x - a.x).toBe(ISO_HALF_W * 2);
    expect(c.x - b.x).toBe(ISO_HALF_W * 2);
  });

  it('east neighbor is strictly right on even rows', () => {
    const origin = tileToScreen(10, 8, viewport, mapWidth);
    const east = tileToScreen(11, 8, viewport, mapWidth);
    const south = tileToScreen(10, 9, viewport, mapWidth);

    expect(east.y).toBe(origin.y);
    expect(east.x - origin.x).toBe(ISO_HALF_W * 2);

    expect(south.x).toBeGreaterThan(origin.x);
    expect(south.y).toBeGreaterThan(origin.y);
    expect(south.x - origin.x).toBe(ISO_HALF_W);
    expect(south.y - origin.y).toBe(ISO_HALF_H);
  });

  it('round-trips top vertex through screenToTileFloat inverse (no wrap)', () => {
    for (let ty = 0; ty < mapHeight; ty += 7) {
      for (let tx = Math.floor(viewport.x); tx < Math.floor(viewport.x) + 20; tx += 3) {
        const screen = tileToScreen(tx, ty, viewport, mapWidth);
        const back = screenToTileFloat(screen.x, screen.y, viewport);
        expect(back.x).toBeCloseTo(tx, 5);
        expect(back.y).toBeCloseTo(ty, 5);
      }
    }
  });

  it('screenToTile picks the tile under the diamond center', () => {
    for (const [tx, ty] of [[0, 0], [12, 5], [79, 49], [40, 25]] as const) {
      const screen = tileToScreen(tx, ty, viewport, mapWidth);
      const picked = screenToTile(
        screen.x,
        screen.y + ISO_HALF_H,
        viewport,
        mapWidth,
        mapHeight
      );
      expect(picked.x).toBe(tx);
      expect(picked.y).toBe(ty);
    }
  });

  it('pointInTopAnchoredDiamond accepts center, rejects outside corners', () => {
    expect(pointInTopAnchoredDiamond(0, ISO_HALF_H)).toBe(true);
    expect(pointInTopAnchoredDiamond(ISO_HALF_W + 2, ISO_HALF_H)).toBe(false);
    expect(pointInTopAnchoredDiamond(0, -1)).toBe(false);
  });

  it('centerViewportOnTile places tile at canvas center', () => {
    const canvasW = 800;
    const canvasH = 600;
    const centered = centerViewportOnTile(25, 15, canvasW, canvasH);
    const screen = tileToScreen(25, 15, centered, mapWidth);
    expect(screen.x).toBeCloseTo(canvasW / 2, 0);
    expect(screen.y + ISO_HALF_H).toBeCloseTo(canvasH / 2, 0);
  });

  it('getVisibleTileRange covers viewport corners', () => {
    const range = getVisibleTileRange(viewport, mapWidth, mapHeight, 800, 600);
    expect(range.startY).toBeGreaterThanOrEqual(0);
    expect(range.endY).toBeLessThan(mapHeight);
    expect(range.endX - range.startX).toBeGreaterThan(5);
  });
});

describe('Renderer iso mode', () => {
  it('uses iso projection when constructed with iso mode', () => {
    const r = new Renderer(createMockCanvas(), 'iso');
    r.setMapDimensions(80, 50);
    r.setViewport(10, 0);
    expect(r.getRenderMode()).toBe('iso');
    expect(r.getTileSize()).toBe(64);
    const pos = r.worldToScreen(10, 0);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it('switches projection with setRenderMode', () => {
    const r = new Renderer(createMockCanvas(), 'ortho');
    r.setRenderMode('iso');
    expect(r.isIsoMode()).toBe(true);
    r.setRenderMode('ortho');
    expect(r.isIsoMode()).toBe(false);
  });
});

describe('IsoCoordinateSystem map corners', () => {
  it('screenToTile works at map corners with zero viewport', () => {
    const viewport = { x: 0, y: 0 };
    for (const [tx, ty] of [[0, 0], [79, 0], [0, 49], [79, 49]] as const) {
      const screen = tileToScreen(tx, ty, viewport, 80);
      const picked = screenToTile(screen.x, screen.y + ISO_HALF_H, viewport, 80, 50);
      expect(picked.x).toBe(tx);
      expect(picked.y).toBe(ty);
    }
  });
});
