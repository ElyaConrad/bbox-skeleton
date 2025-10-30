# bbox-skeleton

Dieses Modul bietet einen abstrakten Layer innerhalb dessen mit Bounding-Boxen und deren Skeletons mitsamt ihrer Transformations-Matrizen gerechnet werden kann, um diese zu skalieren oder zu bewegen - ohne dabei tatsächlich an den Trasnformationen selbst etwas zu ändern.

### WYSIWYG

Das wesentliche Ziel ist: Einen Skalierungs-Layer zu schaffen, der eine Skalierung von Elementen auf einer WYSIWYG-Ebene löst und dabei aber stets die eigentlichen Bounding-Boxen der Elementen ändert.

### Funktionsweise

Dabei wird ein Modell eines Grafik-Baums aus _Shape_ und _Group_ Elementen simuliert. Hilfsfunktionen können nun genutzt werden, um z.B. ein World-SKeleton auszurechnen und innerhlab dieses Veränderungen vorzunehmen und diese zurückzurechnen. Dabei geht das Modul analtisch und rekursiv vor.

#### Modell

```
- Shape (element1)
- Group (group1)
    - Group (group2)
        - Shape (element2)
        - Group (group3)
            - Shape (element3)
            - Shape (element4)
        - Shape (element5)
    - Shape (element6)
    - Shape (element7)
```

## Installation

```bash
npm install bbox-skeleton
```

### Example elements tree

```typescript
import { compose, rotate, scale, skew } from "transformation-matrix";
import { type SimpleElement } from "bbox-skeleton";

/*
Wir haben coreTransform und transformOrigin getrennt, damit es hinterher sinnvoll möglich ist, transform-origins zu rekonstruieren und zu extrahieren.
*/

const elementsTree: SimpleElement[] = [
  {
    type: "group",
    children: [
      {
        type: "group",
        children: [
          {
            type: "shape",
            x: 500,
            y: 400,
            width: 400,
            height: 200,
            coreTransform: compose(rotate(Math.PI / 4)),
            transformOrigin: { x: 700, y: 500 },
            meta: {
              internalElementId: "element1",
            },
          },
        ],
        coreTransform: compose(rotate(-Math.PI / 8)),
        transformOrigin: { x: 550, y: 450 },
        meta: {
          internalElementId: "group2",
        },
      },
    ],
    coreTransform: compose(translate(100, -25)),
    transformOrigin: { x: 100, y: 100 },
    meta: {
      internalElementId: "group1",
    },
  },
  {
    type: "shape",
    x: 10,
    y: 20,
    width: 40,
    height: 40,
    coreTransform: compose(rotate(Math.PI)),
    transformOrigin: { x: 50, y: 60 },
    meta: {
      internalElementId: "element2",
    },
  },
];
```

## Basic functions

### Local-BBox

The fundament of this whole logic is: Every element has a local bbox. In case of a group it is all its children's local box with their local transform matrix combined.

```typescript
const elementBBox = getElementLocalBBox(element);
/*
{
    x: number;
    y: number;
    width: number;
    height: number;
}
*/
```

### Parent-local skeleton

The parent-local skeleton is the local skeleton within its parent's coordinates.

```typescript
const elementSkeleton = getElementSkeleton(element);
/*
[
    { x: number; y: number; },
    { x: number; y: number; },
    { x: number; y: number; },
    { x: number; y: number; }
]
*/
```

