# World Generation System

## Overview
The world generation system has been refactored into a separate module with wrapping Perlin noise for seamless circular world generation.

## Architecture

### Files
- **`server/worldGenerator.ts`** - New dedicated world generation module
- **`server/storage.ts`** - Refactored to use WorldGenerator

## Wrapping Perlin Noise

### Problem
Standard Perlin noise creates visible seams at world edges when the map wraps around (circular world).

### Solution
The new `WrappingPerlinNoise` class implements **torus-based noise sampling**:

1. **Maps 2D coordinates to 4D torus surface**
   - Converts grid coordinates to angles: `angle = (coord / gridSize) * 2π`
   - Projects onto 4D torus: `(cos(θ), sin(θ), cos(φ), sin(φ))`

2. **Samples noise in 4D space**
   - Takes two 2D noise samples from the torus coordinates
   - Combines them for seamless wrapping in both X and Y directions

3. **Result**: Perfectly seamless terrain that wraps horizontally and vertically

### Benefits
- ✅ No visible seams when panning past world edges
- ✅ Consistent terrain features across boundaries
- ✅ True circular/toroidal world topology
- ✅ Matches the wrapping logic in the frontend rendering

## WorldGenerator Class

### Configuration
```typescript
interface WorldConfig {
  gridSize: number;           // World dimensions (300x300)
  noiseScale: number;         // Noise frequency (0.02)
  numberOfSprings: number;    // River sources (8)
  minHeight: number;          // -200m
  maxHeight: number;          // 2200m
  springMinHeight: number;    // 1700m (spring elevation range)
  springMaxHeight: number;    // 1900m
}
```

### Methods

#### `generateTerrain(): TerrainGrid`
Generates a complete terrain grid using wrapping Perlin noise.

#### `selectSpringPoints(terrain): Point[]`
Finds suitable high-elevation points for river springs.

#### `regenerate(): void`
Creates a new noise seed for completely different terrain.

## Usage

```typescript
// Initialize
const worldGen = new WorldGenerator(DEFAULT_WORLD_CONFIG);

// Generate terrain
const terrain = worldGen.generateTerrain();

// Select springs
const springs = worldGen.selectSpringPoints(terrain);

// Regenerate for new world
worldGen.regenerate();
const newTerrain = worldGen.generateTerrain();
```

## Integration with Storage

The `MemStorage` class now:
1. Uses `WorldGenerator` instead of local `PerlinNoise`
2. Delegates terrain generation to the world generator
3. Delegates spring selection to the world generator
4. Calls `regenerate()` before each new terrain generation

## Technical Details

### Torus Mapping Mathematics
For a point `(x, y)` on a grid of size `N`:

```
nx = x / N
ny = y / N

angleX = nx * 2π
angleY = ny * 2π

radius = 1 / (2π)

s = cos(angleX) * radius
t = sin(angleX) * radius
u = cos(angleY) * radius
v = sin(angleY) * radius

noise = (sample2D(s, t) + sample2D(u, v)) / 2
```

This creates a 4D torus where:
- Moving in X wraps around the first circle
- Moving in Y wraps around the second circle
- The noise is continuous across all boundaries

## Future Enhancements

Potential improvements:
- Multi-octave noise for more detailed terrain
- Biome-specific noise parameters
- Configurable wrapping (optional non-wrapping worlds)
- Noise caching for performance
- Different noise algorithms (Simplex, Worley, etc.)
