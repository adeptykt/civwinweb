/** Deep-merge plain objects (for locale bundles). Arrays and scalars from `b` replace `a`. */
export function deepMerge(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const key of Object.keys(b)) {
    const av = a[key];
    const bv = b[key];
    if (
      bv !== null &&
      typeof bv === 'object' &&
      !Array.isArray(bv) &&
      av !== null &&
      typeof av === 'object' &&
      !Array.isArray(av)
    ) {
      out[key] = deepMerge(av as Record<string, unknown>, bv as Record<string, unknown>);
    } else {
      out[key] = bv;
    }
  }
  return out;
}
