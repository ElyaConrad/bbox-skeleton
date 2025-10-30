import { applyToPoint, compose, identity, inverse, Matrix } from 'transformation-matrix';
import { applyLinearPartOfMatrix, bakeOriginIntoMatrix, computeOriginCompensationDelta, type ElementBBox, type Skeleton } from './graphic';

export type SimpleElementMeta = { [k: string]: unknown };

export type SimpleElementShape<Meta extends SimpleElementMeta = {}> = {
  type: 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  coreTransform: Matrix;
  transformOrigin: PointObjectNotation;
  meta: Meta;
};
export type SimpleElementGroup<Meta extends SimpleElementMeta = {}> = {
  type: 'group';
  children: SimpleElement<Meta>[];
  coreTransform: Matrix;
  transformOrigin: PointObjectNotation;
  meta: Meta;
};
export type SimpleElement<Meta extends SimpleElementMeta = {}> = SimpleElementShape<Meta> | SimpleElementGroup<Meta>;

export type ElementChangeRecord<Meta extends SimpleElementMeta> = {
  el: SimpleElementShape<Meta>;
  newLocalBBox: ElementBBox;
};

// Generator to iterate over all elements in a slot, including those nested in groups
export function* collectAllElements<Meta extends SimpleElementMeta>(slot: SimpleElement<Meta>[]): Generator<SimpleElement<Meta>> {
  for (const element of slot) {
    yield element;
    if (element.type === 'group') {
      yield* collectAllElements(element.children);
    }
  }
}
// Find an element in the global slot (including nested groups) that matches a given predicate function
export function findElement<Meta extends SimpleElementMeta>(globalSlot: SimpleElement<Meta>[], predicateFn: (element: SimpleElement<Meta>) => boolean) {
  for (const element of collectAllElements(globalSlot)) {
    if (predicateFn(element)) {
      return element;
    }
  }
  return null;
}

// Find the parent group of a given element in the global slot
export function getElementParent<Meta extends SimpleElementMeta>(globalSlot: SimpleElement<Meta>[], element: SimpleElement<Meta>) {
  return findElement(globalSlot, (currElement) => {
    return currElement.type === 'group' && currElement.children.includes(element);
  }) as SimpleElementGroup<Meta> | null;
}

// Get an array of elements representing the ancestry from the given element up to the root in the global slot
export function getElementAncestry<Meta extends SimpleElementMeta>(globalSlot: SimpleElement<Meta>[], element: SimpleElement<Meta>): SimpleElement<Meta>[] {
  const parentElement = getElementParent(globalSlot, element);
  return [element, ...(parentElement ? getElementAncestry(globalSlot, parentElement) : [])];
}

export function getBakedTransformMatrix(element: SimpleElement) {
  return bakeOriginIntoMatrix(element.coreTransform, element.transformOrigin);
}

