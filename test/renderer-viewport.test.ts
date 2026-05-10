import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Renderer } from '../src/renderer/Renderer';

// ---------------------------------------------------------------------------
// Minimal canvas mock — we only need the geometry APIs, not actual drawing.
// ---------------------------------------------------------------------------
function createMockCanvas(width = 800, height = 600): HTMLCanvasElement {
  const ctx = {
    imageSmoothingEnabled: false,
    clearRect: () => {},
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fillRect: () => {},
    strokeStyle: '' as string | CanvasGradient | CanvasPattern,
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

  const canvas = {
    width,
    height,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  
  (ctx as any).canvas = canvas;

  return canvas;
}

// ---------------------------------------------------------------------------
// Spy-enabled canvas mock — wraps every ctx method with vi.fn() so tests can
// assert that drawing calls were made with the right arguments.
// imageSmoothingEnabled starts as true so the constructor setting it to false
// is detectable.
// ---------------------------------------------------------------------------
function createSpyCanvas(width = 800, height = 600) {
  const ctx = {
    imageSmoothingEnabled: true,
    clearRect: vi.fn(),
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fillRect: vi.fn(),
    strokeStyle: '' as string | CanvasGradient | CanvasPattern,
    lineWidth: 1,
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    font: '' as string,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
  };
  const canvas = { width, height, getContext: (_type: string) => ctx };
  (ctx as any).canvas = canvas;
  return { canvas: canvas as unknown as HTMLCanvasElement, ctx };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when v is an exact integer (no fractional part). */
function isExactInteger(v: number): boolean {
  return Number.isFinite(v) && Math.floor(v) === v;
}

/**
 * The core pixel-alignment invariant:
 * viewport.x * tileSize must be representable as an exact integer so that
 * (n - viewport.x) * tileSize = n*tileSize - k (integer minus integer),
 * which floating-point arithmetic always computes exactly.
 */
function viewportIsPixelAligned(renderer: Renderer, tileSize = 48): boolean {
  const vp = renderer.getViewport();
  return (
    isExactInteger(Math.round(vp.x * tileSize)) &&
    Math.abs(vp.x * tileSize - Math.round(vp.x * tileSize)) < 1e-9 &&
    isExactInteger(Math.round(vp.y * tileSize)) &&
    Math.abs(vp.y * tileSize - Math.round(vp.y * tileSize)) < 1e-9
  );
}

const TILE_SIZE = 48; // matches the private constant in Renderer

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Renderer – viewport pixel alignment', () => {
  // -------------------------------------------------------------------------
  // setViewport
  // -------------------------------------------------------------------------
  describe('setViewport', () => {
    it('stores a pixel-aligned x when given an exact fraction', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      // 1 / TILE_SIZE is not exactly representable as a binary fraction
      r.setViewport(1 / TILE_SIZE, 0);
      expect(viewportIsPixelAligned(r)).toBe(true);
    });

    it('stores a pixel-aligned y when given an exact fraction', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.setViewport(0, 3 / TILE_SIZE);
      expect(viewportIsPixelAligned(r)).toBe(true);
    });

    it('stays pixel-aligned for typical world-tile coordinates', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      // Integer coordinates are trivially pixel-aligned
      r.setViewport(20, 10);
      expect(viewportIsPixelAligned(r)).toBe(true);
    });

    it('stays pixel-aligned for arbitrary sub-tile fractions', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      // These are the awkward values that caused the seam before the fix
      const awkwardValues = [
        0.989583333333333,   // canvas.width=769 / (2*48) artefact
        7.291666666666667,   // canvas.height=700 / (2*48) artefact
        0.5 / TILE_SIZE,     // exactly half a pixel
        12.020833333333334,  // canvas.width=1154 / (2*48)
      ];
      for (const v of awkwardValues) {
        r.setViewport(v, v);
        expect(viewportIsPixelAligned(r)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // centerOn – the primary regression scenario
  // -------------------------------------------------------------------------
  describe('centerOn', () => {
    /**
     * Canvas widths/heights that are NOT multiples of 2*TILE_SIZE produce
     * fractional tilesWidth/tilesHeight, which before the fix could push
     * viewport.x or viewport.y to a value whose fractional part × tileSize
     * sits right on the 0.5 boundary – causing Math.round to flip for one
     * tile in a row/column while not flipping for its neighbour, producing a
     * visible 1-pixel seam.
     */
    const awkwardCanvasSizes = [
      { w: 769, h: 600 },   // odd width → 0.5/48 fractional viewport.x
      { w: 800, h: 601 },   // odd height
      { w: 769, h: 601 },   // both odd
      { w: 1000, h: 700 },  // neither divisible by 96
      { w: 1153, h: 749 },  // prime-ish dimensions
      { w: 1154, h: 750 },  // width ≡ 2 (mod 4)
      { w: 1280, h: 800 },  // "nice" but not a multiple of 96
    ];

    for (const { w, h } of awkwardCanvasSizes) {
      it(`produces a pixel-aligned viewport for canvas ${w}×${h}`, () => {
        const r = new Renderer(createMockCanvas(w, h));
        r.setMapDimensions(80, 50);
        r.centerOn(40, 20);
        expect(viewportIsPixelAligned(r)).toBe(true);
      });
    }

    it('produces pixel-aligned viewport when centering on tile (0, 0)', () => {
      const r = new Renderer(createMockCanvas(769, 601));
      r.setMapDimensions(80, 50);
      r.centerOn(0, 0);
      expect(viewportIsPixelAligned(r)).toBe(true);
    });

    it('produces pixel-aligned viewport when centering near map edges', () => {
      const r = new Renderer(createMockCanvas(769, 601));
      r.setMapDimensions(80, 50);
      r.centerOn(79, 49); // bottom-right corner
      expect(viewportIsPixelAligned(r)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // worldToScreen – tile positions must be exact integers after alignment
  // -------------------------------------------------------------------------
  describe('worldToScreen', () => {
    it('returns exact integer screen coords for integer tile positions', () => {
      const r = new Renderer(createMockCanvas(769, 601));
      r.setMapDimensions(80, 50);
      r.centerOn(40, 20);

      for (let tx = 30; tx <= 50; tx++) {
        for (let ty = 15; ty <= 25; ty++) {
          const { x, y } = r.worldToScreen(tx, ty);
          expect(isExactInteger(x)).toBe(true);
          expect(isExactInteger(y)).toBe(true);
        }
      }
    });

    it('places adjacent tiles exactly TILE_SIZE pixels apart (no 1-px seam)', () => {
      // This is the direct regression test for the seam bug.
      // For every pair of horizontally or vertically adjacent tiles in the
      // visible range, screen positions must differ by exactly TILE_SIZE.
      const r = new Renderer(createMockCanvas(769, 601));
      r.setMapDimensions(80, 50);
      r.centerOn(40, 20);

      for (let tx = 31; tx <= 50; tx++) {
        const prev = r.worldToScreen(tx - 1, 20);
        const curr = r.worldToScreen(tx, 20);
        expect(curr.x - prev.x).toBe(TILE_SIZE);
      }

      for (let ty = 16; ty <= 25; ty++) {
        const prev = r.worldToScreen(40, ty - 1);
        const curr = r.worldToScreen(40, ty);
        expect(curr.y - prev.y).toBe(TILE_SIZE);
      }
    });

    it('no seam for multiple awkward canvas sizes', () => {
      const sizes = [769, 800, 961, 1000, 1153, 1280];
      for (const w of sizes) {
        const r = new Renderer(createMockCanvas(w, 601));
        r.setMapDimensions(80, 50);
        r.centerOn(40, 20);

        for (let tx = 32; tx <= 48; tx++) {
          const prev = r.worldToScreen(tx - 1, 20);
          const curr = r.worldToScreen(tx, 20);
          expect(curr.x - prev.x).toBe(TILE_SIZE);
        }
      }
    });

    it('handles horizontal map wrapping — tile just past the right edge wraps to the near side', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.setViewport(75, 10); // viewport near the right edge

      // Tile 79 is 4 tiles to the right of viewport origin → screen x = 4*48 = 192
      const t79 = r.worldToScreen(79, 10);
      // Tile 0, via wrapping, is 5 tiles to the right → screen x = 5*48 = 240
      const t0 = r.worldToScreen(0, 10);

      expect(t79.x).toBe(4 * TILE_SIZE);
      expect(t0.x).toBe(5 * TILE_SIZE);
    });

    it('wraps tiles on the left side of the viewport to the right of the screen', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.setViewport(2, 10); // viewport near the left edge

      // Tile 79 is 3 world tiles to the left, but via wrapping it is 77 to the right.
      // deltaX raw = 79 - 2 = 77; 77 < mapWidth/2 (40) is FALSE, so it wraps:
      // deltaX = 77 - 80 = -3 → screen x = -3 * 48 = -144
      const t79 = r.worldToScreen(79, 10);
      expect(t79.x).toBe(-3 * TILE_SIZE);
    });
  });

  // -------------------------------------------------------------------------
  // moveViewport (manual drag scrolling)
  // -------------------------------------------------------------------------
  describe('moveViewport', () => {
    it('advances the viewport by the given delta', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.setViewport(10, 5);

      // Simulate a drag of exactly 1 tile horizontally
      r.moveViewport(1, 0);
      expect(r.getViewport().x).toBeCloseTo(11, 10);
    });

    it('accumulates multiple small pixel drags without visible tile gaps', () => {
      // Simulate 48 one-pixel horizontal drags (= 1 full tile scroll)
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.setViewport(10, 5);

      const pixelDelta = 1;
      for (let i = 0; i < TILE_SIZE; i++) {
        r.moveViewport(pixelDelta / TILE_SIZE, 0);
      }

      // After 48 × (1/48) drags the viewport should have moved by 1 tile
      expect(r.getViewport().x).toBeCloseTo(11, 6);

      // Adjacent tiles should still be TILE_SIZE apart
      for (let tx = 11; tx <= 20; tx++) {
        const prev = r.worldToScreen(tx - 1, 10);
        const curr = r.worldToScreen(tx, 10);
        expect(curr.x - prev.x).toBe(TILE_SIZE);
      }
    });

    it('clamps viewport Y to valid map range', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);

      // Move viewport well below the bottom of the map
      r.setViewport(0, 0);
      r.moveViewport(0, 9999);
      expect(r.getViewport().y).toBeLessThanOrEqual(50);

      // Move viewport above the top of the map
      r.moveViewport(0, -9999);
      expect(r.getViewport().y).toBeGreaterThanOrEqual(0);
    });

    it('does NOT clamp viewport X (horizontal wrapping is allowed)', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.setViewport(0, 0);

      r.moveViewport(100, 0); // way past the right edge
      expect(r.getViewport().x).toBeGreaterThan(80);

      r.moveViewport(-200, 0); // way past the left edge
      expect(r.getViewport().x).toBeLessThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // setViewport Y clamping
  // -------------------------------------------------------------------------
  describe('setViewport Y clamping', () => {
    it('clamps Y to 0 when given a negative value', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.setViewport(5, -10);
      expect(r.getViewport().y).toBeGreaterThanOrEqual(0);
    });

    it('clamps Y so the viewport cannot scroll past the bottom of the map', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.setViewport(5, 9999);
      // Max Y = mapHeight - canvasHeight / tileSize = 50 - 600/48 = 37.5
      const maxY = 50 - 600 / TILE_SIZE;
      expect(r.getViewport().y).toBeCloseTo(maxY, 5);
    });
  });

  // -------------------------------------------------------------------------
  // screenToWorld round-trip
  // -------------------------------------------------------------------------
  describe('screenToWorld', () => {
    it('converts back to the correct tile after worldToScreen', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.centerOn(40, 20);

      // Use the top-left pixel of each tile
      for (let tx = 35; tx <= 45; tx++) {
        for (let ty = 17; ty <= 23; ty++) {
          const screen = r.worldToScreen(tx, ty);
          const world = r.screenToWorld(screen.x, screen.y);
          expect(world.x).toBe(((tx % 80) + 80) % 80);
          expect(world.y).toBe(ty);
        }
      }
    });

    it('handles fractional screen coords inside a tile (floor to tile origin)', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.setViewport(0, 0);

      // Centre pixel of tile (3, 5) should still map to tile (3, 5)
      const world = r.screenToWorld(3 * TILE_SIZE + TILE_SIZE / 2, 5 * TILE_SIZE + TILE_SIZE / 2);
      expect(world.x).toBe(3);
      expect(world.y).toBe(5);
    });

    it('normalises the returned X coordinate within [0, mapWidth)', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.setViewport(-5, 0); // viewport slightly to the left of the map edge

      // Screen x = 0 maps to world x = -5, which normalised = 75
      const world = r.screenToWorld(0, 0);
      expect(world.x).toBeGreaterThanOrEqual(0);
      expect(world.x).toBeLessThan(80);
    });
  });

  // -------------------------------------------------------------------------
  // getVisibleTileRange
  // -------------------------------------------------------------------------
  describe('getVisibleTileRange', () => {
    it('returns a range wide enough to cover the entire canvas', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.setViewport(10, 5);

      const { startX, endX, startY, endY } = r.getVisibleTileRange();
      const widthInTiles = endX - startX;
      const heightInTiles = endY - startY;

      expect(widthInTiles * TILE_SIZE).toBeGreaterThanOrEqual(800);
      expect(heightInTiles * TILE_SIZE).toBeGreaterThanOrEqual(600);
    });

    it('startX equals floor(viewport.x)', () => {
      const r = new Renderer(createMockCanvas(800, 600));
      r.setMapDimensions(80, 50);
      r.setViewport(12.7, 3.2);

      const { startX, startY } = r.getVisibleTileRange();
      expect(startX).toBe(Math.floor(r.getViewport().x));
      expect(startY).toBe(Math.floor(r.getViewport().y));
    });
  });
});

