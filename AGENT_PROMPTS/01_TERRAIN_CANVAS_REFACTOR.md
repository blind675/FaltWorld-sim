# AI Agent Prompt 1: TerrainCanvas Refactoring

## ⚠️ RUN THIS AGENT FIRST
This refactoring must complete before Agents 2 and 3 (visualization agents) can run.

## Objective
Refactor `TerrainCanvas.tsx` from a monolithic 1000+ line component into a modular layer-based architecture. This enables parallel development of visualization features without merge conflicts.

## Current State
- `client/src/components/TerrainCanvas.tsx` - Single large file (~1032 lines)
- Contains: terrain rendering, color modes, rivers, contours, wind arrows, minimap, event handlers
- All visualization logic is interleaved in one render loop

## Target Architecture

```
client/src/components/
├── TerrainCanvas.tsx              # Main orchestrator (slim, ~200 lines)
├── canvas/
│   ├── types.ts                   # Shared types and interfaces
│   ├── CanvasRenderer.ts          # Core rendering orchestration
│   ├── layers/
│   │   ├── ICanvasLayer.ts        # Layer interface
│   │   ├── TerrainLayer.ts        # Base terrain colors (default mode)
│   │   ├── HeightmapLayer.ts      # Heightmap color mode
│   │   ├── MoistureLayer.ts       # Moisture color mode
│   │   ├── TemperatureLayer.ts    # Temperature color mode
│   │   ├── HumidityLayer.ts       # Humidity color mode
│   │   ├── WindLayer.ts           # Wind color mode + arrows
│   │   ├── RiverLayer.ts          # River segments overlay
│   │   ├── ContourLayer.ts        # Contour lines overlay
│   │   ├── SelectionLayer.ts      # Hover/selection highlights
│   │   └── index.ts               # Layer exports
│   └── MinimapRenderer.ts         # Minimap rendering logic
└── hooks/
    ├── useCanvasPan.ts            # Pan/drag handling
    └── useCanvasInteraction.ts    # Click/hover handling
```

---

## Task 1: Create Layer Interface

**File**: `client/src/components/canvas/layers/ICanvasLayer.ts`

```typescript
import { TerrainCell, TerrainGrid } from "@shared/schema";
import { VisualizationSettings } from "../types";

export interface LayerRenderContext {
  ctx: CanvasRenderingContext2D;
  terrainGrid: TerrainGrid;
  settings: VisualizationSettings;
  cellWidth: number;
  cellHeight: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  normalizedPanX: number;
  normalizedPanY: number;
  gridSize: number;
}

export interface ICanvasLayer {
  /** Unique identifier for the layer */
  id: string;
  
  /** Whether this layer should render given current settings */
  shouldRender(settings: VisualizationSettings): boolean;
  
  /** Render the layer to the canvas */
  render(context: LayerRenderContext): void;
  
  /** Optional: Get cell color for this layer (used by terrain/color mode layers) */
  getCellColor?(cell: TerrainCell, settings: VisualizationSettings): string | null;
}
```

---

## Task 2: Create Shared Types

**File**: `client/src/components/canvas/types.ts`

Move and export these from TerrainCanvas.tsx:
- `VisualizationSettings` interface
- `CellInfo` interface
- Any other shared types

---

## Task 3: Extract Color Mode Layers

Each color mode becomes its own layer. Extract the `getCellColor` logic for each mode:

### TerrainLayer.ts (default mode)
- Springs, rivers, mud, land colors
- The original default visualization

### HeightmapLayer.ts
- Blue-white-brown gradient based on altitude

### MoistureLayer.ts  
- White-blue gradient based on moisture

### TemperatureLayer.ts
- Blue-cyan-green-yellow-red gradient

### HumidityLayer.ts
- Tan-blue gradient based on air_humidity

### WindLayer.ts
- Background color by wind speed
- Wind direction arrows overlay
- This layer has both `getCellColor` AND additional `render` for arrows

---

## Task 4: Extract Overlay Layers

### RiverLayer.ts
- River segment lines connecting river cells
- Only renders when `showRivers` is true and cells are large enough

### ContourLayer.ts
- Contour line rendering
- Only renders when `contourLines` is true

### SelectionLayer.ts
- Golden border for selected cell
- White border for hovered cell

---

## Task 5: Create Canvas Renderer

**File**: `client/src/components/canvas/CanvasRenderer.ts`

