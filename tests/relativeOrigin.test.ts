import { describe, it, expect } from 'vitest';
import { compose, translate, rotateDEG, scale, skew, Matrix } from 'transformation-matrix';
import {
  bakeOriginIntoMatrix,
  computeOriginCompensationDelta,
  coreTransformIsDegenerate,
  adjustLocalBBoxForNewTransformOrigin,
  adjustLocalBBoxForNewTransformOriginRelative,
  applySkeletonInPlace,
  getElementWorldSkeleton,
  getElementWorldMatrix,
  getElementSkeleton,
  getElementLocalBBox,
  getAspectRatioOfSkeleton,
  projectSkeletonFromCorner,
  translateSkeleton,
  rederiveRelativeOrigins,
  rel2absTransformOrigin,
  collectAllElements,
  type SimpleElement,
  type SimpleElementShape,
  type SimpleElementGroup,
  type ElementChangeRecord,
  type Skeleton,
} from '../src/index';
import { applyToPoint } from 'transformation-matrix';

// Deterministic LCG so failures are reproducible
function makeRand(seed: number) {
  let state = seed;
  return (lo: number, hi: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return lo + (state / 2147483648) * (hi - lo);
  };
}

type Meta = {};

function makeShape(x: number, y: number, width: number, height: number, coreTransform: Matrix, relativeOrigin: [number, number] | null): SimpleElementShape<Meta> {
  const el: SimpleElementShape<Meta> = { type: 'shape', x, y, width, height, coreTransform, transformOrigin: { x: 0, y: 0 }, relativeOrigin, meta: {} };
  el.transformOrigin = relativeOrigin ? rel2absTransformOrigin(relativeOrigin, { x, y, width, height }) : { x: x + width / 2, y: y + height / 2 };
  return el;
}
function makeGroup(children: SimpleElement<Meta>[], coreTransform: Matrix, relativeOrigin: [number, number] | null): SimpleElementGroup<Meta> {
  const el: SimpleElementGroup<Meta> = { type: 'group', children, coreTransform, transformOrigin: { x: 0, y: 0 }, relativeOrigin, meta: {} };
  const bbox = getElementLocalBBox(el);
  el.transformOrigin = relativeOrigin ? rel2absTransformOrigin(relativeOrigin, bbox) : { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  return el;
}

function writeRecords(records: ElementChangeRecord<Meta>[]) {
  for (const { el, newLocalBBox } of records) {
    el.x = newLocalBBox.x;
    el.y = newLocalBBox.y;
    el.width = newLocalBBox.width;
    el.height = newLocalBBox.height;
  }
}

// The compensation step as bx-studio will apply it: adjust geometry so the relative origin
// re-derivation preserves the current visual result, then sync all traveling origins
function compensate(element: SimpleElement<Meta>) {
  const { changes, transformOriginAbs } = adjustLocalBBoxForNewTransformOriginRelative(element, element.relativeOrigin!);
  writeRecords(changes);
  element.transformOrigin = transformOriginAbs;
  if (element.type === 'group') {
    for (const child of element.children) {
      rederiveRelativeOrigins(child);
    }
  }
}

function skeletonError(a: Skeleton, b: Skeleton) {
  let max = 0;
  for (let i = 0; i < 4; i++) {
    max = Math.max(max, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y));
  }
  return max;
}

describe('computeOriginCompensationDelta', () => {
  it('moving the origin while shifting geometry by d preserves the baked transform result (fuzz)', () => {
    const rand = makeRand(12345);
    let maxErr = 0;
    for (let i = 0; i < 2000; i++) {
      const M = compose(translate(rand(-500, 500), rand(-500, 500)), rotateDEG(rand(-180, 180)), skew(rand(-0.5, 0.5), rand(-0.5, 0.5)), scale(rand(0.2, 3), rand(0.2, 3)));
      const o = { x: rand(-500, 500), y: rand(-500, 500) };
      const o2 = { x: rand(-500, 500), y: rand(-500, 500) };
      const d = computeOriginCompensationDelta(M, o, o2);
      const before = bakeOriginIntoMatrix(M, o);
      const after = bakeOriginIntoMatrix(M, o2);
      for (let j = 0; j < 3; j++) {
        const p = { x: rand(-1000, 1000), y: rand(-1000, 1000) };
        const r1 = applyToPoint(before, p);
        const r2 = applyToPoint(after, { x: p.x + d.x, y: p.y + d.y });
        maxErr = Math.max(maxErr, Math.hypot(r1.x - r2.x, r1.y - r2.y));
      }
    }
    expect(maxErr).toBeLessThan(1e-9);
  });
});

