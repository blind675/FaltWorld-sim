# AI Agent Prompt 3: Ecology Visualization

## ⚠️ PREREQUISITE
Run Agent 1 (TerrainCanvas Refactor) first. This agent creates new layer files in the modular architecture.

## Objective
Add grass visualization layer to display grass density on the terrain. This prepares the frontend for the grass system being implemented by Agent 4.

## Context
After Agent 1 completes, the canvas uses a layer-based architecture. Agent 4 (Grass System Backend) will add `grass_density` and `grass_type` to the schema. This agent adds the visualization layer.

## Expected Schema (from Agent 4)
```typescript
grass_density: number;  // 0-1, coverage amount
grass_type: string;     // Species identifier (e.g., "cool_season", "warm_season")
```

---

## Task 1: Create GrassLayer

**File**: `client/src/components/canvas/layers/GrassLayer.ts`

**Purpose**: Color-coded grass density visualization

**Logic**:
- Add "grass" to colorMode options
- Color gradient based on grass density: Brown (bare) → Light green → Dark green (lush)
- Different hue tints for different grass types (subtle variation)

**Implementation**:
```typescript
import { ICanvasLayer, LayerRenderContext } from "./ICanvasLayer";
import { TerrainCell } from "@shared/schema";
import { VisualizationSettings } from "../types";

export class GrassLayer implements ICanvasLayer {
  id = "grass";
  
  shouldRender(settings: VisualizationSettings): boolean {
    return settings.colorMode === "grass";
  }
  
  getCellColor(cell: TerrainCell, settings: VisualizationSettings): string {
    const density = cell.grass_density ?? 0;
    const grassType = cell.grass_type ?? "default";
    
    // No grass - show terrain base color (brown/tan)
    if (density < 0.05) {
      // Arid brown based on moisture
      const moisture = cell.moisture ?? 0;
      const brownBase = 139 + Math.floor(moisture * 50);
      return `rgb(${brownBase}, ${Math.floor(brownBase * 0.7)}, ${Math.floor(brownBase * 0.4)})`;
    }
    
    // Grass present - green gradient based on density
    // Base green varies slightly by grass type
    let greenHue = { r: 34, g: 139, b: 34 }; // Forest green base
    
    switch (grassType) {
      case "cool_season":
        greenHue = { r: 46, g: 139, b: 87 }; // Sea green (cooler tone)
        break;
      case "warm_season":
        greenHue = { r: 107, g: 142, b: 35 }; // Olive drab (warmer tone)
        break;
      case "drought_resistant":
        greenHue = { r: 85, g: 107, b: 47 }; // Dark olive (muted)
        break;
      case "wetland":
        greenHue = { r: 0, g: 128, b: 0 }; // Pure green (vibrant)
        break;
    }
    
    // Interpolate from brown to grass color based on density
    if (density < 0.3) {
      // Sparse: brown to light green
      const factor = density / 0.3;
      const r = Math.floor(139 + (greenHue.r - 139) * factor);
      const g = Math.floor(90 + (greenHue.g - 90) * factor);
      const b = Math.floor(43 + (greenHue.b - 43) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (density < 0.7) {
      // Moderate: light green to medium green
      const factor = (density - 0.3) / 0.4;
      const r = Math.floor(greenHue.r * (1 - factor * 0.3));
      const g = greenHue.g;
      const b = Math.floor(greenHue.b * (1 - factor * 0.3));
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Lush: medium green to dark green
      const factor = (density - 0.7) / 0.3;
      const r = Math.floor(greenHue.r * (0.7 - factor * 0.4));
      const g = Math.floor(greenHue.g * (1 - factor * 0.2));
      const b = Math.floor(greenHue.b * (0.7 - factor * 0.4));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  
  render(context: LayerRenderContext): void {
    // Base rendering handled by CanvasRenderer using getCellColor
  }
}
```

---

## Task 2: Update VisualizationSettings

**File**: `client/src/components/canvas/types.ts`

Add grass to colorMode:
```typescript
colorMode: "default" | "heightmap" | "moisture" | "temperature" | "humidity" | "wind" | "pressure" | "grass";
```

---

## Task 3: Register GrassLayer

**File**: `client/src/components/canvas/CanvasRenderer.ts`

```typescript
// In constructor, add:
this.registerColorModeLayer("grass", new GrassLayer());
```

---

## Task 4: Add UI Controls

**File**: `client/src/pages/home.tsx`

Add to color mode dropdown:
```tsx
<SelectItem value="grass">Grass Coverage</SelectItem>
```

---

## Task 5: Update Cell Info Panel

**File**: `client/src/pages/home.tsx`

Add grass info to the selected cell panel:
```tsx
<div className="font-semibold flex items-center gap-1">
  <Leaf className="h-4 w-4" />
  Grass:
</div>
<div>
  {selectedCell.cell.grass_density != null && selectedCell.cell.grass_density > 0
    ? `${(selectedCell.cell.grass_density * 100).toFixed(0)}% (${selectedCell.cell.grass_type ?? "unknown"})`
    : "None"}
</div>
```

Import Leaf icon from lucide-react.

---

## Task 6: Handle Missing Data Gracefully

The grass data might not exist yet (Agent 4 runs in parallel). Ensure:
- `grass_density ?? 0` defaults to 0 if undefined
- `grass_type ?? "default"` defaults to "default" if undefined
- No crashes if schema fields don't exist yet

---

## Verification Steps

1. **Build passes**: `npm run build`
2. **Grass mode appears**: "Grass Coverage" shows in color mode dropdown
3. **Graceful fallback**: If no grass data exists, shows brown/bare terrain
4. **When grass data exists**: Shows green gradient based on density
5. **Cell info works**: Shows grass percentage and type when available

---

## Files to Create

| File | Purpose |
|------|---------|
| `canvas/layers/GrassLayer.ts` | Grass density visualization |

## Files to Modify

| File | Changes |
|------|---------|
| `canvas/types.ts` | Add "grass" to colorMode |
| `canvas/CanvasRenderer.ts` | Register GrassLayer |
| `canvas/layers/index.ts` | Export GrassLayer |
| `home.tsx` | Add dropdown option and cell info |

---

## Do NOT

- Do not modify backend files (Agent 4 handles that)
- Do not modify schema.ts (Agent 4 handles that)
- Do not break existing functionality
