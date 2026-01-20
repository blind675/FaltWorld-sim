# AI Agent Prompt 2: Weather Visualization

## ⚠️ PREREQUISITE
Run Agent 1 (TerrainCanvas Refactor) first. This agent creates new layer files in the modular architecture.

## Objective
Add weather visualization layers: Pressure map, Cloud overlay, and Precipitation animation. These are new layer files that plug into the refactored canvas architecture.

## Context
After Agent 1 completes, the canvas uses a layer-based architecture:
- Each visualization is a separate layer file
- Layers implement `ICanvasLayer` interface
- Layers are registered with `CanvasRenderer`

## Current Weather Data Available
From `schema.ts`, cells have:
- `atmospheric_pressure` - pressure value
- `cloud_density` - 0-1 cloud coverage
- `precipitation_rate` - current rainfall intensity
- `ground_wetness` - wet ground from rain

---

## Task 1: Create PressureLayer

**File**: `client/src/components/canvas/layers/PressureLayer.ts`

**Purpose**: Color-coded pressure visualization (like weather maps)

**Logic**:
- Add "pressure" to colorMode options in `types.ts`
- Color gradient: Blue (low pressure) → Green (normal) → Red (high pressure)
- Typical pressure range: 980-1040 hPa equivalent (normalize your values)

**Implementation**:
```typescript
export class PressureLayer implements ICanvasLayer {
  id = "pressure";
  
  shouldRender(settings: VisualizationSettings): boolean {
    return settings.colorMode === "pressure";
  }
  
  getCellColor(cell: TerrainCell, settings: VisualizationSettings): string {
    const pressure = cell.atmospheric_pressure ?? 1013;
    const minPressure = 980;
    const maxPressure = 1040;
    const normalized = (pressure - minPressure) / (maxPressure - minPressure);
    const clamped = Math.max(0, Math.min(1, normalized));
    
    // Blue (low) → Green (normal) → Red (high)
    if (clamped < 0.5) {
      // Blue to Green
      const factor = clamped * 2;
      return `rgb(${Math.floor(factor * 100)}, ${Math.floor(150 + factor * 105)}, ${Math.floor(255 * (1 - factor))})`;
    } else {
      // Green to Red
      const factor = (clamped - 0.5) * 2;
      return `rgb(${Math.floor(100 + factor * 155)}, ${Math.floor(255 * (1 - factor))}, 0)`;
    }
  }
  
  render(context: LayerRenderContext): void {
    // Base rendering handled by CanvasRenderer using getCellColor
  }
}
```

---

## Task 2: Create CloudLayer

**File**: `client/src/components/canvas/layers/CloudLayer.ts`

**Purpose**: Semi-transparent white overlay showing cloud coverage

**Logic**:
- Overlay layer (renders on top of terrain)
- White fill with alpha based on `cloud_density`
- Only render if `cloud_density > 0.1` (skip clear cells)
- Should be toggleable via settings (add `showClouds` to VisualizationSettings)

**Implementation**:
```typescript
export class CloudLayer implements ICanvasLayer {
  id = "clouds";
  
  shouldRender(settings: VisualizationSettings): boolean {
    return settings.showClouds === true;
  }
  
  render(context: LayerRenderContext): void {
    const { ctx, terrainGrid, cellWidth, cellHeight, startX, startY, endX, endY, 
            normalizedPanX, normalizedPanY, gridSize } = context;
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const wrappedX = ((x % gridSize) + gridSize) % gridSize;
        const wrappedY = ((y % gridSize) + gridSize) % gridSize;
        
        const cell = terrainGrid[wrappedY]?.[wrappedX];
        if (!cell) continue;
        
        const cloudDensity = cell.cloud_density ?? 0;
        if (cloudDensity < 0.1) continue;
        
        // White overlay with alpha based on cloud density
        const alpha = Math.min(0.7, cloudDensity * 0.8);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(
          x * cellWidth + normalizedPanX,
          y * cellHeight + normalizedPanY,
          Math.ceil(cellWidth + 1),
          Math.ceil(cellHeight + 1)
        );
      }
    }
  }
}
```

---

## Task 3: Create PrecipitationLayer

**File**: `client/src/components/canvas/layers/PrecipitationLayer.ts`

**Purpose**: Animated rain effect overlay

**Logic**:
- Overlay layer showing rainfall
- Blue diagonal lines or dots based on `precipitation_rate`
- Animation: lines/dots move downward over time
- Only render if `precipitation_rate > 0`
- Should be toggleable via settings (add `showPrecipitation` to VisualizationSettings)

