# Wrapping Noise Implementation - Unity to TypeScript

## Overview
Implemented proper 4D torus-based noise generation matching the Unity C# AccidentalNoise library for seamless world wrapping.

## Key Changes

### 1. 4D Noise Implementation
Added `sampleNoise4D()` method that samples Perlin noise in 4D space:
- Uses 4D gradient function `grad4d()`
- Properly interpolates across all 4 dimensions
- Required for seamless torus mapping

### 2. Torus Mapping (Unity Method)
The `wrappingNoise()` method now matches Unity's implementation exactly:

```typescript
// Normalize to [0, 1]
const s = x / gridSize;
const t = y / gridSize;

// Map to 4D torus coordinates
const x1 = 0, x2 = 2;
const y1 = 0, y2 = 2;
const dx = x2 - x1;
const dy = y2 - y1;

// Calculate 4D coordinates
const nx = x1 + Math.cos(s * 2 * Math.PI) * dx / (2 * Math.PI);
const ny = y1 + Math.cos(t * 2 * Math.PI) * dy / (2 * Math.PI);
const nz = x1 + Math.sin(s * 2 * Math.PI) * dx / (2 * Math.PI);
const nw = y1 + Math.sin(t * 2 * Math.PI) * dy / (2 * Math.PI);
```

### 3. Multi-Octave Fractal Noise
- **10 octaves** (matches Unity `terrainOctaves`)
- **Lacunarity: 2.0** (frequency multiplier per octave)
- **Amplitude decay: 0.5** per octave
- Fractional Brownian Motion (FBM) pattern

### 4. Updated Configuration
```typescript
{
  noiseScale: 1.25,      // Unity terrainFrequency
  minHeight: 0,          // Unity MIN_HEIGHT_VALUE
  maxHeight: 8000,       // Unity MAX_HEIGHT_VALUE
  springMinHeight: 6000, // Adjusted for new range
  springMaxHeight: 7000
}
```

## How It Works

### The 4D Torus Concept
A 2D plane can wrap seamlessly by mapping it to a 4D torus:
- X-axis wraps via `(cos(x), sin(x))` → 2D circle
- Y-axis wraps via `(cos(y), sin(y))` → 2D circle
- Combined: 4D torus (circle × circle)

### Why This Works
1. **Continuous**: No discontinuities at edges
2. **Periodic**: Naturally wraps at boundaries
3. **Smooth**: Gradients flow seamlessly across edges
4. **Proven**: Same method used in Unity implementation

### Noise Range
- Raw 4D noise: approximately `[-1, 1]`
- After normalization: `[0, 1]`
- After height mapping: `[0, 8000]`

## Comparison: Old vs New

### Old Implementation
- Combined two 2D noise samples
- Simple octave layering
- Radius calculation: `1.0 / (2π)`
- 6 octaves
- Scale: 0.015

### New Implementation (Unity-based)
- True 4D noise sampling
- Proper torus coordinate mapping
- Range: `[0, 2]` for torus space
- 10 octaves
- Scale: 1.25 (frequency)

## Expected Results

### Terrain Characteristics
- **Seamless wrapping** at all edges
- **Natural elevation changes** with 10 octaves of detail
- **Higher peaks** (up to 8000m vs 2200m)
- **More varied terrain** due to increased octaves
- **No visible seams** when panning across boundaries

### Visual Improvements
- Smoother transitions at world edges
- More realistic mountain formations
- Better detail at multiple scales
- Consistent noise pattern across wrapping boundaries

## Technical Notes

### 4D Gradient Function
Uses 32 gradient directions (5 bits) for 4D space:
```typescript
const h = hash & 31;
const u = h < 24 ? x : y;
const v = h < 16 ? y : z;
const s = h < 8 ? z : w;
return ((h & 1) ? -u : u) + ((h & 2) ? -v : v) + ((h & 4) ? -s : s);
```

### Performance Considerations
- 4D noise is more expensive than 2D
- 10 octaves vs 6 increases computation
- Trade-off: Better quality for slightly slower generation
- Generation is one-time cost (cached terrain)

## Testing
To verify wrapping works correctly:
1. Generate terrain
2. Pan to right edge of map
3. Should seamlessly transition to left edge
4. Check for height discontinuities (should be none)
5. Verify rivers and features flow naturally across boundaries

## References
- Unity AccidentalNoise library
- Perlin noise 4D implementation
- Torus topology for seamless textures
- Fractional Brownian Motion (FBM)
