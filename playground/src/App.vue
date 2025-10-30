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
                @elements:update="handleElementsChangeRecords2"
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
import { computed, nextTick, onUnmounted, ref } from 'vue';
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
  // el.transform = newMatrix;
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

const testSkeletons = ref<[PointObjectNotation, PointObjectNotation, PointObjectNotation, PointObjectNotation][]>([]);

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

function handleElementsChangeRecords2(changeRecords: ElementChangeRecord<SimpleElementWithBluepicMeta['meta']>[]) {
  // testSkeletons.value = changeRecords.map((rec) => rec.newSkeleton);

  testPoints.value = [];
  testBBoxes.value = [];

  const transformOriginsOld = new Map<SimpleElementWithBluepicMeta, PointObjectNotation>();
  const bboxesOld = new Map<SimpleElementWithBluepicMeta, ElementBBox>();
  //const oldTransformOriginsRel = new Map<SimpleElementWithBluepicMeta, [number, number]>();

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

  // Preserve relative transform origins while adjusting bboxes and transforms
  // for (const element of collectAllElements(allSimpleElements.value)) {
  //   // Get old transform origin and bbox
  //   const oldTransformOriginAbs = transformOriginsOld.get(element);
  //   const oldBBox = bboxesOld.get(element);
  //   if (!oldTransformOriginAbs || !oldBBox) continue;

  //   // Get the relative old transform origin within the old bbox (from TL corner)
  //   const oldTransformOriginRel: [number, number] = [
  //     round((oldTransformOriginAbs.x - oldBBox.x) / oldBBox.width, 8),
  //     round((oldTransformOriginAbs.y - oldBBox.y) / oldBBox.height, 8)
  //   ];

  //   const currLocalBBox = getElementLocalBBox(element);
  //   const currTransformOriginRel: [number, number] = [
  //     round((element.transformOrigin.x - currLocalBBox.x) / currLocalBBox.width, 8),
  //     round((element.transformOrigin.y - currLocalBBox.y) / currLocalBBox.height, 8),
  //   ];
  //   // No adjustment needed if relative transform origin is already correct
  //   if (currTransformOriginRel[0] === oldTransformOriginRel[0] && currTransformOriginRel[1] === oldTransformOriginRel[1]) {
  //     continue;
  //   }

  //   // The new matrix is simply the old core matrix adjusted for the new transform origin
  //   // The changes are all adjusted element local bboxes flattened
  //   const { changes, transformOriginAbs } = adjustLocalBBoxForNewTransformOriginRelative(element, oldTransformOriginRel);

  //   // Just loop trough the flattened changes and apply the new local bboxes to our virtual elements
  //   for (const { el, newLocalBBox } of changes) {
  //     el.x = newLocalBBox.x;
  //     el.y = newLocalBBox.y;
  //     el.width = newLocalBBox.width;
  //     el.height = newLocalBBox.height;
  //   }
  //   // Finally set the element's new transform origin
  //   element.transformOrigin = transformOriginAbs;
  //   // The original bluepic element's transform origin is not adjusted here but we keep track of the new absolute transform origin
  //   adjustedTransformOrigins.set(element, transformOriginAbs);
  // }

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

function composeBBox(bbox: ElementBBox, compose: (x: number, y: number) => [number, number]) {
  const topLeft = composePointAbs(bbox.x, bbox.y, compose);
  const bottomRight = composePointAbs(bbox.x + bbox.width, bbox.y + bbox.height, compose);
  return {
    x: topLeft[0],
    y: topLeft[1],
    width: bottomRight[0] - topLeft[0],
    height: bottomRight[1] - topLeft[1],
  };
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
