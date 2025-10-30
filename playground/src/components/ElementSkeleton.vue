<template>
  <g :data-element-id="element.meta.bluepicElement.id">
    <rect v-bind="composeBBox(localBBox)" :data-x="localBBox.x" class="local-bbox" />
    <path v-if="elementSkeleton" :d="pathifySkeleton(elementSkeleton)" class="element-skeleton" />
    <path v-if="newWorldSkeleton" :d="pathifySkeleton(newWorldSkeleton)" class="new-world-skeleton" />
    <path :d="pathifySkeleton(worldSkeleton)" class="world-skeleton" />
    <g v-if="worldSkeleton" class="draggable-points" :style="{ '--angle': `${worldRotationRadians}rad` }">
      <draggable-point
        v-for="(point, index) in worldSkeleton"
        :key="index"
        :x="composePointAbs(point.x, point.y)[0]"
        :y="composePointAbs(point.x, point.y)[1]"
        :size="10"
        :angle="worldRotationRadians"
        @mousedown="handlePointMousedown($event, cornerHandles[index])"
      />
      <draggable-point
        v-for="(point, index) in worldSkeletonCenterPointsOfEdges"
        :key="index"
        :x="composePointAbs(point.x, point.y)[0]"
        :y="composePointAbs(point.x, point.y)[1]"
        :size="10"
        :angle="worldRotationRadians"
        @mousedown="handlePointMousedown($event, edgeHandles[index])"
      />
    </g>
    <circle
      :cx="composePointAbs(element.transformOrigin.x, element.transformOrigin.y)[0]"
      :cy="composePointAbs(element.transformOrigin.x, element.transformOrigin.y)[1]"
      r="5"
      class="transform-origin-indicator"
    />
  </g>
</template>

<script setup lang="ts">
import { type ElementBBox, type ElementChangeRecord, applySkeletonInPlace, getElementLocalBBox, getElementSkeleton, getElementWorldMatrix, getElementWorldSkeleton, Skeleton } from 'bbox-skeleton';
import { SimpleElementWithBluepicMeta } from '../controllers/bluepicWYSIWYG';
import { computed, onUnmounted, ref, watch, watchEffect } from 'vue';
import { cornerHandles, edgeHandles, extractRotationRadians, Handle, useRectDrag } from '../controllers/rectDrag';
import { watchAsyncViaAnimationFrame } from '../util/debounce';
import DraggablePoint from './DraggablePoint.vue';

const props = defineProps<{
  element: SimpleElementWithBluepicMeta;
  fullTreeContext: SimpleElementWithBluepicMeta[];
  canvasWidth: number;
  canvasHeight: number;
  composePoint: (x: number, y: number) => [number, number];
  clientCoordinatesToCanvasCoordinates: (clientX: number, clientY: number) => [number, number];
}>();
const emit = defineEmits<{
  'elements:update': [changeRecords: ElementChangeRecord<SimpleElementWithBluepicMeta['meta']>[]];
}>();

const localBBox = computed(() => {
  return getElementLocalBBox(props.element);
});
const elementSkeleton = computed(() => {
  return getElementSkeleton(props.element);
})

const worldSkeleton = computed(() => {
  return getElementWorldSkeleton(props.fullTreeContext, props.element);
});
const worldTransformationMatrix = computed(() => {
  return getElementWorldMatrix(props.fullTreeContext, props.element);
});
const worldRotationRadians = computed(() => {
  return extractRotationRadians(worldTransformationMatrix.value);
});

const newWorldSkeleton = ref<Skeleton>();

const { handleMousedown, handleMousemove, handleMouseup } = useRectDrag(worldSkeleton, worldTransformationMatrix, (freshSkeleton) => {
  newWorldSkeleton.value = freshSkeleton;
});

