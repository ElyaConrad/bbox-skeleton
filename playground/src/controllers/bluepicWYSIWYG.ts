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
