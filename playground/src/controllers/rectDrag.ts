import { Ref, ref } from 'vue';
import { Matrix } from 'transformation-matrix';
import { getAspectRatioOfSkeleton, projectSkeletonFromCorner, projectSkeletonFromEdge } from 'bbox-skeleton';
import type { Skeleton } from 'bbox-skeleton';
import {cloneDeep} from 'lodash';

export type CornerHandle = 'tl' | 'tr' | 'br' | 'bl';
export type EdgeHandle = 't' | 'r' | 'b' | 'l';
export type Handle = CornerHandle | EdgeHandle;
export const cornerHandles: CornerHandle[] = ['tl', 'tr', 'br', 'bl'];
export const edgeHandles: EdgeHandle[] = ['t', 'r', 'b', 'l'];


export function extractRotationRadians({ a, b, c, d }: Matrix): number {
  // Achtung auf numerische Stabilität bei extremen Skalen, aber atan2 ist robust.
  return Math.atan2(b - c, a + d);
}




export function useRectDrag(elementWorldSkeleton: Ref<Skeleton>,elementWorldTransformMatrix: Ref<Matrix>, enforceAspectRatio: boolean, callback: (newSkeleton: Skeleton) => void) {
  const testPoints = ref<PointObjectNotation[]>([]);

  let dragStartPos: PointObjectNotation | null = null;
  let activeHandle: Handle | null = null;
  let skeletonAtDragStart: [PointObjectNotation, PointObjectNotation, PointObjectNotation, PointObjectNotation] | null = null;
  let aspectRatioOnDragStart = 1;
  const handleMousedown = (
    x: number,
    y: number,
    event: MouseEvent | TouchEvent,
    handle: Handle,
  ) => {
    dragStartPos = { x, y };
    activeHandle = handle;
    skeletonAtDragStart = cloneDeep(elementWorldSkeleton.value);

    aspectRatioOnDragStart = getAspectRatioOfSkeleton(skeletonAtDragStart, elementWorldTransformMatrix.value);

    event.preventDefault();
    event.stopPropagation();
  };
  const handleMousemove = (x: number, y: number, event: MouseEvent | TouchEvent) => {
    if (dragStartPos && activeHandle && skeletonAtDragStart) {
      const handlePos = { x, y };

      if (cornerHandles.includes(activeHandle as CornerHandle)) {
        const handleIndex = cornerHandles.indexOf(activeHandle as CornerHandle);

        const { testPoints: newTestPoints, skeleton: newSkeleton } = projectSkeletonFromCorner(skeletonAtDragStart, elementWorldTransformMatrix.value, handleIndex, handlePos, (event.shiftKey || enforceAspectRatio) ? aspectRatioOnDragStart : null);
        testPoints.value = newTestPoints;
        callback(newSkeleton);

      } else {
        // Edge handle
        const handleIndex = edgeHandles.indexOf(activeHandle as EdgeHandle);


        const { testPoints: newTestPoints, skeleton: newSkeleton } = projectSkeletonFromEdge(skeletonAtDragStart, elementWorldTransformMatrix.value, handleIndex, handlePos, (event.shiftKey || enforceAspectRatio) ? aspectRatioOnDragStart : null);
        testPoints.value = newTestPoints;
        callback(newSkeleton);
       
      }
    }
    event.preventDefault();
    event.stopPropagation();
  };
  const handleMouseup = () => {
    dragStartPos = null;
    activeHandle = null;
    skeletonAtDragStart = null;
  };
  return {
    handleMousedown,
    handleMousemove,
    handleMouseup,
    testPoints,
  };
}