// =============================================================================
// Constructor
// =============================================================================
describe('Renderer – constructor', () => {
  it('sets imageSmoothingEnabled to false on the canvas context', () => {
    const { canvas, ctx } = createSpyCanvas();
    // ctx.imageSmoothingEnabled starts as true in createSpyCanvas
    new Renderer(canvas);
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('throws when the canvas cannot provide a 2D context', () => {
    const nullCanvas = {
      width: 800,
      height: 600,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    expect(() => new Renderer(nullCanvas)).toThrow('Failed to get 2D rendering context');
  });

  it('initialises the viewport at (0, 0) with zoom 1', () => {
    const r = new Renderer(createMockCanvas());
    expect(r.getViewport()).toEqual({ x: 0, y: 0, zoom: 1.0 });
  });
});

// =============================================================================
// Drawing primitives
// =============================================================================
describe('Renderer – drawing primitives', () => {
  it('clear calls ctx.clearRect with the full canvas dimensions', () => {
    const { canvas, ctx } = createSpyCanvas(1024, 768);
    const r = new Renderer(canvas);
    r.clear();
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1024, 768);
  });

  it('fillRect sets fillStyle and calls ctx.fillRect with the given rect', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    r.fillRect(10, 20, 100, 50, '#ff0000');
    expect(ctx.fillStyle).toBe('#ff0000');
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 100, 50);
  });

  it('strokeRect sets strokeStyle, default lineWidth 1, and calls ctx.strokeRect', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    r.strokeRect(5, 10, 80, 40, 'blue');
    expect(ctx.strokeStyle).toBe('blue');
    expect(ctx.lineWidth).toBe(1);
    expect(ctx.strokeRect).toHaveBeenCalledWith(5, 10, 80, 40);
  });

  it('strokeRect accepts a custom lineWidth', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    r.strokeRect(0, 0, 10, 10, 'red', 3);
    expect(ctx.lineWidth).toBe(3);
    expect(ctx.strokeRect).toHaveBeenCalledWith(0, 0, 10, 10);
  });

  it('fillCircle sets fillStyle, calls beginPath, arc with full 2π sweep, then fill', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    r.fillCircle(50, 60, 15, 'green');
    expect(ctx.fillStyle).toBe('green');
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledWith(50, 60, 15, 0, 2 * Math.PI);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('drawText sets fillStyle and font, then calls ctx.fillText', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    r.drawText('hello', 5, 10, '#333333', '14px sans-serif');
    expect(ctx.fillStyle).toBe('#333333');
    expect(ctx.font).toBe('14px sans-serif');
    expect(ctx.fillText).toHaveBeenCalledWith('hello', 5, 10);
  });

  it('drawText defaults to system UI stack when no font is given', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    r.drawText('hi', 0, 0, 'white');
    expect(ctx.font).toBe('12px system-ui, "Segoe UI", "Noto Sans", Arial, sans-serif');
  });

  it('drawSprite calls ctx.drawImage with the supplied sprite, coordinates and dimensions', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    const sprite = createMockCanvas(48, 48);
    r.drawSprite(sprite, 100, 200, 48, 48);
    expect(ctx.drawImage).toHaveBeenCalledWith(sprite, 100, 200, 48, 48);
  });

  it('fillText sets fillStyle, font, textAlign, textBaseline and calls ctx.fillText', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    r.fillText('test', 30, 40, 'white', '16px monospace', 'center');
    expect(ctx.fillStyle).toBe('white');
    expect(ctx.font).toBe('16px monospace');
    expect(ctx.textAlign).toBe('center');
    expect(ctx.textBaseline).toBe('middle');
    expect(ctx.fillText).toHaveBeenCalledWith('test', 30, 40);
  });

  it('fillText defaults to align "left" and system UI font stack', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    r.fillText('x', 0, 0, 'black');
    expect(ctx.textAlign).toBe('left');
    expect(ctx.font).toBe('12px system-ui, "Segoe UI", "Noto Sans", Arial, sans-serif');
  });

  it('drawLine sets strokeStyle, default lineWidth 1, and draws the segment', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    r.drawLine(0, 0, 100, 100, 'yellow');
    expect(ctx.strokeStyle).toBe('yellow');
    expect(ctx.lineWidth).toBe(1);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 100);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('drawLine accepts a custom line width', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    r.drawLine(0, 0, 50, 50, 'red', 4);
    expect(ctx.lineWidth).toBe(4);
  });
});

