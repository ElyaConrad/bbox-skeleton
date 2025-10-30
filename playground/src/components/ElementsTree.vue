<template>
  <div class="elements-tree" :style="{ '--level': level }">
    <div v-for="element in elements" class="element-item" :class="{ selected: selected === element.meta.bluepicElement.id }">
      <div class="element-body" @click="selectElement(element.meta.bluepicElement.id)">
        <div class="element-id-wrapper">
          <div class="element-id">
            {{ element.meta.bluepicElement.id }}
          </div>
          <div v-if="element.type === 'shape'" class="coords">
            x: {{ round(element.x, 4) }}, y: {{ round(element.y, 4) }}, w: {{ round(element.width, 4) }}, h: {{ round(element.height, 4) }}
          </div>

          <div class="transform-origin">
            Transform origin: {{ round(element.transformOrigin.x, 4) }}, y: {{ round(element.transformOrigin.y, 4) }}
          </div>
                 <div class="transform">
            {{ getTransformCSSString(element) }}
          </div>
        </div>
      </div>
      <div v-if="element.type === 'group'" class="element-children-wrapper">
        <elements-tree :elements="element.children" :level="level + 1" @select="selectElement" :selected="selected" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'ElementsTree',
};
</script>

<script setup lang="ts">
import { SimpleElement } from 'bbox-skeleton';
import { SimpleElementWithBluepicMeta } from '../controllers/bluepicWYSIWYG';
import { Matrix } from 'transformation-matrix';
import { round } from 'lodash';

const props = defineProps<{
  elements: SimpleElementWithBluepicMeta[];
  selected: string;
  level: number;
}>();

const emit = defineEmits<{
  select: [element: string];
}>();

const getTransformCSSString = (element: SimpleElementWithBluepicMeta) => {
    const {a, b, c, d, e, f} =  element.coreTransform;

    return `matrix(${round(a, 4)}, ${round(b, 4)}, ${round(c, 4)}, ${round(d, 4)}, ${round(e, 4)}, ${round(f, 4)})`;
}

const selectElement = (id: string) => {
    emit('select', id);
}
</script>

<style scoped lang="scss">
.elements-tree {
  .element-item {
    margin-top: 4px;

    .element-body {
        cursor: pointer;
      padding: 2px 4px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: #f9f9f9;

      .element-id-wrapper {
        padding: 5px;
        font-size: 0.9em;
        display: flex;
        flex-direction: column;
        .element-id {
          font-weight: bold;
          margin-bottom: 5px;
        }
        .coords {
          font-family: monospace;
          color: #666;
        }
        .transform-origin {
          font-family: monospace;
          color: #666;
          font-size: 1em;
        }
        .transform {
          font-family: monospace;
          color: #666;
          font-size: 1em;
        }
      }
    }
    &.selected {
      > .element-body {
        border-color: #007BFF;
        background-color: #E7F1FF;
      }
    }

    .element-children-wrapper {
      padding: 0 0 0 20px;
    }
  }
}
</style>
