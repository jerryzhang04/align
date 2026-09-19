export type Point = { x: number; y: number };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toPixel(normalizedX: number, normalizedY: number, width: number, height: number): Point {
  return { x: normalizedX * width, y: normalizedY * height };
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function internalAngleDeg(a: Point, b: Point, c: Point, minVector = 2): number | null {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const magAb = Math.hypot(abx, aby);
  const magCb = Math.hypot(cbx, cby);
  if (magAb < minVector || magCb < minVector) return null;
  const cosine = clamp((abx * cbx + aby * cby) / (magAb * magCb), -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

/** Inclination of the segment from anatomical left -> right, degrees, folded to [-90, 90]. Image y increases downward. */
export function segmentInclinationDeg(left: Point, right: Point): number | null {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  if (Math.hypot(dx, dy) < 2) return null;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return deg;
}

/** Inclination of a vertical-ish line relative to image vertical. 0 is upright. Positive leans toward +x. */
export function verticalLeanDeg(top: Point, bottom: Point): number | null {
  const dx = bottom.x - top.x;
  const dy = bottom.y - top.y;
  if (Math.hypot(dx, dy) < 2) return null;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function meanAbsoluteDeviation(values: number[], center: number): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + Math.abs(value - center), 0) / values.length;
}
