/**
 * Parse an age filter string into a sorted, de-duped list of ages.
 * Accepts comma-separated single ages and hyphen ranges, e.g.:
 *   "7"        -> [7]
 *   "7, 9"     -> [7, 9]
 *   "6-10"     -> [6, 7, 8, 9, 10]
 *   "5, 8-10"  -> [5, 8, 9, 10]
 * Invalid tokens are ignored; range spans are capped to keep things sane.
 */
export function parseAges(input: string): number[] {
  const out = new Set<number>();
  for (const token of input.split(",")) {
    const t = token.trim();
    if (!t) continue;
    const range = t.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      let lo = Number(range[1]);
      let hi = Number(range[2]);
      if (lo > hi) [lo, hi] = [hi, lo];
      for (let a = lo; a <= hi && a - lo <= 30; a++) out.add(a);
    } else if (/^\d+$/.test(t)) {
      out.add(Number(t));
    }
  }
  return [...out].sort((a, b) => a - b);
}