describe('adjustLocalBBoxForNewTransformOriginRelative (shape)', () => {
  it('is visually lossless and lands on the rel2abs fixpoint (fuzz)', () => {
    const rand = makeRand(999);
    let maxVisualErr = 0;
    let maxFixpointErr = 0;
    for (let i = 0; i < 2000; i++) {
      const el = makeShape(rand(-500, 500), rand(-500, 500), rand(10, 600), rand(10, 600), compose(translate(rand(-200, 200), rand(-200, 200)), rotateDEG(rand(-180, 180)), skew(rand(-0.4, 0.4), rand(-0.4, 0.4)), scale(rand(0.3, 2.5), rand(0.3, 2.5))), null);
      el.transformOrigin = { x: rand(-500, 500), y: rand(-500, 500) }; // arbitrary old absolute origin
      const rel: [number, number] = [rand(-0.5, 1.5), rand(-0.5, 1.5)];

      const before = getElementSkeleton(el);
      const { changes, transformOriginAbs } = adjustLocalBBoxForNewTransformOriginRelative(el, rel);
      writeRecords(changes);
      el.transformOrigin = transformOriginAbs;
      const after = getElementSkeleton(el);

      maxVisualErr = Math.max(maxVisualErr, skeletonError(before, after));
      const rederived = rel2absTransformOrigin(rel, getElementLocalBBox(el));
      maxFixpointErr = Math.max(maxFixpointErr, Math.hypot(rederived.x - transformOriginAbs.x, rederived.y - transformOriginAbs.y));
    }
    expect(maxVisualErr).toBeLessThan(1e-9);
    expect(maxFixpointErr).toBeLessThan(1e-9);
  });

  it('is a no-op for degenerate core transforms (no NaN/Infinity)', () => {
    const el = makeShape(100, 100, 200, 100, scale(0, 1), [0.5, 0.5]);
    expect(coreTransformIsDegenerate(el.coreTransform)).toBe(true);
    const { changes, transformOriginAbs } = adjustLocalBBoxForNewTransformOriginRelative(el, [0.5, 0.5]);
    expect(changes).toEqual([]);
    expect(Number.isFinite(transformOriginAbs.x)).toBe(true);
    expect(Number.isFinite(transformOriginAbs.y)).toBe(true);
  });
});

// Simulates bx-studio's interaction loop: a frozen drag-start skeleton, per-frame solve against
// the CURRENT world matrix, raw bbox write, then either naive origin re-derivation (the bug)
// or compensation (the fix)
describe('studio drag loop (relative origins)', () => {
  function dragLoop(rotate: number, mode: 'naive' | 'compensated') {
    const el = makeShape(100, 100, 200, 100, rotateDEG(rotate), [0.5, 0.5]);
    const tree: SimpleElement<Meta>[] = [el];
    const startSkeleton = getElementWorldSkeleton(tree, el);
    const target = translateSkeleton(startSkeleton, { x: 50, y: 0 });
    const errors: number[] = [];
    for (let frame = 0; frame < 6; frame++) {
      const m = getElementWorldMatrix(tree, el);
      writeRecords(applySkeletonInPlace(el, target, m));
      if (mode === 'compensated') compensate(el);
      else rederiveRelativeOrigins(el);
      errors.push(skeletonError(getElementWorldSkeleton(tree, el), target));
    }
    return errors;
  }

  it('without compensation, rotations over 60° diverge (documents the bug)', () => {
    const errors = dragLoop(150, 'naive');
    expect(errors[0]).toBeGreaterThan(50);
    expect(errors[5]).toBeGreaterThan(errors[0] * 10);
  });

  it('with compensation, dragging is exact at any rotation', () => {
    for (const rotate of [10, 45, 60, 90, 150, -135]) {
      const errors = dragLoop(rotate, 'compensated');
      for (const err of errors) expect(err).toBeLessThan(1e-9);
    }
  });

  it('with compensation, corner-scaling keeps the opposite corner pinned at any rotation', () => {
    for (const rotate of [10, 60, 150]) {
      const el = makeShape(100, 100, 200, 100, rotateDEG(rotate), [0.5, 0.5]);
      const tree: SimpleElement<Meta>[] = [el];
      const startSkeleton = getElementWorldSkeleton(tree, el);
      const pinnedCorner = startSkeleton[2]; // dragging handle 0 (tl) pins corner 2 (br)
      const aspect = getAspectRatioOfSkeleton(startSkeleton, getElementWorldMatrix(tree, el));
      for (let frame = 1; frame <= 6; frame++) {
        const mouse = { x: startSkeleton[0].x - 8 * frame, y: startSkeleton[0].y - 5 * frame };
        const m = getElementWorldMatrix(tree, el);
        const { skeleton: target } = projectSkeletonFromCorner(startSkeleton, m, 0, mouse, frame % 2 === 0 ? aspect : null);
        writeRecords(applySkeletonInPlace(el, target, m));
        compensate(el);
        const rendered = getElementWorldSkeleton(tree, el);
        expect(skeletonError(rendered, target)).toBeLessThan(1e-9);
        expect(Math.hypot(rendered[2].x - pinnedCorner.x, rendered[2].y - pinnedCorner.y)).toBeLessThan(1e-9);
      }
    }
  });
});

