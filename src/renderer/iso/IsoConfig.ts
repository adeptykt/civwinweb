/**
 * Isometric 2:1 dimetric projection constants (Civ II style).
 *
 * Anchor: worldToScreen returns the top vertex of the tile diamond.
 * Layout: even-r stagger — one diamond per map cell; odd rows offset half-tile right.
 * Z-order: sort by (x + y), then x ascending.
 */
export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;
export const ISO_HALF_W = ISO_TILE_WIDTH / 2;
export const ISO_HALF_H = ISO_TILE_HEIGHT / 2;
/** Vertical footprint used for entity z-sort and overlap tests. */
export const ISO_TILE_FOOTPRINT_H = ISO_TILE_HEIGHT;