**Implementation**:
```typescript
export class PrecipitationLayer implements ICanvasLayer {
  id = "precipitation";
  private animationOffset = 0;
  
  shouldRender(settings: VisualizationSettings): boolean {
    return settings.showPrecipitation === true;
  }
  
  render(context: LayerRenderContext): void {
    const { ctx, terrainGrid, cellWidth, cellHeight, startX, startY, endX, endY,
            normalizedPanX, normalizedPanY, gridSize, settings } = context;
    
    // Advance animation
    this.animationOffset = (this.animationOffset + 2) % 20;
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const wrappedX = ((x % gridSize) + gridSize) % gridSize;
        const wrappedY = ((y % gridSize) + gridSize) % gridSize;
        
        const cell = terrainGrid[wrappedY]?.[wrappedX];
        if (!cell) continue;
        
        const precipRate = cell.precipitation_rate ?? 0;
        if (precipRate < 0.05) continue;
        
        const cellX = x * cellWidth + normalizedPanX;
        const cellY = y * cellHeight + normalizedPanY;
        
        // Draw rain lines
        const intensity = Math.min(1, precipRate * 2);
        const numLines = Math.floor(intensity * 3) + 1;
        
        ctx.strokeStyle = `rgba(100, 149, 237, ${0.3 + intensity * 0.4})`; // Cornflower blue
        ctx.lineWidth = 1;
        
        for (let i = 0; i < numLines; i++) {
          const offsetX = (cellWidth / (numLines + 1)) * (i + 1);
          const startYOffset = ((this.animationOffset + i * 7) % 20) - 10;
          
          ctx.beginPath();
          ctx.moveTo(cellX + offsetX, cellY + startYOffset);
          ctx.lineTo(cellX + offsetX - 3, cellY + startYOffset + 10);
          ctx.stroke();
        }
      }
    }
  }
}
```

---

## Task 4: Update VisualizationSettings

**File**: `client/src/components/canvas/types.ts`

Add new settings:
```typescript
export interface VisualizationSettings {
  // ... existing settings
  colorMode: "default" | "heightmap" | "moisture" | "temperature" | "humidity" | "wind" | "pressure";
  showClouds: boolean;
  showPrecipitation: boolean;
}
```

Update default settings in TerrainCanvas.tsx:
```typescript
const defaultSettings: VisualizationSettings = {
  // ... existing
  showClouds: false,
  showPrecipitation: false,
};
```

---

## Task 5: Register New Layers

**File**: `client/src/components/canvas/CanvasRenderer.ts`

```typescript
// In constructor, add:
this.registerColorModeLayer("pressure", new PressureLayer());
this.registerOverlayLayer(new CloudLayer());
this.registerOverlayLayer(new PrecipitationLayer());
```

---

## Task 6: Add UI Controls

**File**: `client/src/pages/home.tsx`

Add to color mode dropdown:
```tsx
<SelectItem value="pressure">Pressure</SelectItem>
```

Add toggle checkboxes:
```tsx
<div className="flex items-center gap-2">
  <input 
    type="checkbox" 
    checked={settings.showClouds}
    onChange={(e) => updateSettings({ showClouds: e.target.checked })}
  />
  <label>Show Clouds</label>
</div>
<div className="flex items-center gap-2">
  <input 
    type="checkbox" 
    checked={settings.showPrecipitation}
    onChange={(e) => updateSettings({ showPrecipitation: e.target.checked })}
  />
  <label>Show Precipitation</label>
</div>
```

---

## Task 7: Update Cell Info Panel

**File**: `client/src/pages/home.tsx`

Add pressure, cloud, and precipitation info to the selected cell panel:
```tsx
<div className="font-semibold flex items-center gap-1">
  <Cloud className="h-4 w-4" />
  Clouds:
</div>
<div>
  {selectedCell.cell.cloud_density != null
    ? `${(selectedCell.cell.cloud_density * 100).toFixed(0)}%`
    : "N/A"}
</div>

<div className="font-semibold">Pressure:</div>
<div>
  {selectedCell.cell.atmospheric_pressure != null
    ? `${selectedCell.cell.atmospheric_pressure.toFixed(0)} hPa`
    : "N/A"}
</div>

<div className="font-semibold">Rain:</div>
<div>
  {selectedCell.cell.precipitation_rate != null && selectedCell.cell.precipitation_rate > 0
    ? `${(selectedCell.cell.precipitation_rate * 100).toFixed(0)}%`
    : "None"}
</div>
```

Import Cloud icon from lucide-react.

---

## Task 8: Update Documentation

Update `PDR.md` Milestone 2.3 checkboxes:
- [x] Pressure map layer
- [x] Cloud overlay
- [x] Precipitation animation

Update `README.md` with new visualization modes.

---

## Verification Steps

1. **Build passes**: `npm run build`
2. **Pressure mode works**: Select "Pressure" in color mode dropdown, see blue-green-red gradient
3. **Cloud overlay works**: Toggle "Show Clouds", see white overlay on cloudy cells
4. **Rain animation works**: Toggle "Show Precipitation", see animated rain lines
5. **Cell info shows new data**: Click a cell, verify pressure/cloud/rain values shown
6. **No conflicts**: Other visualization modes still work

---

## Files to Create

| File | Purpose |
|------|---------|
| `canvas/layers/PressureLayer.ts` | Pressure color mode |
| `canvas/layers/CloudLayer.ts` | Cloud overlay |
| `canvas/layers/PrecipitationLayer.ts` | Rain animation |

## Files to Modify

| File | Changes |
|------|---------|
| `canvas/types.ts` | Add new settings |
| `canvas/CanvasRenderer.ts` | Register new layers |
| `canvas/layers/index.ts` | Export new layers |
| `home.tsx` | Add UI controls and cell info |
| `PDR.md` | Update checkboxes |
| `README.md` | Document new features |

---

## Do NOT

- Do not modify backend files
- Do not change existing layer behavior
- Do not break existing functionality
