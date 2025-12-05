===== FILE DUMP START =====

### FILE: ./playground/index.html ###
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + Vue + TS</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### FILE: ./playground/vite.config.ts ###
```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
})
```

### FILE: ./playground/src/App.vue ###
```vue
<template>
  <div class="root">
    <header>
      <div class="element-selector">
        Element:
        <select v-model="selectedElementId">
          <option v-for="element in allElementsOptions" :key="element.value" :value="element.value">
            {{ element.label }}
          </option>
        </select>
      </div>
      <div class="set-origin-wrapper">
        Set absolute origin:
        <input v-model="absOriginX" />
        <input v-model="absOriginY" />
        <button @click="setAbsOrigin">Set</button>
      </div>
      <div class="set-origin-wrapper">
        Set relative origin:
        <input v-model="relOriginX" />
        <input v-model="relOriginY" />
        <button @click="setRelOrigin">Set</button>
      </div>
    </header>
    <main>
      <zoompinch
        ref="zoompinchRef"
        v-model:transform="transform"
        :width="1080"
        :height="1080"
        :offset="offset"
        :min-scale="0.1"
        :max-scale="10"
        :rotation="false"
        :bounds="false"
        :mouse="false"
        :touch="false"
        :wheel="true"
        :gesture="true"
        @drag-gesture-start="handleDragGestureStart"
        @drag-gesture-end="handleDragGestureEnd"
      >
        <template #canvas>
          <serial-wrapper
            :key="state"
            :serial="serial"
            :mode="'preview'"
            :load-fonts="true"
            @mounted="onSerialPreviewMounted"
            @unmounted="onSerialPreviewUnmounted"
            v-model:ready="ready"
            v-model:element-scope-information="elementScopeInformation"
            v-model:global-scope="liveGlobalScope"
          />
        </template>
        <template #matrix="{ composePoint, clientCoordinatesToCanvasCoordinates }">
          <svg xmlns="http://www.w3.org/2000/svg" @dblclick="handleDblClick($event, clientCoordinatesToCanvasCoordinates)" style="pointer-events: all">
            <template v-for="simpleElement in allSimpleElements">
              <element-skeleton
                v-if="simpleElement.meta.bluepicElement.id === selectedElementId"
                :element="simpleElement"
                :full-tree-context="allSimpleElements"
                :canvas-width="serial.width"
                :canvas-height="serial.height"
                :compose-point="composePoint"
                :clientCoordinatesToCanvasCoordinates="clientCoordinatesToCanvasCoordinates"
                @elements:update="handleElementsChangeRecords"
              />
              <g>
                <circle v-for="p in testPoints" :cx="composePointAbs(p.x, p.y, composePoint)[0]" :cy="composePointAbs(p.x, p.y, composePoint)[1]" r="5" class="test-point" />
              </g>
            </template>
          </svg>
        </template>
      </zoompinch>
      <div class="context-tree-wrapper">
        <elements-tree :elements="lazyElementsTree" :level="0" @select="selectedElementId = $event" :selected="selectedElementId" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
// @ts-expect-error no types
import { Zoompinch } from 'zoompinch';
import 'zoompinch/style.css';
import { SerialWrapper } from '@bluepic/core';
import '@bluepic/core/style.css';
import testSerial from './assets/template_1.json';
import { Template } from '@bluepic/types';
import { nanoid } from 'nanoid';
import { convertBluepicSerialElementsTreeToSimplifiedElementsTree, ElementScopeInformation, evalExpression, retrieveElementScope, setPrimitiveElementLocalBBox, SimpleElementWithBluepicMeta } from './controllers/bluepicWYSIWYG';
// import { collectAllElements, ElementBBox, ElementChangeRecord, findElement, getElementLocalBBox, adjustLocalBBoxForNewTransformOrigin, adjustLocalBBoxForNewTransformOriginRelative } from './controllers/wysiwyg';
import { type ElementBBox, type SimpleElement, type ElementChangeRecord, collectAllElements, findElement, getElementAncestry, getElementLocalBBox, adjustLocalBBoxForNewTransformOrigin, adjustLocalBBoxForNewTransformOriginRelative } from 'bbox-skeleton';
import ElementSkeleton from './components/ElementSkeleton.vue';
import { watchAsyncViaAnimationFrame } from './util/debounce';
import ElementsTree from './components/ElementsTree.vue';

const selectedElementId = ref<string>('group4');
const absOriginX = ref<string>('0');
const absOriginY = ref<string>('0');

const relOriginX = ref<string>('0.5');
const relOriginY = ref<string>('0.5');

function setAbsOrigin() {
  const el = findElement(allSimpleElements.value, (el) => el.meta.bluepicElement.id === selectedElementId.value) as SimpleElementWithBluepicMeta;
  if (!el) return;
  const { changes, transformOriginAbs } = adjustLocalBBoxForNewTransformOrigin(el, {
    x: Number(absOriginX.value),
    y: Number(absOriginY.value),
  });
  el.transformOrigin = transformOriginAbs;
  el.meta.bluepicElement.properties['v-transform-origin'] = {
    type: 'expression',
    value: `[${transformOriginAbs.x}, ${transformOriginAbs.y}]`,
  };
  for (const { el, newLocalBBox } of changes) {
    el.x = newLocalBBox.x;
    el.y = newLocalBBox.y;
    el.width = newLocalBBox.width;
    el.height = newLocalBBox.height;

    const bluepicElement = el.meta.bluepicElement as SimpleElementWithBluepicMeta['meta']['bluepicElement'];

    const elementScope = retrieveElementScope(fullTreeContext.value, elementScopeInformation.value, bluepicElement, []);
    if (bluepicElement.name === 'circle') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
    if (bluepicElement.name === 'rectangle') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
    if (bluepicElement.name === 'text') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
    if (bluepicElement.name === 'image') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
  }
}
function setRelOrigin() {
  const el = findElement(allSimpleElements.value, (el) => el.meta.bluepicElement.id === selectedElementId.value) as SimpleElementWithBluepicMeta;
  if (!el) return;
  const { changes, transformOriginAbs } = adjustLocalBBoxForNewTransformOriginRelative(el, [Number(relOriginX.value), Number(relOriginY.value)]);
  el.transformOrigin = transformOriginAbs;
  el.meta.bluepicElement.properties['v-transform-origin'] = {
    type: 'expression',
    value: `[${transformOriginAbs.x}, ${transformOriginAbs.y}]`,
  };
  for (const { el, newLocalBBox } of changes) {
    el.x = newLocalBBox.x;
    el.y = newLocalBBox.y;
    el.width = newLocalBBox.width;
    el.height = newLocalBBox.height;

    const bluepicElement = el.meta.bluepicElement as SimpleElementWithBluepicMeta['meta']['bluepicElement'];

    const elementScope = retrieveElementScope(fullTreeContext.value, elementScopeInformation.value, bluepicElement, []);
    if (bluepicElement.name === 'circle') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
    if (bluepicElement.name === 'rectangle') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
    if (bluepicElement.name === 'text') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
    if (bluepicElement.name === 'image') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
  }
}

(window as any).adjustLocalBBoxForNewTransformOrigin = (el: SimpleElementWithBluepicMeta, transformOrigin: PointObjectNotation) => {
  const { changes, transformOriginAbs } = adjustLocalBBoxForNewTransformOrigin(el, transformOrigin);
  el.transformOrigin = transformOriginAbs;
  el.meta.bluepicElement.properties['v-transform-origin'] = {
    type: 'expression',
    value: `[${transformOrigin.x}, ${transformOrigin.y}]`,
  };
  for (const { el, newLocalBBox } of changes) {
    el.x = newLocalBBox.x;
    el.y = newLocalBBox.y;
    el.width = newLocalBBox.width;
    el.height = newLocalBBox.height;

    const bluepicElement = el.meta.bluepicElement as SimpleElementWithBluepicMeta['meta']['bluepicElement'];

    const elementScope = retrieveElementScope(fullTreeContext.value, elementScopeInformation.value, bluepicElement, []);
    if (bluepicElement.name === 'circle') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
    if (bluepicElement.name === 'rectangle') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
    if (bluepicElement.name === 'text') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
    if (bluepicElement.name === 'image') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
  }
};
(window as any).adjustLocalBBoxForNewTransformOriginRelative = (el: SimpleElementWithBluepicMeta, transformOriginRel: [number, number]) => {
  const { changes, transformOriginAbs } = adjustLocalBBoxForNewTransformOriginRelative(el, transformOriginRel);

  el.transformOrigin = transformOriginAbs;
  el.meta.bluepicElement.properties['v-transform-origin'] = {
    type: 'expression',
    value: `[${transformOriginAbs.x}, ${transformOriginAbs.y}]`,
  };

  for (const { el, newLocalBBox } of changes) {
    el.x = newLocalBBox.x;
    el.y = newLocalBBox.y;
    el.width = newLocalBBox.width;
    el.height = newLocalBBox.height;

    const bluepicElement = el.meta.bluepicElement as SimpleElementWithBluepicMeta['meta']['bluepicElement'];

    const elementScope = retrieveElementScope(fullTreeContext.value, elementScopeInformation.value, bluepicElement, []);
    if (bluepicElement.name === 'circle') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
    if (bluepicElement.name === 'rectangle') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
    if (bluepicElement.name === 'text') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
    if (bluepicElement.name === 'image') setPrimitiveElementLocalBBox(bluepicElement, newLocalBBox, elementScope);
  }
};

const serial = ref<Template.Serial>(testSerial as any);

const zoompinchRef = ref<InstanceType<typeof Zoompinch>>();

const transform = ref({
  scale: 1,
  translateX: 0,
  translateY: 0,
  rotation: 0,
});

const offset = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const testPoints = ref<PointObjectNotation[]>([]);
const testBBoxes = ref<ElementBBox[]>([]);

const handleDragGestureStart = () => {
  console.log('Drag gesture started');
};
const handleDragGestureEnd = () => {
  console.log('Drag gesture ended');
};

const onSerialPreviewMounted = () => {
  console.log('Serial preview mounted');
};
const onSerialPreviewUnmounted = () => {
  console.log('Serial preview unmounted');
};

const state = ref(nanoid());
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'r' || event.key === 'R') {
    state.value = nanoid();
  }
};
window.addEventListener('keydown', handleKeydown);
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

const ready = ref(false);
const elementScopeInformation = ref<ElementScopeInformation>({});
const liveGlobalScope = ref<{ [k: string]: unknown }>({});
const fullTreeContext = computed(() => serial.value.context);

function handleElementsChangeRecords(changeRecords: ElementChangeRecord<SimpleElementWithBluepicMeta['meta']>[]) {

  testPoints.value = [];
  testBBoxes.value = [];

  const transformOriginsOld = new Map<SimpleElementWithBluepicMeta, PointObjectNotation>();
  const bboxesOld = new Map<SimpleElementWithBluepicMeta, ElementBBox>();

  for (const element of collectAllElements(allSimpleElements.value)) {
    const bluepicElement = element.meta.bluepicElement;
    const elementScope = retrieveElementScope(fullTreeContext.value, elementScopeInformation.value, bluepicElement, []);
    const transformOriginOld = evalExpression<[number, number]>(element.meta.bluepicElement.properties['v-transform-origin'].value, elementScope, false);
    transformOriginsOld.set(element, {
      x: transformOriginOld[0],
      y: transformOriginOld[1],
    });
    const bbox = getElementLocalBBox(element);
    bboxesOld.set(element, bbox);
  }

  const changedElements: Set<SimpleElementWithBluepicMeta> = new Set();

  for (const { el, newLocalBBox } of changeRecords) {
    el.x = newLocalBBox.x;
    el.y = newLocalBBox.y;
    el.width = newLocalBBox.width;
    el.height = newLocalBBox.height;
    // Keep track of changed elements
    changedElements.add(el);
  }

  const adjustedTransformOrigins = new Map<SimpleElementWithBluepicMeta, PointObjectNotation>();

  for (const element of Array.from(changedElements)) {
    const bluepicElement = element.meta.bluepicElement;
    const localBBox = getElementLocalBBox(element);
    // Make the primitive changes on the local bbox (x,y,width,height)
    if (bluepicElement.name === 'circle') {
      setPrimitiveElementLocalBBox(bluepicElement, localBBox, retrieveElementScope(fullTreeContext.value, elementScopeInformation.value, bluepicElement, []));
    } else if (bluepicElement.name === 'rectangle') {
      setPrimitiveElementLocalBBox(bluepicElement, localBBox, retrieveElementScope(fullTreeContext.value, elementScopeInformation.value, bluepicElement, []));
    } else if (bluepicElement.name === 'text') {
      setPrimitiveElementLocalBBox(bluepicElement, localBBox, retrieveElementScope(fullTreeContext.value, elementScopeInformation.value, bluepicElement, []));
    } else if (bluepicElement.name === 'image') {
      setPrimitiveElementLocalBBox(bluepicElement, localBBox, retrieveElementScope(fullTreeContext.value, elementScopeInformation.value, bluepicElement, []));
    }
    // Finally, update the bluepic element's transform origin property if it was adjusted
    if (adjustedTransformOrigins.has(element)) {
      const newTransformOriginAbs = adjustedTransformOrigins.get(element)!;
      // Update the bluepic element's transform origin property to reflect the new absolute transform origin
      bluepicElement.properties['v-transform-origin'] = {
        type: 'expression',
        value: `[${newTransformOriginAbs.x}, ${newTransformOriginAbs.y}]`,
      };
    }
  }
}

function handleDblClick(event: MouseEvent, clientCoordinatesToCanvasCoordinates: (clientX: number, clientY: number) => [number, number]) {
  const [canvasX, canvasY] = clientCoordinatesToCanvasCoordinates(event.clientX, event.clientY);
  console.log('Double click at canvas coordinates:', canvasX, canvasY);
}

// Elements tree representation and syncing
const computedElementsTree = computed(() => {
  return convertBluepicSerialElementsTreeToSimplifiedElementsTree(elementScopeInformation.value, serial.value.context);
});
const lazyElementsTree = ref<
  SimpleElement<{
    bluepicElement: Template.Element;
  }>[]
>(computedElementsTree.value);
(window as any).lazyElementsTree = lazyElementsTree;
watchAsyncViaAnimationFrame(computedElementsTree, () => {
  for (const element of collectAllElements(computedElementsTree.value)) {
    const correspondingElementInLazyTree = findElement(lazyElementsTree.value, (lazyElement) => lazyElement.meta.bluepicElement === element.meta.bluepicElement);
    // If any element has no corresponding element in the lazy tree, update the lazy tree to the computed one completely
    if (!correspondingElementInLazyTree) {
      lazyElementsTree.value = computedElementsTree.value;
      break;
    }

    // Otherwise, update the properties of the corresponding element that might have changed
    if (element.coreTransform.a !== correspondingElementInLazyTree.coreTransform.a) correspondingElementInLazyTree.coreTransform.a = element.coreTransform.a;
    if (element.coreTransform.b !== correspondingElementInLazyTree.coreTransform.b) correspondingElementInLazyTree.coreTransform.b = element.coreTransform.b;
    if (element.coreTransform.c !== correspondingElementInLazyTree.coreTransform.c) correspondingElementInLazyTree.coreTransform.c = element.coreTransform.c;
    if (element.coreTransform.d !== correspondingElementInLazyTree.coreTransform.d) correspondingElementInLazyTree.coreTransform.d = element.coreTransform.d;
    if (element.coreTransform.e !== correspondingElementInLazyTree.coreTransform.e) correspondingElementInLazyTree.coreTransform.e = element.coreTransform.e;
    if (element.coreTransform.f !== correspondingElementInLazyTree.coreTransform.f) correspondingElementInLazyTree.coreTransform.f = element.coreTransform.f;
    // For shapes, do this for position and size as well
    if (element.type === 'shape' && correspondingElementInLazyTree.type === 'shape') {
      if (element.x !== correspondingElementInLazyTree.x) correspondingElementInLazyTree.x = element.x;
      if (element.y !== correspondingElementInLazyTree.y) correspondingElementInLazyTree.y = element.y;
      if (element.width !== correspondingElementInLazyTree.width) correspondingElementInLazyTree.width = element.width;
      if (element.height !== correspondingElementInLazyTree.height) correspondingElementInLazyTree.height = element.height;
    }
  }
});
const allSimpleElements = computed(() => {
  return Array.from(collectAllElements(lazyElementsTree.value));
});
(window as any).allSimpleElements = allSimpleElements;

function composePointAbs(x: number, y: number, compose: (x: number, y: number) => [number, number]) {
  const canvasWidth = serial.value.width;
  const canvasHeight = serial.value.height;
  return compose(x / canvasWidth, y / canvasHeight);
}


const allElementsOptions = computed(() => {
  return allSimpleElements.value.map((el) => {
    const ancestry = getElementAncestry(lazyElementsTree.value, el);
    const id = el.meta.bluepicElement.id;
    return {
      label: `${'-'.repeat(ancestry.length - 1)}${ancestry.length > 1 ? '> ' : ''}${id}`,
      value: id,
    };
  });
});
</script>

<style lang="scss" scoped>
.root {
  width: 100%;
  height: 100%;
  padding: 0px;
  box-sizing: border-box;
  --canvas-background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxyZWN0IHg9IjAlIiB5PSIwJSIgd2lkdGg9IjUwJSIgaGVpZ2h0PSI1MCUiIHN0eWxlPSJmaWxsOiByZ2JhKDAsIDAsIDAsIDAuMSk7IiAvPgogIDxyZWN0IHg9IjUwJSIgeT0iNTAlIiB3aWR0aD0iNTAlIiBoZWlnaHQ9IjUwJSIgc3R5bGU9ImZpbGw6IHJnYmEoMCwgMCwgMCwgMC4xKTsiIC8+Cjwvc3ZnPg==');
  display: flex;
  flex-direction: column;
  > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    @media screen and (max-width: 600px) {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    .set-origin-wrapper {
      display: flex;
      align-items: center;
      gap: 10px;
      input {
        width: 60px;
      }
    }
  }
  > main {
    flex: 1;
    padding: 0 20px 20px;
    display: flex;
    gap: 20px;
    overflow: hidden;
    .context-tree-wrapper {
      width: 500px;
      height: 100%;
      overflow: auto;
      overflow: scroll;
      @media screen and (max-width: 600px) {
        display: none;
      }
    }
    .zoompinch {
      border: 1px solid #000;
    }
  }
}
.serial-wrapper {
  background-image: var(--canvas-background-image);
  background-size: 20px 20px;
}
.canvas {
  color: #fff;
  width: 100%;
  height: 100%;
  background-image: var(--canvas-background-image);
  background-size: 20px 20px;
  color: #000;
}
.test-skeleton {
  fill: rgba(255, 0, 0, 0.2);
  stroke: red;
  stroke-width: 1;
}
.test-skeleton-level-2 {
  fill: rgba(0, 255, 0, 0.2);
  stroke: rgb(255, 0, 157);
  stroke-width: 1;
}
.test-point {
  fill: rgb(255, 126, 67);
  stroke: #fff;
  stroke-width: 1px;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
}
.test-bbox {
  fill: rgba(67, 126, 255, 0.2);
  stroke: rgb(67, 126, 255);
  stroke-width: 1;
}
</style>

<style lang="scss">
html,
body {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
}
#app {
  width: 100%;
  height: 100%;
  font-family: Avenir, Helvetica, Arial, sans-serif;
}
</style>
```

