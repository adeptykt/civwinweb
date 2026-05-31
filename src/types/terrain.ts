// Connection bitmask values for 8-directional connections
export const ConnectionMask = {
  NONE: 0,
  NORTH: 1,
  NORTHEAST: 2,
  EAST: 4,
  SOUTHEAST: 8,
  SOUTH: 16,
  SOUTHWEST: 32,
  WEST: 64,
  NORTHWEST: 128
} as const;

export type ConnectionPattern = number;