// =============================================================================
// getRenderContext / getContext / getViewport
// =============================================================================
describe('Renderer – getRenderContext / getContext / getViewport', () => {
  it('getRenderContext returns the correct canvas reference and tileSize of 48', () => {
    const { canvas } = createSpyCanvas(800, 600);
    const r = new Renderer(canvas);
    const rc = r.getRenderContext();
    expect(rc.canvas).toBe(canvas);
    expect(rc.tileSize).toBe(48);
  });

  it('getRenderContext viewport is a snapshot — a subsequent move does not change it', () => {
    const r = new Renderer(createMockCanvas());
    r.setMapDimensions(80, 50);
    r.setViewport(10, 5);
    const snapshot = r.getRenderContext().viewport;
    r.setViewport(20, 8);
    expect(snapshot.x).toBe(10);
    expect(snapshot.y).toBe(5);
  });

  it('getContext returns the underlying canvas rendering context', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    expect(r.getContext()).toBe(ctx);
  });

  it('getViewport returns a copy — mutating it does not affect internal state', () => {
    const r = new Renderer(createMockCanvas());
    r.setMapDimensions(80, 50);
    r.setViewport(5, 3);
    const vp = r.getViewport();
    vp.x = 999;
    expect(r.getViewport().x).toBe(5);
  });

  it('getViewport zoom is always 1.0 (zoom is disabled)', () => {
    const r = new Renderer(createMockCanvas());
    r.zoomViewport();
    expect(r.getViewport().zoom).toBe(1.0);
  });
});

