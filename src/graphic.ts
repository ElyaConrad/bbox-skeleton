import { compose, inverse, Matrix, skew, translate } from 'transformation-matrix';

export type Vec2 = {
    x: number;
    y: number;
}
export type ElementBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type Skeleton = [Vec2, Vec2, Vec2, Vec2];


// Helper function to create a skew matrix from degrees
export function skewDEG(ax: number, ay: number) {
  const axRad = (ax * Math.PI) / 180;
  const ayRad = (ay * Math.PI) / 180;
  return skew(axRad, ayRad);
}
// Convert degrees to radians
export function radiansToDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

// Bake a given origin into a transformation matrix
export function bakeOriginIntoMatrix(coreMatrix: Matrix, origin: Vec2) {
  return compose(
    translate(origin.x, origin.y),
    coreMatrix,
    translate(-origin.x, -origin.y)
  );
}

// Calculate the compensation delta to be applied to the geometry when changing the transform origin via d = (M_kern^(-1) - I) · (o_alt - o_neu)
export function computeOriginCompensationDelta(coreMatrix: Matrix, oldOrigin: Vec2, newOrigin: Vec2): Vec2 {
  const invCore = inverse(coreMatrix);
  const originDelta = subtractVec(oldOrigin, newOrigin);

  // (M^(-1) - I) · v = M^(-1) · v - v
  const transformed = applyLinearPartOfMatrix(invCore, originDelta);
  return subtractVec(transformed, originDelta);
}

// Applies only the linear part of a transformation matrix to a vector
export function applyLinearPartOfMatrix(m: Matrix, v: Vec2): Vec2 {
  return {
    x: m.a * v.x + m.c * v.y,
    y: m.b * v.x + m.d * v.y,
  };
}
// Subtract two vectors
export function subtractVec(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}






export const composeBBox = (canvasWidth: number, canvasHeight: number, bbox: ElementBBox, compose: (x: number, y: number) => [number, number]) => {
  const composeAbs = (x: number, y: number) => {
    const xRel = x / canvasWidth;
    const yRel = y / canvasHeight;

    return compose(xRel, yRel);
  };

  const [x, y] = composeAbs(bbox.x, bbox.y);
  const [xMax, yMax] = composeAbs(bbox.x + bbox.width, bbox.y + bbox.height);
  return { x, y, width: xMax - x, height: yMax - y };
};

export function pathifySkeleton(canvasWidth: number, canvasHeight: number, points: Vec2[], compose: (x: number, y: number) => [number, number]) {
  if (points.length === 0) return '';
  const composePointAbs = (x: number, y: number) => {
    const xRel = x / canvasWidth;
    const yRel = y / canvasHeight;

    return compose(xRel, yRel);
  };
  return `M${points.map((pt) => composePointAbs(pt.x, pt.y)).join(' L')} Z`;
}

export function composeCircle(canvasWidth: number, canvasHeight: number, pt: [number, number], compose: (x: number, y: number) => [number, number]) {
  const composePointAbs = (x: number, y: number) => {
    const xRel = x / canvasWidth;
    const yRel = y / canvasHeight;

    return compose(xRel, yRel);
  };
  const [cx, cy] = composePointAbs(pt[0], pt[1]);
  return { cx, cy };
}