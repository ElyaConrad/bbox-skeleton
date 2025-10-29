import { applyToPoint, inverse, Matrix } from 'transformation-matrix';
import { type Skeleton } from './graphic';

function transformSkeleton(skeleton: Skeleton, matrix: Matrix): Skeleton {
  return skeleton.map((point) => applyToPoint(matrix, point)) as Skeleton;
}

export function getAspectRatioOfSkeleton(skeleton: Skeleton, worldTransformMatrix: Matrix) {
  const inverseMatrix = inverse(worldTransformMatrix);
  const normalizedSkeleton = transformSkeleton(skeleton, inverseMatrix);

  const width = Math.abs(normalizedSkeleton[1].x - normalizedSkeleton[0].x);
  const height = Math.abs(normalizedSkeleton[3].y - normalizedSkeleton[0].y);

  return width / height;
}

export function projectSkeletonFromCorner(
  baseSkeleton: Skeleton,
  worldTransformMatrix: Matrix,
  handleIndex: number,
  handlePos: PointObjectNotation,
  aspectRatio: number | null
) {
  const inverseMatrix = inverse(worldTransformMatrix);
  const normalizedSkeleton = transformSkeleton(baseSkeleton, inverseMatrix);
  const normalizedHandlePos = applyToPoint(inverseMatrix, handlePos);

  const baseWidth = normalizedSkeleton[(handleIndex + 2) % 4].x - normalizedHandlePos.x;
  const baseHeight = normalizedSkeleton[(handleIndex + 2) % 4].y - normalizedHandlePos.y;

  const width = Math.abs(baseWidth);
  const height = Math.abs(baseHeight);

  const currAspectRatio = width / height;

  let adjustedWidth = width;
  let adjustedHeight = height;

  if (aspectRatio !== null) {
    // Adjust width and height in the cover mode, which means that the aspect ratio is preserved and the smaller dimension is enlarged
    if (currAspectRatio > aspectRatio) {
      // Width is too big, adjust height
      adjustedHeight = width / aspectRatio;
    } else {
      // Height is too big, adjust width
      adjustedWidth = height * aspectRatio;
    }
  }
  // Handle Incices:
  // 0: top-left
  // 1: top-right
  // 2: bottom-right
  // 3: bottom-left

  let top: number, left: number, right: number, bottom: number;

  if (handleIndex === 0) {
    bottom = normalizedSkeleton[2].y;
    right = normalizedSkeleton[2].x;
    left = right - adjustedWidth * Math.sign(baseWidth);
    top = bottom - adjustedHeight * Math.sign(baseHeight);
  } else if (handleIndex === 1) {
    bottom = normalizedSkeleton[3].y;
    left = normalizedSkeleton[3].x;
    right = left + adjustedWidth * -Math.sign(baseWidth);
    top = bottom - adjustedHeight * Math.sign(baseHeight);
  } else if (handleIndex === 2) {
    top = normalizedSkeleton[0].y;
    left = normalizedSkeleton[0].x;
    right = left + adjustedWidth * -Math.sign(baseWidth);
    bottom = top + adjustedHeight * -Math.sign(baseHeight);
  } else if (handleIndex === 3) {
    top = normalizedSkeleton[1].y;
    right = normalizedSkeleton[1].x;
    left = right - adjustedWidth * Math.sign(baseWidth);
    bottom = top + adjustedHeight * -Math.sign(baseHeight);
  } else {
    throw new Error('Invalid handle index');
  }

  const newSkeleton = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ] as Skeleton;

  const projectedSkeleton = transformSkeleton(newSkeleton, worldTransformMatrix);

  return {
    testPoints: [],
    skeleton: projectedSkeleton,
  };
}

export function projectSkeletonFromEdge(
  baseSkeleton: Skeleton,
  worldTransformMatrix: Matrix,
  edgeIndex: number,
  handlePos: PointObjectNotation,
  aspectRatio: number | null
) {
  const inverseMatrix = inverse(worldTransformMatrix);
  const normalizedSkeleton = transformSkeleton(baseSkeleton, inverseMatrix);
  const normalizedHandlePos = applyToPoint(inverseMatrix, handlePos);



  let top: number, left: number, right: number, bottom: number;

  if (edgeIndex === 0) {
    bottom = normalizedSkeleton[2].y;
    top = normalizedHandlePos.y;
    const baseHeight = top - bottom;

    if (aspectRatio !== null) {
      const adjustedWidth = Math.abs(baseHeight) * aspectRatio;
      const centerX = (normalizedSkeleton[0].x + normalizedSkeleton[1].x) / 2;
      left = centerX - adjustedWidth / 2;
      right = centerX + adjustedWidth / 2;

    }
    else {
        left = normalizedSkeleton[3].x;
        right = normalizedSkeleton[1].x;
    }
    
  } else if (edgeIndex === 1) {
    left = normalizedSkeleton[3].x;
    right = normalizedHandlePos.x;
    const baseWidth = right - left;

    if (aspectRatio !== null) {
      const adjustedHeight = Math.abs(baseWidth) / aspectRatio;
      const centerY = (normalizedSkeleton[1].y + normalizedSkeleton[2].y) / 2;
      top = centerY - adjustedHeight / 2;
      bottom = centerY + adjustedHeight / 2;
    }
    else {
        top = normalizedSkeleton[0].y;
        bottom = normalizedSkeleton[2].y;
    }
    
  } else if (edgeIndex === 2) {
    top = normalizedSkeleton[0].y;
    bottom = normalizedHandlePos.y;
    const baseHeight = top - bottom;

    if (aspectRatio !== null) {
      const adjustedWidth = Math.abs(baseHeight) * aspectRatio;
      const centerX = (normalizedSkeleton[0].x + normalizedSkeleton[1].x) / 2;
      left = centerX - adjustedWidth / 2;
      right = centerX + adjustedWidth / 2;
    }
    else {
        left = normalizedSkeleton[3].x;
        right = normalizedSkeleton[1].x;
    }
    
  } else if (edgeIndex === 3) {
    right = normalizedSkeleton[1].x;
    left = normalizedHandlePos.x;
    const baseWidth = right - left;

    if (aspectRatio !== null) {
      const adjustedHeight = Math.abs(baseWidth) / aspectRatio;
      const centerY = (normalizedSkeleton[1].y + normalizedSkeleton[2].y) / 2;
      top = centerY - adjustedHeight / 2;
      bottom = centerY + adjustedHeight / 2;
    }
    else {
        top = normalizedSkeleton[0].y;
        bottom = normalizedSkeleton[2].y;
    }
    
  } else {
    throw new Error('Invalid edge index');
  }

  const newSkeleton = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ] as Skeleton;

  const projectedSkeleton = transformSkeleton(newSkeleton, worldTransformMatrix);

  return {
    testPoints: [],
    skeleton: projectedSkeleton,
  };
}