// =============================================================================
// resize
// =============================================================================
describe('Renderer – resize', () => {
  it('updates canvas width and height', () => {
    const { canvas } = createSpyCanvas(800, 600);
    const r = new Renderer(canvas);
    r.resize(1280, 960);
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(960);
  });

  it('resets imageSmoothingEnabled to false after resize', () => {
    const { canvas, ctx } = createSpyCanvas();
    const r = new Renderer(canvas);
    ctx.imageSmoothingEnabled = true; // simulate an external reset
    r.resize(800, 600);
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('new canvas height affects Y clamping on the next setViewport call', () => {
    // 800×600 canvas: maxY = 50 - 600/48 = 37.5
    const r = new Renderer(createMockCanvas(800, 600));
    r.setMapDimensions(80, 50);
    r.setViewport(0, 9999);
    const yBefore = r.getViewport().y; // 37.5

    // Resize to 48px tall: maxY = 50 - 48/48 = 49
    r.resize(800, 48);
    r.setViewport(0, 9999);
    const yAfter = r.getViewport().y; // 49

    expect(yAfter).toBeGreaterThan(yBefore);
  });
});

// =============================================================================
// setMapDimensions
// =============================================================================
describe('Renderer – setMapDimensions', () => {
  it('larger map height raises the maximum Y scroll', () => {
    const r = new Renderer(createMockCanvas(800, 600));

    // Small map (20 tiles tall) → maxY = 20 - 600/48 = 7.5
    r.setMapDimensions(20, 20);
    r.setViewport(0, 9999);
    const ySmall = r.getViewport().y;

    // Large map (100 tiles tall) → maxY = 100 - 600/48 = 87.5
    r.setMapDimensions(80, 100);
    r.setViewport(0, 9999);
    const yLarge = r.getViewport().y;

    expect(yLarge).toBeGreaterThan(ySmall);
  });

  it('shrinking the map clamps the viewport on the next setViewport call', () => {
    const r = new Renderer(createMockCanvas(800, 600));
    r.setMapDimensions(80, 100);
    r.setViewport(0, 80); // valid scroll position for a 100-tile map

    // Shrink to 20 tiles → maxY = 20 - 600/48 = 7.5
    r.setMapDimensions(80, 20);
    r.setViewport(0, r.getViewport().y); // trigger re-clamping
    const expectedMax = 20 - 600 / TILE_SIZE;
    expect(r.getViewport().y).toBeCloseTo(expectedMax, 5);
  });
});

// =============================================================================
// zoomViewport
// =============================================================================
describe('Renderer – zoomViewport', () => {
  it('is a no-op — the viewport is unchanged', () => {
    const r = new Renderer(createMockCanvas());
    r.setMapDimensions(80, 50);
    r.setViewport(10, 5);
    const vpBefore = r.getViewport();
    r.zoomViewport();
    expect(r.getViewport()).toEqual(vpBefore);
  });
});