// Calculate the local bounding box of an element (the one without any transformations applied)
export function getElementLocalBBox(element: SimpleElement): ElementBBox {
  if (element.type === 'shape') {
    const { x, y, width, height } = element;
    return { x, y, width, height };
  } else {
    const allChildrenSkeletons = element.children.map(getElementSkeleton);
    const allPoints = allChildrenSkeletons.flat();
    const xs = allPoints.map((pt) => pt.x);
    const ys = allPoints.map((pt) => pt.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}

// Get the base skeleton (corners) of an element: The local bbox as four corner points
export function getElementBaseSkeleton(element: SimpleElement): Skeleton {
  const localBBox = getElementLocalBBox(element);
  const baseSkeleton: Skeleton = [
    { x: localBBox.x, y: localBBox.y },
    { x: localBBox.x + localBBox.width, y: localBBox.y },
    { x: localBBox.x + localBBox.width, y: localBBox.y + localBBox.height },
    { x: localBBox.x, y: localBBox.y + localBBox.height },
  ];
  return baseSkeleton;
}

// Get the skeleton of an element transformed by its local transformation matrix
export function getElementSkeleton(element: SimpleElement): Skeleton {
  const baseSkeleton = getElementBaseSkeleton(element);
  const transformMatrix = getBakedTransformMatrix(element);
  return baseSkeleton.map((pt) => applyToPoint(transformMatrix, pt)) as Skeleton;
}

// Get the combined transformation matrix of an element by composing the transformation matrices of all its ancestors
export function getElementWorldMatrix(globalSlot: SimpleElement[], element: SimpleElement): Matrix {
  const ancestry = getElementAncestry(globalSlot, element);

  const matrices = ancestry.map(getBakedTransformMatrix).reverse();

  return compose(identity(), ...matrices);
}

// Get the world skeleton of an element by applying its world transformation matrix to its base skeleton
export function getElementWorldSkeleton(globalSlot: SimpleElement[], element: SimpleElement): Skeleton {
  const elementBaseSkeleton = getElementBaseSkeleton(element);
  const combinedMatrix = getElementWorldMatrix(globalSlot, element);
  return elementBaseSkeleton.map((pt) => applyToPoint(combinedMatrix, pt)) as Skeleton;
}
// Go back to a bounding box from a skeleton
export function calcBBoxFromSkeleton(skel: Skeleton): ElementBBox {
  const xs = skel.map((p) => p.x);
  const ys = skel.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Move a skeleton by a given delta vector
export function translateSkeleton(skeleton: Skeleton, delta: PointObjectNotation): Skeleton {
  return skeleton.map((pt) => ({
    x: pt.x + delta.x,
    y: pt.y + delta.y,
  })) as Skeleton;
}

export function applySkeletonInPlace<Meta extends SimpleElementMeta>(el: SimpleElement<Meta>, newSkeleton: Skeleton, skeletonMatrix: Matrix): ElementChangeRecord<Meta>[] {
  const inverseMatrix = inverse(skeletonMatrix);
  const newSkeletonInLocalCoords = newSkeleton.map((pt) => applyToPoint(inverseMatrix, pt)) as Skeleton;

  const newSkeletonAsLocalBBox = calcBBoxFromSkeleton(newSkeletonInLocalCoords);
  if (el.type === 'group') {
    const oldLocalBBox = getElementLocalBBox(el);
    const newChildSkeletons = el.children
      .map((childEl) => {
        // Get child's skeleton in local coords of parent
        const childSkeletonInParent = getElementSkeleton(childEl);
        // Convert to relative coords
        const childSkeletonWithRelativeCoords = childSkeletonInParent.map((point) => {
          const relX = (point.x - oldLocalBBox.x) / oldLocalBBox.width;
          const relY = (point.y - oldLocalBBox.y) / oldLocalBBox.height;
          return { x: relX, y: relY };
        }) as Skeleton;
        // Apply new skeleton mapped within new parent bbox
        const childSkeletonRemapped = childSkeletonWithRelativeCoords.map((relPoint) => {
          return {
            x: newSkeletonAsLocalBBox.x + relPoint.x * newSkeletonAsLocalBBox.width,
            y: newSkeletonAsLocalBBox.y + relPoint.y * newSkeletonAsLocalBBox.height,
          };
        }) as Skeleton;

        const localMatrixInContextOfChildhood = getBakedTransformMatrix(childEl);

        return applySkeletonInPlace(childEl, childSkeletonRemapped, localMatrixInContextOfChildhood);
      })
      .filter((skel) => skel !== undefined);

    return newChildSkeletons.flat();
  } else {
    return [
      {
        el,
        newLocalBBox: calcBBoxFromSkeleton(newSkeletonInLocalCoords),
      },
    ];
  }
}


export function adjustLocalBBoxForNewTransformOrigin<Meta extends SimpleElementMeta>(
  element: SimpleElement<Meta>,
  newOriginAbs: PointObjectNotation
): {
  changes: ElementChangeRecord<Meta>[];
  transformOriginAbs: PointObjectNotation;
} {
  // Calculate compensation delta which needs to be applied to geometry
  const delta = computeOriginCompensationDelta(element.coreTransform, element.transformOrigin, newOriginAbs);

  // Compensate the geometry
  const changes = (() => {
    if (element.type === 'shape') {
      // In case of shape: Simple shift of base skeleton
      const baseSkeleton = getElementBaseSkeleton(element);
      const shiftedSkeleton = translateSkeleton(baseSkeleton, delta);
      return applySkeletonInPlace(element, shiftedSkeleton, identity());
    } else {
      // In case of group: Shift all children's skeletons in parent coordinates accordingly
      return element.children.flatMap((child) => {
        // The child skeleton in parent coordinates (without upper transformations)
        const childSkeletonInParent = getElementSkeleton(child);

        // Shift in parent coordinates
        const childSkeletonShifted = translateSkeleton(childSkeletonInParent, delta);

        // Recusively apply to child
        return applySkeletonInPlace(child, childSkeletonShifted, getBakedTransformMatrix(child));
      });
    }
  })();

  return {
    changes,
    transformOriginAbs: newOriginAbs,
  };
}

// This function will compute the new absolute transform-origin based on the given relative origin via matrix coefficients
export function adjustLocalBBoxForNewTransformOriginRelative<Meta extends SimpleElementMeta>(
  element: SimpleElement<Meta>,
  relativeOrigin: [number, number]
): {
  changes: ElementChangeRecord<Meta>[];
  transformOriginAbs: PointObjectNotation;
} {
  const [rx, ry] = relativeOrigin;

  // Get inverse core matrix coefficients
  const invCore = inverse(element.coreTransform);
  const A = invCore.a - 1; // (M^{-1} - I)_xx
  const B = invCore.c; // (M^{-1} - I)_xy
  const C = invCore.b; // (M^{-1} - I)_yx
  const D = invCore.d - 1; // (M^{-1} - I)_yy

  // o_neu = bbox.topLeft + d + r * bbox.size
  // d = (M^{-1} - I) · (o_alt - o_neu)
  // M^{-1} · o_neu = bbox.topLeft + (M^{-1} - I) · o_alt + r * bbox.size

  // Get current local bbox
  const currentLocalBBox = getElementLocalBBox(element);

  const rhs_x = currentLocalBBox.x + A * element.transformOrigin.x + B * element.transformOrigin.y + rx * currentLocalBBox.width;
  const rhs_y = currentLocalBBox.y + C * element.transformOrigin.x + D * element.transformOrigin.y + ry * currentLocalBBox.height;

  // o_neu = M · rhs (da M^{-1} · o_neu = rhs)
  const newOriginAbs = applyLinearPartOfMatrix(element.coreTransform, { x: rhs_x, y: rhs_y });

  // Call the general function to perform the adjustment
  return adjustLocalBBoxForNewTransformOrigin(element, newOriginAbs);
}
