<template>
  <g class="draggable-point" :style="{ '--x': x, '--y': y, '--angle': `${angle}rad` }">
    <circle :cx="x" :cy="y" :r="size / 2" />
  </g>
</template>

<script setup lang="ts">
const props = defineProps<{
  x: number;
  y: number;
  size: number;
  angle: number;
}>();
</script>

<style scoped lang="scss">
.draggable-point {
  cursor: pointer;
  pointer-events: all;
  circle {
    fill: rgb(67, 126, 255);
    stroke: #fff;
    stroke-width: 1px;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
  }
  &:active circle {
    fill: rgb(59, 108, 213);
  }
  rect {
    fill: rgb(67, 126, 255);
    stroke: #fff;
    stroke-width: 1px;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
    cursor: pointer;
    pointer-events: all;
    transform-origin: 50% 50%;
    transform-box: fill-box;
    transform: translate(-50%, -50%) rotate(var(--angle));
    &:active {
      fill: rgb(59, 108, 213);
    }
  }
}
</style>