### FILE: ./playground/src/main.ts ###
```ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

### FILE: ./playground/src/util/debounce.ts ###
```ts
import { WatchSource } from 'vue';

const animationFrameHandlers: Set<() => void> = new Set();

requestAnimationFrame(function animationFrameLoop() {
  animationFrameHandlers.forEach((handler) => handler());
  requestAnimationFrame(animationFrameLoop);
});

export function watchAsyncViaAnimationFrame<T>(source: WatchSource, cb: (newValue: T, oldValue: T | undefined) => void, options?: { immediate?: boolean }) {
  let oldValue: T | undefined;
  const handle = () => {
    const newValue = source instanceof Function ? source() : source.value;
    const prevOldValue = oldValue;
    if (newValue !== oldValue) {
      oldValue = newValue;
      cb(newValue, prevOldValue);
    }
  };
  animationFrameHandlers.add(handle);

  const stop = () => {
    animationFrameHandlers.delete(handle);
  };

  if (options?.immediate) {
    handle();
  }

  return stop;
}
```

### FILE: ./playground/src/components/ElementsTree.vue ###
```vue
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
import { SimpleElementWithBluepicMeta } from '../controllers/bluepicWYSIWYG';
import { round } from 'lodash';

defineProps<{
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
```

### FILE: ./playground/src/components/DraggablePoint.vue ###
```vue
<template>
  <g class="draggable-point" :style="{ '--x': x, '--y': y, '--angle': `${angle}rad` }">
    <circle :cx="x" :cy="y" :r="size / 2" />
  </g>
</template>

<script setup lang="ts">
defineProps<{
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
```

### FILE: ./playground/src/components/ElementSkeleton.vue ###
```vue
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
        @touchstart="handlePointTouchstart($event, cornerHandles[index])"
      />
      <draggable-point
        v-for="(point, index) in worldSkeletonCenterPointsOfEdges"
        :key="index"
        :x="composePointAbs(point.x, point.y)[0]"
        :y="composePointAbs(point.x, point.y)[1]"
        :size="10"
        :angle="worldRotationRadians"
        @mousedown="handlePointMousedown($event, edgeHandles[index])"
        @touchstart="handlePointTouchstart($event, edgeHandles[index])"
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
import { computed, onUnmounted, ref, watch } from 'vue';
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

const { handleMousedown, handleMousemove, handleMouseup } = useRectDrag(worldSkeleton, worldTransformationMatrix, props.element.type === 'group', (freshSkeleton) => {
  newWorldSkeleton.value = freshSkeleton;
});

function handlePointMousedown(event: MouseEvent, handle: Handle) {
  if (!worldSkeleton.value) return;
  const [canvasX, canvasY] = props.clientCoordinatesToCanvasCoordinates(event.clientX, event.clientY);
  handleMousedown(canvasX, canvasY, event, handle);
}
let currentMousemoveEvent: MouseEvent | TouchEvent | null = null;
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

function handleGlobalMouseup() {
  handleMouseup();
}
window.addEventListener('mouseup', handleGlobalMouseup);
window.addEventListener('mousemove', handleGlobalMousemove);
onUnmounted(() => {
  window.removeEventListener('mouseup', handleGlobalMouseup);
  window.removeEventListener('mousemove', handleGlobalMousemove);
});



function handlePointTouchstart(event: TouchEvent, handle: Handle) {
  if (!worldSkeleton.value) return;
  if (event.touches.length === 0) return;
  const touch = event.touches[0];
  const [canvasX, canvasY] = props.clientCoordinatesToCanvasCoordinates(touch.clientX, touch.clientY);
  handleMousedown(canvasX, canvasY, event, handle);
}

function handleGlobalTouchup () {
  handleMouseup();
}
function handleGlobalTouchmove (event: TouchEvent) {
  if (event.touches.length === 0) return;
  const touch = event.touches[0];
  const [canvasX, canvasY] = props.clientCoordinatesToCanvasCoordinates(touch.clientX, touch.clientY);
  latestMouseClientPos.value = { x: canvasX, y: canvasY };
  currentMousemoveEvent = event;
}
window.addEventListener('touchend', handleGlobalTouchup);
window.addEventListener('touchmove', handleGlobalTouchmove);
onUnmounted(() => {
  window.removeEventListener('touchend', handleGlobalTouchup);
  window.removeEventListener('touchmove', handleGlobalTouchmove);
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
```

### FILE: ./playground/src/vite-env.d.ts ###
```ts
/// <reference types="vite/client" />
```

### FILE: ./playground/src/controllers/bluepicWYSIWYG.ts ###
```ts
import { Template } from '@bluepic/types';
import type { SimpleElement, ElementBBox } from 'bbox-skeleton';
import { compose, rotateDEG, scale, translate } from 'transformation-matrix';
import { wrapExprIntoResolver, Traverse, BluepicEngine } from '@bluepic/core';
import {  skewDEG } from 'bbox-skeleton';

export type SimpleElementWithBluepicMeta = SimpleElement<{
  bluepicElement: Template.Element;
}>;
export type ElementScope = { [k: string]: unknown };
export type ElementScopeInformation = { [k: string]: ElementScope };
const injectableFunctions = ['ELEMENT', 'FIND_DUPLICATE', 'WEBGL_SUPPORTED'];

const evalCache = new Map<string, unknown>();

export function evalExpression<T extends unknown>(exprStr: string, scope: { [k: string]: any }, noError: false): T;
export function evalExpression<T extends unknown>(exprStr: string, scope: { [k: string]: any }, noError: true): T | undefined;
export function evalExpression<T extends unknown>(exprStr: string, scope: { [k: string]: any }, noError = true) {
  const dependencies = Traverse.collectDependencies(`(${exprStr})`, []);
  const needsToInject = dependencies.some((dep) => injectableFunctions.includes(dep));

  if (dependencies.length === 0) {
    // No dependencies, can be a constant expression
    if (evalCache.has(exprStr)) {
      const result = evalCache.get(exprStr) as T;
      return result;
    }
  }

  if (needsToInject) {
    exprStr = exprStr;
  }

  const callee = wrapExprIntoResolver(exprStr, Object.keys(scope));

  //const scopeValues = Object.values(scope);
  try {
    const result = callee(...Object.values(scope), scope);
    if (dependencies.length === 0) {
      evalCache.set(exprStr, result);
    }
    return result;
  } catch (err) {
    if (noError) {
      return undefined;
    } else {
      throw err;
    }
  }
}

export function numericValueIsNoBullshit(v: unknown): v is number {
  return typeof v === 'number' && !isNaN(v);
}
export function posValueIsNoBullshit(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && v.every(numericValueIsNoBullshit);
}
export function radiusTupleIsNoBullshit(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && v.every((n) => numericValueIsNoBullshit(n) && n >= 0);
}
export function fontSizeValueIsNoBullshit(v: unknown): v is number {
  return numericValueIsNoBullshit(v) && v >= 0;
}

export function* collectBluepicSerialElements(slot: Template.Element[]): Generator<Template.Element> {
  for (const element of slot) {
    yield element;
    if (element.name === 'group' || element.name === 'mask') {
      yield* collectBluepicSerialElements(element.slots.default);
    }
  }
}

export function findNode(fullTreeContext: Template.Element[], validator: (element: Template.Element) => boolean, modifier: (element: Template.Element) => Template.Element = (element) => element) {
  function loop(slot: Template.Element[]): Template.Element | null {
    for (let i = 0; i < slot.length; i++) {
      if (validator(slot[i])) return modifier(slot[i]);
      const elementSlots = BluepicEngine.getElementSlots(slot[i]);
      for (const subSlotName in elementSlots) {
        const result = loop(elementSlots[subSlotName as keyof (typeof slot)[keyof typeof slot]]);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }
  return loop(fullTreeContext);
}

export function findSlot(fullTreeContext: Template.Element[], validator: (slot: Template.Element[]) => boolean, modifier: (slot: Template.Element[]) => Template.Element[] = (slot) => slot): Template.Element[] | null {
  function loop(slot: Template.Element[]): Template.Element[] | null {
    if (validator(slot)) {
      return modifier(slot);
    }
    for (const child of slot) {
      const elementSlots = BluepicEngine.getElementSlots(child);
      for (const subSlotName in elementSlots) {
        const result = loop(elementSlots[subSlotName as keyof typeof elementSlots] as any);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }
  return loop(fullTreeContext);
}

export function getSlotsParentElement(fullTreeContext: Template.Element[], slot: Template.Element[]) {
  return findNode(fullTreeContext, (node) => Object.values(BluepicEngine.getElementSlots(node) || {}).includes(slot));
}
export function getElementsParentSlot(fullTreeContext: Template.Element[], element: Template.Element) {
  return findSlot(fullTreeContext, (slot) => {
    return Object.values(slot).includes(element);
  });
}

export function getNodesPath(fullTreeContext: Template.Element[], node: Template.Element) {
  const path = [node];
  let slot = getElementsParentSlot(fullTreeContext, node) ?? [];
  while (getSlotsParentElement(fullTreeContext, slot)) {
    const parentNode = getSlotsParentElement(fullTreeContext, slot);
    if (parentNode) {
      path.push(parentNode);
      slot = getElementsParentSlot(fullTreeContext, parentNode) ?? [];
    }
  }
  return path;
}

export function getElementAncestry(fullTreeContext: Template.Element[], element: Template.Element) {
  return getNodesPath(fullTreeContext, element).reverse();
}

export function getElementUniqueId(fullTreeContext: Template.Element[], element: Template.Element, iterationIndices: number[] = []) {
  const elementAncestry = getElementAncestry(fullTreeContext, element);

  return elementAncestry
    .filter((element, index) => element.iteration !== null || index === elementAncestry.length - 1)
    .map((element, index) => {
      if (element.iteration) {
        return `${element.id}__${index in iterationIndices ? iterationIndices[index] : 0}`;
      } else {
        return element.id;
      }
    })
    .join('$$');
}

export function retrieveElementScope(fullTreeContext: Template.Element[], elementScopeInformation: ElementScopeInformation, child: Template.Element, iterationIndices: number[]) {
  try {
    const uniqueElementId = getElementUniqueId(fullTreeContext, child, iterationIndices);
    return (elementScopeInformation[uniqueElementId] ?? {}) as { [k: string]: unknown };
  } catch {
    return {};
  }
}

function composeBBoxFromValuesAndOrigin(x: number, y: number, width: number, height: number, posOrigin: [number, number]): ElementBBox {
  return {
    x: x - width * posOrigin[0],
    y: y - height * posOrigin[1],
    width,
    height,
  };
}

export function setPrimitiveElementLocalBBox(el: Template.Elements.Rectangle | Template.Elements.Circle | Template.Elements.Image | Template.Elements.Map | Template.Elements.Text | Template.Elements.Video, newLocalBBox: ElementBBox, scope: ElementScope) {
  // Get pos origin
  const posOriginVal = evalExpression<[number, number]>(el.properties['pos'].value, scope, true);
  if (!posValueIsNoBullshit(posOriginVal)) return;

  if (el.name === 'rectangle' || el.name === 'image' || el.name == 'video' || el.name === 'map' || el.name === 'text') {
    // Set x, y, width, height
    const x = String(newLocalBBox.x + newLocalBBox.width * posOriginVal[0]);
    const y = String(newLocalBBox.y + newLocalBBox.height * posOriginVal[1]);
    const width = String(newLocalBBox.width);
    const height = String(newLocalBBox.height);

    el.properties.x.value = x;
    el.properties.y.value = y;
    el.properties.width.value = width;
    el.properties.height.value = height;
  } else if (el.name === 'circle') {
    // Set x, y, radius
    const x = String(newLocalBBox.x + newLocalBBox.width * posOriginVal[0]);
    const y = String(newLocalBBox.y + newLocalBBox.height * posOriginVal[1]);
    const radiusX = newLocalBBox.width / 2;
    const radiusY = newLocalBBox.height / 2;

    el.properties.x.value = x;
    el.properties.y.value = y;
    el.properties.radius.value = `[${radiusX}, ${radiusY}]`;
  } else {
    throw new Error('Element type not supported for setting local bbox');
  }
}

export function convertBluepicSerialElementsTreeToSimplifiedElementsTree(elementScopeInformation: ElementScopeInformation, fullTreeContext: Template.Element[]): SimpleElementWithBluepicMeta[] {
  function collectElementsAndConvert(slot: Template.Element[]): SimpleElementWithBluepicMeta[] {
    return slot
      .map((element) => {
        const elementScope = retrieveElementScope(fullTreeContext, elementScopeInformation, element, []);
        const transformOriginRel = evalExpression<[number, number]>(element.properties['v-transform-origin'].value, elementScope, true);
        if (!posValueIsNoBullshit(transformOriginRel)) return null;

        const translateX = evalExpression<number>(element.transform.translateX.value, elementScope, true);
        if (!numericValueIsNoBullshit(translateX)) return null;
        const translateY = evalExpression<number>(element.transform.translateY.value, elementScope, true);
        if (!numericValueIsNoBullshit(translateY)) return null;
        const scaleX = evalExpression<number>(element.transform.scaleX.value, elementScope, true);
        if (!numericValueIsNoBullshit(scaleX)) return null;
        const scaleY = evalExpression<number>(element.transform.scaleY.value, elementScope, true);
        if (!numericValueIsNoBullshit(scaleY)) return null;
        const skewX = evalExpression<number>(element.transform.skewX.value, elementScope, true);
        if (!numericValueIsNoBullshit(skewX)) return null;
        const skewY = evalExpression<number>(element.transform.skewY.value, elementScope, true);
        if (!numericValueIsNoBullshit(skewY)) return null;
        const rotate = evalExpression<number>(element.transform.rotate.value, elementScope, true);
        if (!numericValueIsNoBullshit(rotate)) return null;


        const coreTransform = compose(
          // 2. translate
          translate(translateX, translateY),
          // 3. rotate
          rotateDEG(rotate),
          // 4. skew
          skewDEG(skewX, skewY),
          // 5. scale
          scale(scaleX, scaleY)
        );

        const transformOrigin = { x: transformOriginRel[0], y: transformOriginRel[1] };
        
        if (element.name === 'group' || element.name === 'mask') {
          return {
            type: 'group' as const,
            children: collectElementsAndConvert(element.slots.default),
            coreTransform,
            transformOrigin,
            meta: {
              bluepicElement: element,
            },
          };
        } else if (element.name === 'rectangle' || element.name === 'image' || element.name === 'text' || element.name === 'video' || element.name === 'map') {
          const posOrigin = evalExpression<[number, number]>(element.properties.pos.value, elementScope, true);
          if (!posValueIsNoBullshit(posOrigin)) return null;
          const xVal = evalExpression<number>(element.properties.x.value, elementScope, true);
          if (!numericValueIsNoBullshit(xVal)) return null;
          const yVal = evalExpression<number>(element.properties.y.value, elementScope, true);
          if (!numericValueIsNoBullshit(yVal)) return null;

          const width = evalExpression<number>(element.properties.width.value, elementScope, true);
          if (!numericValueIsNoBullshit(width)) return null;
          const height = evalExpression<number>(element.properties.height.value, elementScope, true);
          if (!numericValueIsNoBullshit(height)) return null;

          const { x, y } = composeBBoxFromValuesAndOrigin(xVal, yVal, width, height, posOrigin);

          return {
            type: 'shape' as const,
            x,
            y,
            width,
            height,
            coreTransform,
            transformOrigin,
            meta: {
              bluepicElement: element,
            },
          };
        } else if (element.name === 'circle') {
          const posOrigin = evalExpression<[number, number]>(element.properties.pos.value, elementScope, true);
          if (!posValueIsNoBullshit(posOrigin)) return null;
          const xVal = evalExpression<number>(element.properties.x.value, elementScope, true);
          if (!numericValueIsNoBullshit(xVal)) return null;
          const yVal = evalExpression<number>(element.properties.y.value, elementScope, true);
          if (!numericValueIsNoBullshit(yVal)) return null;
          const radius = evalExpression<[number, number]>(element.properties.radius.value, elementScope, true);
          if (!posValueIsNoBullshit(radius)) return null;

          const width = radius[0] * 2;
          const height = radius[1] * 2;

          const { x, y } = composeBBoxFromValuesAndOrigin(xVal, yVal, width, height, posOrigin);

          return {
            type: 'shape' as const,
            x,
            y,
            width,
            height,
            coreTransform,
            transformOrigin,
            meta: {
              bluepicElement: element,
            },
          };
        } else if (element.name === 'path') {
          // TODO: Pfad-Bounding-Box berechnen
          return null;
        } else {
          return null;
        }
      })
      .filter((el) => el !== null);
  }

  return collectElementsAndConvert(fullTreeContext);
}
```

### FILE: ./playground/src/controllers/rectDrag.ts ###
```ts
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
```

### FILE: ./tsup.config.ts ###
```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true
});```

### FILE: ./src/graphic.ts ###
```ts
import { compose, inverse, Matrix, skew, translate } from 'transformation-matrix';


export type ElementBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type Skeleton = [PointObjectNotation, PointObjectNotation, PointObjectNotation, PointObjectNotation];


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
export function bakeOriginIntoMatrix(coreMatrix: Matrix, origin: PointObjectNotation) {
  return compose(
    translate(origin.x, origin.y),
    coreMatrix,
    translate(-origin.x, -origin.y)
  );
}

// Calculate the compensation delta to be applied to the geometry when changing the transform origin via d = (M_kern^(-1) - I) · (o_alt - o_neu)
export function computeOriginCompensationDelta(coreMatrix: Matrix, oldOrigin: PointObjectNotation, newOrigin: PointObjectNotation): PointObjectNotation {
  const invCore = inverse(coreMatrix);
  const originDelta = subtractVec(oldOrigin, newOrigin);

  // (M^(-1) - I) · v = M^(-1) · v - v
  const transformed = applyLinearPartOfMatrix(invCore, originDelta);
  return subtractVec(transformed, originDelta);
}

// Applies only the linear part of a transformation matrix to a vector
export function applyLinearPartOfMatrix(m: Matrix, v: PointObjectNotation): PointObjectNotation {
  return {
    x: m.a * v.x + m.c * v.y,
    y: m.b * v.x + m.d * v.y,
  };
}
// Subtract two vectors
export function subtractVec(a: PointObjectNotation, b: PointObjectNotation): PointObjectNotation {
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

export function pathifySkeleton(canvasWidth: number, canvasHeight: number, points: PointObjectNotation[], compose: (x: number, y: number) => [number, number]) {
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
}```

### FILE: ./src/projectSkeleton.ts ###
```ts
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
```

### FILE: ./src/index.ts ###
```ts
export * from './graphic';
export * from './projectSkeleton';
export * from './wysiwyg';```

### FILE: ./src/wysiwyg.ts ###
```ts
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
```

===== FILE DUMP END =====