function handlePointMousedown(event: MouseEvent, handle: Handle) {
  if (!worldSkeleton.value) return;
  const [canvasX, canvasY] = props.clientCoordinatesToCanvasCoordinates(event.clientX, event.clientY);
  handleMousedown(canvasX, canvasY, event, handle);
}
let currentMousemoveEvent: MouseEvent | null = null;
const latestMouseClientPos = ref<{ x: number; y: number } | null>(null);
function handleGlobalMousemove(event: MouseEvent) {
  const [canvasX, canvasY] = props.clientCoordinatesToCanvasCoordinates(event.clientX, event.clientY);
  latestMouseClientPos.value = { x: canvasX, y: canvasY };
  currentMousemoveEvent = event;
}
const stopWatch = watchAsyncViaAnimationFrame(latestMouseClientPos, (newPos: { x: number; y: number } | null) => {
  if (!newPos) return;
  const [canvasX, canvasY] = [newPos.x, newPos.y];
  // Handle the new mouse position
  handleMousemove(canvasX, canvasY, currentMousemoveEvent!);
});
onUnmounted(() => {
  stopWatch();
});
function handleGlobalMouseup(event: MouseEvent) {
  handleMouseup(event);
}
window.addEventListener('mouseup', handleGlobalMouseup);
window.addEventListener('mousemove', handleGlobalMousemove);

onUnmounted(() => {
  window.removeEventListener('mouseup', handleGlobalMouseup);
  window.removeEventListener('mousemove', handleGlobalMousemove);
});

function updateSkeletonReactively() {
  if (!newWorldSkeleton.value) return;
  const changeRecords = applySkeletonInPlace(props.element, newWorldSkeleton.value, worldTransformationMatrix.value);
  emit('elements:update', changeRecords);
}
watch(newWorldSkeleton, () => {
  updateSkeletonReactively();
});

const handleKeydown = (event: KeyboardEvent) => {
  const Lpressed = event.key === 'l' || event.key === 'L';
  if (Lpressed) {
    updateSkeletonReactively();
  }
};
window.addEventListener('keydown', handleKeydown);
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

const worldSkeletonCenterPointsOfEdges = computed(() => {
  if (!worldSkeleton.value) return [];
  const p0 = worldSkeleton.value[0];
  const p1 = worldSkeleton.value[1];
  const p2 = worldSkeleton.value[2];
  const p3 = worldSkeleton.value[3];
  return [
    { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 },
    { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
    { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 },
    { x: (p3.x + p0.x) / 2, y: (p3.y + p0.y) / 2 },
  ];
});

const composePointAbs = (x: number, y: number) => {
  const xRel = x / props.canvasWidth;
  const yRel = y / props.canvasHeight;

  return props.composePoint(xRel, yRel);
};

const composeBBox = (bbox: ElementBBox) => {
  const [x, y] = composePointAbs(bbox.x, bbox.y);
  const [xMax, yMax] = composePointAbs(bbox.x + bbox.width, bbox.y + bbox.height);
  return { x, y, width: xMax - x, height: yMax - y };
};

function pathifySkeleton(points: PointObjectNotation[]) {
  if (points.length === 0) return '';
  return `M${points.map((pt) => composePointAbs(pt.x, pt.y)).join(' L')} Z`;
}


</script>

<style scoped lang="scss">
.local-bbox {
  fill: none;
  stroke: #000;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
  stroke-width: 1px;
}
.element-skeleton {
  fill: rgba(255, 0, 0, 0.1);
  stroke: rgba(255, 0, 0, 1);
  stroke-width: 1px;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
}
.world-skeleton {
  fill: rgba(0, 0, 255, 0);
  stroke: rgba(0, 0, 255, 1);
  stroke-width: 1px;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
}
.new-world-skeleton {
  fill: rgba(0, 0, 255, 0.1);
  stroke: rgba(0, 0, 255, 1);
  stroke-width: 1px;
  stroke-dasharray: 4 2;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
}
.new-local-skeleton {
  fill: rgba(0, 255, 0, 0.1);
  stroke: #0f0;
  stroke-width: 1px;
  stroke-dasharray: 4 2;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
}
.transform-origin-indicator {
  fill: rgb(255, 67, 126);
  stroke: #ffff;
  stroke-width: 1px;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
}
</style>
