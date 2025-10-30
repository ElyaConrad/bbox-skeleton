# bbox-skeleton

> A transform-preserving mathematical layer for WYSIWYG manipulation of graphic element trees

[![npm version](https://img.shields.io/npm/v/bbox-skeleton.svg)](https://www.npmjs.com/package/bbox-skeleton)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Playground

[Playground](https://bbox-skeleton-demo.pages.dev)

## What Problem Does This Solve?

When building WYSIWYG graphic editors, you typically face a fundamental challenge: **How do you allow users to resize and move elements visually while maintaining their transformation properties?**

Most graphic systems handle resizing by modifying the element's transform matrix (scale, skew, rotation). This works, but it creates a problem: **the original transformation intent gets lost**. If an element was deliberately rotated 45° and then resized, should that rotation be preserved exactly, or should it change?

**bbox-skeleton takes a different approach:** When you manipulate elements in world space (dragging corners, resizing), the system calculates what changes are needed to the underlying **geometry (x, y, width, height)** while keeping the **transform properties** (scale, skew, rotation, transform-origin) completely intact.

This is particularly valuable when:
- Building design tools where transform properties have semantic meaning
- Working with animation systems where transforms are keyframed
- Integrating with existing graphic engines that treat transforms as first-class properties
- Creating parametric or expression-based graphic systems

## Core Concept: The Skeleton

A **skeleton** is the mathematical representation of an element's shape in space — specifically, its four corner points:

```
[top-left, top-right, bottom-right, bottom-left]
```

Every element in bbox-skeleton has multiple skeleton representations:

- **Base Skeleton**: The untransformed bounding box corners (pure geometry)
- **Element Skeleton**: Base skeleton with local transforms applied
- **World Skeleton**: Element skeleton transformed through all ancestor transforms

When you drag a corner in a WYSIWYG editor, you're manipulating the **world skeleton**. bbox-skeleton's job is to project that manipulation back down to changes in the **base geometry** (x, y, width, height of shapes) while preserving all transform matrices in the tree.

## Key Features

- 🎯 **Transform-Preserving Geometry Updates** — Manipulations update geometry, not transforms
- 🌳 **Hierarchical Element Trees** — Full support for nested groups with inherited transforms
- 🎨 **Engine-Agnostic Design** — Abstract mathematical layer that adapts to any graphic engine
- 📐 **Transform Origin Management** — Sophisticated handling of transform origins with compensation
- 🔄 **Skeleton Projection** — Project world-space manipulations to local-space geometry changes
- 🎛️ **Corner & Edge Resizing** — Drag from any corner or edge, with optional aspect ratio locking
- 📦 **Type-Safe & Fully Typed** — Written in TypeScript with comprehensive type definitions

## Installation

```bash
npm install bbox-skeleton transformation-matrix
```

bbox-skeleton depends on `transformation-matrix` for matrix operations.

## Quick Start

```typescript
import {
  SimpleElementShape,
  SimpleElementGroup,
  getElementWorldSkeleton,
  applySkeletonInPlace,
  getElementWorldMatrix
} from 'bbox-skeleton';
import { identity } from 'transformation-matrix';

// Define a simple shape
const rectangle: SimpleElementShape = {
  type: 'shape',
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  coreTransform: identity(), // No transformation
  transformOrigin: { x: 150, y: 150 }, // Center of shape
  meta: { id: 'rect1' }
};

// Get its world skeleton (4 corner points)
const worldSkeleton = getElementWorldSkeleton([rectangle], rectangle);
// => [{x: 100, y: 100}, {x: 300, y: 100}, {x: 300, y: 200}, {x: 100, y: 200}]

// Simulate dragging bottom-right corner to new position
const newWorldSkeleton = [
  { x: 100, y: 100 },
  { x: 400, y: 100 }, // Expanded right
  { x: 400, y: 250 }, // Expanded down
  { x: 100, y: 250 }
];

// Project this change back to geometry updates
const worldMatrix = getElementWorldMatrix([rectangle], rectangle);
const changes = applySkeletonInPlace(rectangle, newWorldSkeleton, worldMatrix);

// Apply changes
for (const { el, newLocalBBox } of changes) {
  el.x = newLocalBBox.x;
  el.y = newLocalBBox.y;
  el.width = newLocalBBox.width;
  el.height = newLocalBBox.height;
}

// Result: rectangle.width is now 300, rectangle.height is now 150
// The coreTransform remains identity() — unchanged!
```

## Type System

### SimpleElement

The core abstraction is `SimpleElement`, which can be either a `SimpleElementShape` or a `SimpleElementGroup`:

```typescript
type SimpleElement<Meta extends SimpleElementMeta = {}> = 
  | SimpleElementShape<Meta> 
  | SimpleElementGroup<Meta>;
```

### SimpleElementShape

A leaf node representing a drawable element:

```typescript
type SimpleElementShape<Meta = {}> = {
  type: 'shape';
  x: number;              // Local x position
  y: number;              // Local y position
  width: number;          // Local width
  height: number;         // Local height
  coreTransform: Matrix;  // The transformation matrix (scale, rotate, skew)
  transformOrigin: PointObjectNotation; // Absolute transform origin point
  meta: Meta;             // Your custom metadata (element ID, etc.)
};
```

### SimpleElementGroup

A container node that groups children:

```typescript
type SimpleElementGroup<Meta = {}> = {
  type: 'group';
  children: SimpleElement<Meta>[];
  coreTransform: Matrix;
  transformOrigin: PointObjectNotation;
  meta: Meta;
};
```

**Important:** A group's bounding box is computed from its children. It has no explicit x, y, width, height properties.

### Meta System

The `meta` field is your connection point to your actual graphic engine:

```typescript
type MyElementMeta = {
  engineElement: MyGraphicEngineElement;
  id: string;
  customData: any;
};

type MyElement = SimpleElement<MyElementMeta>;
```

This keeps bbox-skeleton decoupled from your specific implementation while maintaining full type safety.

## Core Functions

### Element Tree Traversal

#### `collectAllElements<Meta>(slot: SimpleElement<Meta>[]): Generator<SimpleElement<Meta>>`

Recursively iterates over all elements in a tree, including nested groups:

```typescript
const allElements = Array.from(collectAllElements(rootElements));

for (const element of collectAllElements(rootElements)) {
  console.log(element.meta.id);
}
```

#### `findElement<Meta>(globalSlot: SimpleElement<Meta>[], predicateFn): SimpleElement<Meta> | null`

Finds the first element matching a predicate:

```typescript
const targetElement = findElement(rootElements, 
  el => el.meta.id === 'my-element-id'
);
```

### Bounding Box & Skeleton Calculations

#### `getElementLocalBBox(element: SimpleElement): ElementBBox`

Returns the local bounding box without any transformations:

```typescript
const localBBox = getElementLocalBBox(element);
// => { x: 100, y: 50, width: 200, height: 150 }
```

For shapes, this is simply `{ x, y, width, height }`. For groups, it's computed from all children's skeletons.

#### `getElementBaseSkeleton(element: SimpleElement): Skeleton`

Returns the four corner points of the local bounding box:

```typescript
const baseSkeleton = getElementBaseSkeleton(element);
// => [
//   { x: 100, y: 50 },   // top-left
//   { x: 300, y: 50 },   // top-right
//   { x: 300, y: 200 },  // bottom-right
//   { x: 100, y: 200 }   // bottom-left
// ]
```

#### `getElementSkeleton(element: SimpleElement): Skeleton`

Returns the skeleton transformed by the element's local transformation matrix:

```typescript
const elementSkeleton = getElementSkeleton(element);
// If element has rotation/skew, these corners will be transformed accordingly
```

#### `getElementWorldSkeleton(globalSlot: SimpleElement[], element: SimpleElement): Skeleton`

Returns the skeleton in world coordinates, with all ancestor transformations applied:

```typescript
const worldSkeleton = getElementWorldSkeleton(rootElements, myElement);
// This is what the user sees in the canvas
```

This is the most important function for WYSIWYG editors — it tells you where to draw the interactive handles.

### Matrix Calculations

#### `getBakedTransformMatrix(element: SimpleElement): Matrix`

Combines the element's `coreTransform` with its `transformOrigin`:

```typescript
const matrix = getBakedTransformMatrix(element);
// Equivalent to: translate(origin) -> coreTransform -> translate(-origin)
```

The "baking" process accounts for the transform origin. In matrix terms:

```
M_baked = T(origin) · M_core · T(-origin)
```

#### `getElementWorldMatrix(globalSlot: SimpleElement[], element: SimpleElement): Matrix`

Computes the combined transformation matrix from root to element:

```typescript
const worldMatrix = getElementWorldMatrix(rootElements, myElement);
// Composition of all ancestor transforms + own transform
```

### Skeleton Manipulation

#### `applySkeletonInPlace<Meta>(el: SimpleElement<Meta>, newSkeleton: Skeleton, skeletonMatrix: Matrix): ElementChangeRecord<Meta>[]`

The heart of bbox-skeleton. Projects a new skeleton back to geometry changes:

```typescript
const changes = applySkeletonInPlace(element, newWorldSkeleton, worldMatrix);

for (const { el, newLocalBBox } of changes) {
  el.x = newLocalBBox.x;
  el.y = newLocalBBox.y;
  el.width = newLocalBBox.width;
  el.height = newLocalBBox.height;
}
```

**Understanding the `skeletonMatrix` parameter:**

This is conceptually crucial: The `skeletonMatrix` defines **in which coordinate space the `newSkeleton` is expressed**.

- **When called from outside** (interactive editing): This is typically the element's world matrix, because the user manipulated the skeleton in world space (on the canvas)
- **During recursion** (inside groups): This becomes the child's local matrix in the context of its parent group

The function transforms the skeleton from whatever space it's in (via the inverse of `skeletonMatrix`) into the element's local coordinate space to compute geometry changes.

**How it works:**

1. Inverts the `skeletonMatrix` to transform the new skeleton into the element's local coordinate space
2. For shapes: Computes the new local bounding box directly
3. For groups: 
   - Converts the new skeleton to a local bounding box
   - For each child, computes how its skeleton should change using relative coordinates
   - Recursively calls `applySkeletonInPlace` on each child with the child's **own local matrix** as the `skeletonMatrix`
4. Returns a flat array of all shape changes in the entire subtree

**Key insight:** The recursive nature means that when you resize a group, the function "flows down" the transformation through the hierarchy. Each level converts world-space changes to its local space, then propagates proportional changes to children in *their* local spaces. This preserves relative positioning and all transform properties throughout the tree.

#### `calcBBoxFromSkeleton(skeleton: Skeleton): ElementBBox`

Computes the axis-aligned bounding box that contains a skeleton:

```typescript
const bbox = calcBBoxFromSkeleton(skeleton);
// Useful for computing group bounding boxes
```

#### `translateSkeleton(skeleton: Skeleton, delta: PointObjectNotation): Skeleton`

Moves a skeleton by a vector:

```typescript
const movedSkeleton = translateSkeleton(skeleton, { x: 50, y: 30 });
```

### Transform Origin Management

Transform origins are tricky. When you change an element's transform origin, the visual position of the element changes unless you compensate by adjusting the geometry.

#### `adjustLocalBBoxForNewTransformOrigin<Meta>(element: SimpleElement<Meta>, newOriginAbs: PointObjectNotation)`

Changes the transform origin while keeping the element visually in the same place:

```typescript
const { changes, transformOriginAbs } = adjustLocalBBoxForNewTransformOrigin(
  element,
  { x: 200, y: 150 } // New absolute transform origin
);

// Update element
element.transformOrigin = transformOriginAbs;

// Apply geometry changes
for (const { el, newLocalBBox } of changes) {
  el.x = newLocalBBox.x;
  el.y = newLocalBBox.y;
  el.width = newLocalBBox.width;
  el.height = newLocalBBox.height;
}
```

**The math:** When changing transform origin from `o_old` to `o_new`, the geometry must shift by a compensation delta:

```
δ = (M_core⁻¹ - I) · (o_old - o_new)
```

This ensures the visual result remains unchanged.

#### `adjustLocalBBoxForNewTransformOriginRelative<Meta>(element: SimpleElement<Meta>, relativeOrigin: [number, number])`

Same as above, but with relative coordinates (0-1 range within bounding box):

```typescript
const { changes, transformOriginAbs } = adjustLocalBBoxForNewTransformOriginRelative(
  element,
  [0.5, 0.5] // Center of element
);
```

Relative origins are often more intuitive:
- `[0, 0]` = top-left corner
- `[0.5, 0.5]` = center
- `[1, 1]` = bottom-right corner

## Skeleton Projection Functions

These functions handle interactive resizing from corners and edges:

### `projectSkeletonFromCorner(baseSkeleton, worldTransformMatrix, handleIndex, handlePos, aspectRatio)`

Projects a corner handle drag to a new skeleton:

```typescript
import { projectSkeletonFromCorner } from 'bbox-skeleton';

const { skeleton: newSkeleton } = projectSkeletonFromCorner(
  worldSkeletonAtDragStart,
  worldMatrix,
  2, // bottom-right corner
  { x: mouseX, y: mouseY },
  null // or pass aspectRatio to lock proportions
);
```

**Corner handle indices:**

```
     0 ●━━━━━━━━━━━● 1
       ┃          ┃
       ┃          ┃
       ┃          ┃
     3 ●━━━━━━━━━━━● 2

0 = top-left
1 = top-right  
2 = bottom-right
3 = bottom-left
```

The indices follow a **clockwise pattern starting from top-left**. When you drag a corner handle, the opposite corner remains fixed as the anchor point.

**Aspect ratio locking:** Pass the original aspect ratio to maintain proportions during resize (useful for Shift-key behavior).

### `projectSkeletonFromEdge(baseSkeleton, worldTransformMatrix, edgeIndex, handlePos, aspectRatio)`

Projects an edge handle drag to a new skeleton:

```typescript
import { projectSkeletonFromEdge } from 'bbox-skeleton';

const { skeleton: newSkeleton } = projectSkeletonFromEdge(
  worldSkeletonAtDragStart,
  worldMatrix,
  1, // right edge
  { x: mouseX, y: mouseY },
  null
);
```

**Edge handle indices:**

```
       ╔═══ 0 ═══╗
       ║         ║
     3 ║         ║ 1
       ║         ║
       ╚═══ 2 ═══╝

0 = top edge
1 = right edge
2 = bottom edge
3 = left edge
```

The indices follow a **clockwise pattern starting from top**. Edge resizing moves one edge while keeping the opposite edge fixed. When aspect ratio is locked, the perpendicular dimension adjusts to maintain proportions.

### `getAspectRatioOfSkeleton(skeleton, worldTransformMatrix)`

Calculates the aspect ratio of a skeleton in normalized space:

```typescript
const aspectRatio = getAspectRatioOfSkeleton(skeleton, worldMatrix);
// Use this value for aspect-ratio-locked resizing
```

## Practical Integration Example

Here's how you'd integrate bbox-skeleton into a graphic editor:

```typescript
import {
  SimpleElement,
  getElementWorldSkeleton,
  getElementWorldMatrix,
  applySkeletonInPlace,
  projectSkeletonFromCorner,
  getAspectRatioOfSkeleton
} from 'bbox-skeleton';

class GraphicEditor {
  elements: SimpleElement[] = [];
  selectedElement: SimpleElement | null = null;
  dragState: {
    skeletonAtStart: Skeleton;
    worldMatrix: Matrix;
    handleIndex: number;
    aspectRatio: number;
  } | null = null;

  onHandleMouseDown(element: SimpleElement, handleIndex: number) {
    this.selectedElement = element;
    const worldSkeleton = getElementWorldSkeleton(this.elements, element);
    const worldMatrix = getElementWorldMatrix(this.elements, element);
    
    this.dragState = {
      skeletonAtStart: worldSkeleton,
      worldMatrix,
      handleIndex,
      aspectRatio: getAspectRatioOfSkeleton(worldSkeleton, worldMatrix)
    };
  }

  onMouseMove(mouseX: number, mouseY: number, shiftKeyPressed: boolean) {
    if (!this.dragState || !this.selectedElement) return;

    const { skeletonAtStart, worldMatrix, handleIndex, aspectRatio } = this.dragState;
    
    // Project the new handle position to a new skeleton
    const { skeleton: newWorldSkeleton } = projectSkeletonFromCorner(
      skeletonAtStart,
      worldMatrix,
      handleIndex,
      { x: mouseX, y: mouseY },
      shiftKeyPressed ? aspectRatio : null // Lock aspect ratio if shift pressed
    );

    // Calculate geometry changes
    const changes = applySkeletonInPlace(
      this.selectedElement,
      newWorldSkeleton,
      worldMatrix
    );

    // Apply changes to your graphic engine
    for (const { el, newLocalBBox } of changes) {
      this.updateEngineElement(el.meta.engineElement, newLocalBBox);
      
      // Also update the abstract model
      if (el.type === 'shape') {
        el.x = newLocalBBox.x;
        el.y = newLocalBBox.y;
        el.width = newLocalBBox.width;
        el.height = newLocalBBox.height;
      }
    }

    this.render();
  }

  onMouseUp() {
    this.dragState = null;
  }

  updateEngineElement(engineElement: any, bbox: ElementBBox) {
    // Update your actual graphic engine here
    // This is where you'd call your engine's specific API
    engineElement.setPosition(bbox.x, bbox.y);
    engineElement.setSize(bbox.width, bbox.height);
  }
}
```

## Adapter Pattern for Your Graphic Engine

bbox-skeleton is designed to be engine-agnostic. Here's the adapter pattern:

```typescript
// 1. Define your meta type
type MyEngineMeta = {
  engineElement: MyEngineElement;
  id: string;
};

// 2. Create conversion functions
function convertToSimpleElement(engineElement: MyEngineElement): SimpleElement<MyEngineMeta> {
  return {
    type: 'shape',
    x: engineElement.x,
    y: engineElement.y,
    width: engineElement.width,
    height: engineElement.height,
    coreTransform: engineElement.getTransformMatrix(),
    transformOrigin: engineElement.getTransformOrigin(),
    meta: {
      engineElement,
      id: engineElement.id
    }
  };
}

function applyChangesToEngine(
  changeRecords: ElementChangeRecord<MyEngineMeta>[]
) {
  for (const { el, newLocalBBox } of changeRecords) {
    const engineElement = el.meta.engineElement;
    
    // Update your engine
    engineElement.setBounds(
      newLocalBBox.x,
      newLocalBBox.y,
      newLocalBBox.width,
      newLocalBBox.height
    );
    
    // Keep the abstract model in sync
    el.x = newLocalBBox.x;
    el.y = newLocalBBox.y;
    el.width = newLocalBBox.width;
    el.height = newLocalBBox.height;
  }
}

// 3. Build your tree
const simpleElements = myEngineElements.map(convertToSimpleElement);

// 4. Use bbox-skeleton
const worldSkeleton = getElementWorldSkeleton(simpleElements, targetElement);
// ... manipulation logic ...
const changes = applySkeletonInPlace(element, newSkeleton, worldMatrix);

// 5. Apply back to engine
applyChangesToEngine(changes);
```

This pattern keeps bbox-skeleton focused on the mathematical transformations while your adapter handles engine-specific details.

## Mathematical Background

### Transform Composition

Each element has a `coreTransform` matrix and a `transformOrigin` point. The effective transformation is:

```
M_effective = T(origin) · M_core · T(-origin)
```

Where `T(v)` is a translation matrix. This is what `getBakedTransformMatrix` computes.

### World Matrix Calculation

For an element with ancestors `[root, ..., parent, element]`, the world matrix is:

```
M_world = M_root · ... · M_parent · M_element
```

This composition is computed by `getElementWorldMatrix`.

### Skeleton Projection

When you drag a handle in world space, you're defining a new world skeleton `S_world_new`. To find the required geometry changes, we:

1. **Invert to local space:**
   ```
   S_local_new = M_context⁻¹ · S_world_new
   ```
   
   Where `M_context` is the transformation matrix that defines the coordinate space of the skeleton. When manipulating in world space, this is `M_world`. During recursive group processing, this becomes each child's local matrix.

2. **Compute new bounding box:**
   ```
   bbox_new = boundingBox(S_local_new)
   ```

3. **For groups:** Recursively project to children using relative coordinates within the group's bounding box. Each recursion level uses the child's local matrix as the new context matrix.

This context-aware approach is what allows `applySkeletonInPlace` to correctly handle both top-level manipulation (world space) and nested transformations (parent-relative space) with the same algorithm.

### Transform Origin Compensation

Changing transform origin from `o_old` to `o_new` requires geometry compensation. The element's visual position is determined by:

```
M_effective · p = T(o) · M_core · T(-o) · p
```

When we change `o`, we must adjust the local geometry by:

```
δ = (M_core⁻¹ - I) · (o_old - o_new)
```

This ensures `M_effective · p` remains constant. The derivation comes from requiring that the transformed origin point stays in the same world position.

## Constraints & Known Limitations

### The Non-Uniform Scaling Problem

bbox-skeleton has an important mathematical constraint: **You cannot always resize a group with non-uniform scaling (changing aspect ratio) if it contains elements with skew or rotation.**

**Why?** Consider a rectangle rotated 45°. Its corners form a diamond shape. If you try to "squash" this diamond horizontally while keeping the rotation at 45°, the geometry becomes inconsistent — you'd need to change the rotation angle itself, which violates the transform-preserving principle.

**In mathematical terms:** Non-uniform scaling of a rotated/skewed element requires modifying the skew or rotation parameters, which bbox-skeleton explicitly avoids.

**Practical solutions:**

1. **Lock aspect ratio** when resizing groups with rotated children (pass `aspectRatio` to projection functions)
2. **Detect the constraint** and warn users when attempting non-uniform scaling of problematic groups
3. **Allow it anyway** and accept that results may be approximate (the system will do its best)

The library provides the tools to handle this gracefully — you decide the UX approach.

### Performance Considerations

- **Group resizing** recursively processes all descendants. Deep hierarchies with many children may have performance implications.
- **Consider debouncing** during interactive dragging (update preview at 60fps, commit changes on mouse up)
- The example code includes `watchAsyncViaAnimationFrame` for this purpose

## Design Philosophy

bbox-skeleton makes specific design choices that may differ from other graphic libraries:

### Separation of Transform and Geometry

**Conventional approach:** Update the transform matrix when resizing
**bbox-skeleton approach:** Update the geometry, keep transforms constant

This design prioritizes **semantic preservation** — if a designer set a rotation to exactly 45°, that value shouldn't drift to 44.97° due to interactive manipulations.

### Two-Layer Architecture

1. **Abstract mathematical layer** (bbox-skeleton) — Pure geometry and matrix math
2. **Engine adapter layer** (your code) — Bridges to your specific graphic engine

This separation makes bbox-skeleton reusable across different graphic frameworks.

### Transform Origin as First-Class Concept

Many libraries treat transform origin as a convenience feature. bbox-skeleton treats it as a fundamental property, with sophisticated compensation mathematics to allow changing it without visual side effects.

## Real-World Usage

bbox-skeleton was developed for **Bluepic**, an expression-based graphic design engine. In Bluepic:

- Elements are defined by expressions (e.g., `width: data.count * 50`)
- Transforms are parametric (keyframed animations)
- WYSIWYG manipulation must update expressions, not transforms
- The transform-preserving approach ensures animations remain valid after manual edits

However, bbox-skeleton is engine-agnostic and works equally well with:
- Canvas-based graphic libraries
- SVG editors
- WebGL rendering engines
- Any system with positioned, transformable elements

## API Reference Summary

### Types

- `SimpleElementShape<Meta>` — Leaf element with x, y, width, height
- `SimpleElementGroup<Meta>` — Container with children
- `SimpleElement<Meta>` — Union of shape and group
- `ElementBBox` — `{ x, y, width, height }`
- `Skeleton` — `[Vec2, Vec2, Vec2, Vec2]` (four corners)
- `Vec2` — `{ x: number, y: number }`
- `ElementChangeRecord<Meta>` — `{ el: SimpleElementShape<Meta>, newLocalBBox: ElementBBox }`

### Core Functions

**Tree traversal:**
- `collectAllElements(slot)` — Recursively iterate all elements
- `findElement(globalSlot, predicateFn)` — Find element by predicate

**Bounding boxes & skeletons:**
- `getElementLocalBBox(element)` — Local bounding box
- `getElementBaseSkeleton(element)` — Untransformed corner points
- `getElementSkeleton(element)` — Locally transformed corners
- `getElementWorldSkeleton(globalSlot, element)` — Fully transformed corners
- `calcBBoxFromSkeleton(skeleton)` — Bounding box from points

**Matrices:**
- `getBakedTransformMatrix(element)` — Local transform with origin
- `getElementWorldMatrix(globalSlot, element)` — Composed world transform

**Manipulation:**
- `applySkeletonInPlace(el, newSkeleton, skeletonMatrix)` — Project skeleton to geometry
- `translateSkeleton(skeleton, delta)` — Move skeleton by vector

**Transform origin:**
- `adjustLocalBBoxForNewTransformOrigin(element, newOriginAbs)` — Change origin (absolute)
- `adjustLocalBBoxForNewTransformOriginRelative(element, relativeOrigin)` — Change origin (relative)

**Projection (from `projectSkeleton.ts`):**
- `projectSkeletonFromCorner(baseSkeleton, worldMatrix, handleIndex, handlePos, aspectRatio)` — Corner resize
- `projectSkeletonFromEdge(baseSkeleton, worldMatrix, edgeIndex, handlePos, aspectRatio)` — Edge resize
- `getAspectRatioOfSkeleton(skeleton, worldMatrix)` — Calculate aspect ratio

### Utility Functions (from `graphic.ts`)

- `bakeOriginIntoMatrix(coreMatrix, origin)` — Combine transform and origin
- `computeOriginCompensationDelta(coreMatrix, oldOrigin, newOrigin)` — Calculate geometry shift needed
- `applyLinearPartOfMatrix(matrix, vector)` — Apply matrix without translation
- `skewDEG(ax, ay)` — Create skew matrix from degrees
- `radiansToDegrees(rad)` — Convert radians to degrees

## Contributing

Contributions are welcome! This library solves a nuanced mathematical problem, and there's always room for:

- Performance optimizations
- Additional projection modes
- Better handling of edge cases
- More sophisticated constraint detection
- Improved TypeScript types

## License

MIT

---

**Built with mathematical rigor for graphic transformation challenges.**

If you're building a WYSIWYG editor and struggling with transform vs. geometry updates, bbox-skeleton might be exactly what you need.