```typescript
import { ICanvasLayer, LayerRenderContext } from "./layers/ICanvasLayer";
import { VisualizationSettings } from "./types";
import { TerrainGrid } from "@shared/schema";

export class CanvasRenderer {
  private layers: ICanvasLayer[] = [];
  private colorModeLayers: Map<string, ICanvasLayer> = new Map();
  private overlayLayers: ICanvasLayer[] = [];

  constructor() {
    // Register all layers
    this.registerColorModeLayer("default", new TerrainLayer());
    this.registerColorModeLayer("heightmap", new HeightmapLayer());
    this.registerColorModeLayer("moisture", new MoistureLayer());
    this.registerColorModeLayer("temperature", new TemperatureLayer());
    this.registerColorModeLayer("humidity", new HumidityLayer());
    this.registerColorModeLayer("wind", new WindLayer());
    
    this.registerOverlayLayer(new RiverLayer());
    this.registerOverlayLayer(new ContourLayer());
    this.registerOverlayLayer(new SelectionLayer());
  }

  registerColorModeLayer(mode: string, layer: ICanvasLayer) {
    this.colorModeLayers.set(mode, layer);
  }

  registerOverlayLayer(layer: ICanvasLayer) {
    this.overlayLayers.push(layer);
  }

  render(
    ctx: CanvasRenderingContext2D,
    terrainGrid: TerrainGrid,
    settings: VisualizationSettings,
    width: number,
    height: number,
    selectedCell: CellInfo | null,
    hoveredCell: CellInfo | null
  ) {
    // Build render context
    const context = this.buildContext(ctx, terrainGrid, settings, width, height);
    
    // 1. Get active color mode layer
    const colorLayer = this.colorModeLayers.get(settings.colorMode);
    
    // 2. Render base terrain with color mode
    this.renderTerrain(context, colorLayer);
    
    // 3. Render overlay layers that should be active
    for (const layer of this.overlayLayers) {
      if (layer.shouldRender(settings)) {
        layer.render(context);
      }
    }
  }
  
  // ... helper methods
}
```

---

## Task 6: Extract Minimap Renderer

**File**: `client/src/components/canvas/MinimapRenderer.ts`

Extract all minimap-related logic:
- Cached terrain rendering
- 10-minute refresh interval
- Viewport indicator drawing
- Color mode change detection

---

## Task 7: Extract Pan/Interaction Hooks

### useCanvasPan.ts
- Mouse drag handling
- Pan offset updates
- requestAnimationFrame throttling

### useCanvasInteraction.ts  
- Mouse move → cell hover detection
- Mouse click → cell selection
- Coordinate calculations with wrapping

---

## Task 8: Slim Down TerrainCanvas.tsx

The main component should:
1. Initialize CanvasRenderer and MinimapRenderer
2. Use the extracted hooks
3. Pass data to renderers
4. Handle state (selected cell, hovered cell, etc.)

Target: ~200 lines max

---

## Verification Steps

1. **Build passes**: `npm run build` — no TypeScript errors
2. **Visual parity**: All existing visualizations work exactly as before
3. **All color modes work**: default, heightmap, moisture, temperature, humidity, wind
4. **Overlays work**: rivers, contours, selection highlights
5. **Minimap works**: cached rendering, viewport indicator
6. **Interactions work**: pan, zoom, hover, click

---

## Code Style Guidelines

- Use TypeScript strictly
- Export layer classes from index.ts
- Keep each layer file focused (~50-100 lines)
- Preserve exact visual output — this is a refactor, not a redesign
- Add brief JSDoc comments for public methods

---

## Files to Create

| File | Purpose |
|------|---------|
| `canvas/types.ts` | Shared types |
| `canvas/layers/ICanvasLayer.ts` | Layer interface |
| `canvas/layers/TerrainLayer.ts` | Default colors |
| `canvas/layers/HeightmapLayer.ts` | Heightmap mode |
| `canvas/layers/MoistureLayer.ts` | Moisture mode |
| `canvas/layers/TemperatureLayer.ts` | Temperature mode |
| `canvas/layers/HumidityLayer.ts` | Humidity mode |
| `canvas/layers/WindLayer.ts` | Wind mode + arrows |
| `canvas/layers/RiverLayer.ts` | River segments |
| `canvas/layers/ContourLayer.ts` | Contour lines |
| `canvas/layers/SelectionLayer.ts` | Selection highlights |
| `canvas/layers/index.ts` | Exports |
| `canvas/CanvasRenderer.ts` | Main renderer |
| `canvas/MinimapRenderer.ts` | Minimap logic |
| `hooks/useCanvasPan.ts` | Pan handling |
| `hooks/useCanvasInteraction.ts` | Click/hover |

## Files to Modify

| File | Changes |
|------|---------|
| `TerrainCanvas.tsx` | Slim down, use new modules |

---

## Do NOT

- Do not change visual appearance — exact parity required
- Do not modify `home.tsx` or other files
- Do not add new features — pure refactor
- Do not break existing functionality