describe('studio drag loop (relative-origin groups)', () => {
  function makeTree() {
    const a = makeShape(100, 100, 120, 80, rotateDEG(150), [0.5, 0.5]);
    const b = makeShape(260, 140, 90, 90, compose(rotateDEG(-30), scale(1.2, 0.8)), [0.5, 0.5]);
    const g = makeGroup([a, b], compose(translate(40, 20), rotateDEG(150)), [0.5, 0.5]);
    return { tree: [g] as SimpleElement<Meta>[], g, a, b };
  }

  it('dragging a rotated group is exact with leaf + group compensation', () => {
    const { tree, g } = makeTree();
    const target = translateSkeleton(getElementWorldSkeleton(tree, g), { x: 50, y: 0 });
    for (let frame = 0; frame < 6; frame++) {
      const m = getElementWorldMatrix(tree, g);
      const records = applySkeletonInPlace(g, target, m);
      writeRecords(records);
      for (const { el } of records) compensate(el);
      compensate(g);
      expect(skeletonError(getElementWorldSkeleton(tree, g), target)).toBeLessThan(1e-9);
    }
  });

  it('dragging a child inside a rotated group leaves the sibling untouched', () => {
    const { tree, g, a, b } = makeTree();
    const siblingBefore = getElementWorldSkeleton(tree, b);
    const target = translateSkeleton(getElementWorldSkeleton(tree, a), { x: 50, y: 0 });
    for (let frame = 0; frame < 6; frame++) {
      const m = getElementWorldMatrix(tree, a);
      const records = applySkeletonInPlace(a, target, m);
      writeRecords(records);
      for (const { el } of records) compensate(el);
      compensate(g);
      expect(skeletonError(getElementWorldSkeleton(tree, a), target)).toBeLessThan(1e-9);
      expect(skeletonError(getElementWorldSkeleton(tree, b), siblingBefore)).toBeLessThan(1e-9);
    }
  });
});

describe('adjustLocalBBoxForNewTransformOrigin (groups, mixed origin modes)', () => {
  it('is visually lossless for a relative-origin group containing an absolute-origin child', () => {
    const relChild = makeShape(100, 100, 120, 80, rotateDEG(150), [0.5, 0.5]);
    const absChild = makeShape(260, 140, 90, 90, compose(rotateDEG(40), scale(0.7, 1.4)), null);
    const nested = makeGroup([makeShape(50, 300, 60, 60, rotateDEG(-70), [0.25, 0.75])], rotateDEG(20), [0.5, 0.5]);
    const g = makeGroup([relChild, absChild, nested], compose(translate(40, 20), rotateDEG(150)), [0.5, 0.5]);
    const tree: SimpleElement<Meta>[] = [g];

    const leaves = Array.from(collectAllElements(tree)).filter((el) => el.type === 'shape');
    const before = leaves.map((el) => getElementWorldSkeleton(tree, el));

    compensate(g);

    const after = leaves.map((el) => getElementWorldSkeleton(tree, el));
    for (let i = 0; i < leaves.length; i++) {
      expect(skeletonError(before[i], after[i])).toBeLessThan(1e-9);
    }
    // and the group origin must sit on the rel2abs fixpoint of its derived bbox
    const rederived = rel2absTransformOrigin(g.relativeOrigin!, getElementLocalBBox(g));
    expect(Math.hypot(rederived.x - g.transformOrigin.x, rederived.y - g.transformOrigin.y)).toBeLessThan(1e-9);
  });

  it('keeps the legacy behavior for absolute-origin-only trees (regression)', () => {
    const childA = makeShape(100, 100, 120, 80, rotateDEG(35), null);
    const childB = makeShape(260, 140, 90, 90, scale(1.3, 0.6), null);
    const g = makeGroup([childA, childB], rotateDEG(70), null);
    const tree: SimpleElement<Meta>[] = [g];

    const before = [childA, childB].map((el) => getElementWorldSkeleton(tree, el));
    const newOrigin = { x: 500, y: -80 };
    const { changes, transformOriginAbs } = adjustLocalBBoxForNewTransformOrigin(g, newOrigin);
    writeRecords(changes);
    g.transformOrigin = transformOriginAbs;

    const after = [childA, childB].map((el) => getElementWorldSkeleton(tree, el));
    for (let i = 0; i < before.length; i++) {
      expect(skeletonError(before[i], after[i])).toBeLessThan(1e-9);
    }
  });
});
