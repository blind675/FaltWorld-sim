# Performance Optimization Guide

This document outlines performance bottlenecks and optimization strategies for scaling the FlatWorld simulation to large grid sizes.

## Current Performance Characteristics

### Grid Size Performance

| Grid Size | Cells | Memory (Est.) | Status | Notes |
|-----------|-------|---------------|--------|-------|
| 300x300 | 90K | ~15MB | ✅ Excellent | Smooth, no issues |
| 500x500 | 250K | ~40MB | ✅ Good | Current default |
| 1000x1000 | 1M | ~150MB | ⚠️ Usable | Frontend may lag |
| 2000x2000 | 4M | ~600MB | ⚠️ Slow | Requires optimizations |
| 5000x5000 | 25M | ~4GB | ❌ Poor | Frontend freezes |
| 10000x10000 | 100M | ~15GB | ❌ Crashes | Out of memory |

### Known Bottlenecks

#### 1. Frontend Rendering (gridSize > 1000)
- **Issue**: Canvas 2D renders all cells every frame
- **Impact**: 1M+ cells = 1-2 seconds per frame
- **Symptom**: UI freezes, unresponsive controls

#### 2. Data Transfer (gridSize > 1000)
- **Issue**: Entire grid sent as JSON on every update
- **Impact**: 50-100MB payloads over HTTP
- **Symptom**: Slow updates, network congestion

#### 3. Server Memory (gridSize > 10000)
- **Issue**: Full terrain grid stored in memory
- **Impact**: 100M cells × 150 bytes = 15GB+
- **Symptom**: Out of heap memory, crashes

#### 4. BFS Moisture Propagation (gridSize > 2000)
- **Issue**: Queue and visited set grow exponentially
- **Impact**: Processes millions of cells per tick
- **Symptom**: Slow ticks, hits `maxCellsProcessed` limit

## Optimization Strategies

### 🚀 Quick Wins (Implement First)

#### 1. Add HTTP Compression
**Impact**: 70-80% reduction in payload size  
**Effort**: 5 minutes  
**Implementation**:

```typescript
// server/index.ts
import compression from 'compression';

app.use(compression({
  level: 6, // Balance between speed and compression
  threshold: 1024, // Only compress responses > 1KB
}));
```

**Install dependency**:
```bash
npm install compression
npm install --save-dev @types/compression
```

#### 2. Implement Level-of-Detail (LOD) Rendering
**Impact**: 90% reduction in rendered cells for large grids  
**Effort**: 30 minutes  
**Implementation**:

```typescript
// client/src/components/TerrainCanvas.tsx
// Add to rendering loop:

const getLOD = (gridSize: number, zoomLevel: number): number => {
  // Calculate skip factor based on grid size and zoom
  if (gridSize > 5000) return Math.max(1, Math.floor(gridSize / 1000 / zoomLevel));
  if (gridSize > 2000) return Math.max(1, Math.floor(gridSize / 500 / zoomLevel));
  if (gridSize > 1000) return Math.max(1, Math.floor(2 / zoomLevel));
  return 1; // Render all cells for small grids
};

// In render function:
const step = getLOD(terrain.length, settings.zoomLevel);

for (let y = 0; y < terrain.length; y += step) {
  for (let x = 0; x < terrain[0].length; x += step) {
    const cell = terrain[y][x];
    // ... render cell
  }
}
```

#### 3. Limit BFS Processing Per Tick
**Impact**: Prevents server slowdown on large grids  
**Effort**: 10 minutes  
**Implementation**:

```typescript
// server/storage.ts - in propagateMoisture()
// Replace line ~352:

const gridSize = this.terrain.length * this.terrain[0].length;
const effectiveLimit = Math.min(
  MAX_CELLS_PROCESSED, 
  Math.floor(gridSize * 0.1) // Process max 10% of grid per tick
);

while (queue.length > 0 && cellsProcessed < effectiveLimit) {
  // ... existing BFS code
}
```

### 🎯 Medium-Term Optimizations

#### 4. Viewport Culling
**Impact**: Only render visible cells  
**Effort**: 2-3 hours  
**Implementation**:

```typescript
// client/src/components/TerrainCanvas.tsx

interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const getVisibleBounds = (
  panOffset: { x: number; y: number },
  zoomLevel: number,
  canvasWidth: number,
  canvasHeight: number,
  gridSize: number
): ViewportBounds => {
  const cellSize = Math.min(canvasWidth, canvasHeight) / gridSize * zoomLevel;
  
  return {
    minX: Math.max(0, Math.floor(-panOffset.x / cellSize)),
    maxX: Math.min(gridSize, Math.ceil((-panOffset.x + canvasWidth) / cellSize)),
    minY: Math.max(0, Math.floor(-panOffset.y / cellSize)),
    maxY: Math.min(gridSize, Math.ceil((-panOffset.y + canvasHeight) / cellSize))
  };
};

// In render function:
const bounds = getVisibleBounds(panOffset, zoomLevel, width, height, terrain.length);

for (let y = bounds.minY; y < bounds.maxY; y++) {
  for (let x = bounds.minX; x < bounds.maxX; x++) {
    // ... render only visible cells
  }
}
```

#### 5. Chunked API Endpoints
**Impact**: Reduce payload size by 95%+  
**Effort**: 4-6 hours  
**Implementation**:

```typescript
// server/routes.ts
app.get("/api/terrain/chunk", (req, res) => {
  const x = parseInt(req.query.x as string);
  const y = parseInt(req.query.y as string);
  const size = parseInt(req.query.size as string) || 100;
  
  const chunk = storage.getTerrainChunk(x, y, size);
  res.json(chunk);
});

// server/storage.ts
getTerrainChunk(startX: number, startY: number, size: number): TerrainCell[][] {
  const chunk: TerrainCell[][] = [];
  const endX = Math.min(startX + size, this.terrain[0].length);
  const endY = Math.min(startY + size, this.terrain.length);
  
  for (let y = startY; y < endY; y++) {
    chunk.push(this.terrain[y].slice(startX, endX));
  }
  
  return chunk;
}
```

```typescript
// client/src/hooks/useTerrainChunks.ts
export const useTerrainChunks = (chunkSize: number = 100) => {
  const [chunks, setChunks] = useState<Map<string, TerrainCell[][]>>(new Map());
  
  const loadChunk = async (x: number, y: number) => {
    const key = `${x},${y}`;
    if (chunks.has(key)) return;
    
    const chunk = await fetch(`/api/terrain/chunk?x=${x}&y=${y}&size=${chunkSize}`)
      .then(r => r.json());
    
    setChunks(prev => new Map(prev).set(key, chunk));
  };
  
  return { chunks, loadChunk };
};
```

#### 6. Use Typed Arrays for Server Storage
**Impact**: 60-70% memory reduction  
**Effort**: 1-2 days  
**Implementation**:

```typescript
// server/compactTerrain.ts
export class CompactTerrain {
  private data: Float32Array;
  private width: number;
  private height: number;
  
  // Properties per cell (13 total)
  private static readonly PROPS_PER_CELL = 13;
  private static readonly X = 0;
  private static readonly Y = 1;
  private static readonly ALTITUDE = 2;
  private static readonly TERRAIN_HEIGHT = 3;
  private static readonly WATER_HEIGHT = 4;
  private static readonly DISTANCE_FROM_WATER = 5;
  private static readonly BASE_MOISTURE = 6;
  private static readonly ADDED_MOISTURE = 7;
  private static readonly MOISTURE = 8;
  private static readonly TEMPERATURE = 9;
  private static readonly AIR_HUMIDITY = 10;
  private static readonly TYPE = 11; // Encoded as number
  private static readonly RIVER_ID = 12;
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Float32Array(width * height * CompactTerrain.PROPS_PER_CELL);
  }
  
  private getIndex(x: number, y: number): number {
    return (y * this.width + x) * CompactTerrain.PROPS_PER_CELL;
  }
  
  getCell(x: number, y: number): TerrainCell {
    const idx = this.getIndex(x, y);
    return {
      x: this.data[idx + CompactTerrain.X],
      y: this.data[idx + CompactTerrain.Y],
      altitude: this.data[idx + CompactTerrain.ALTITUDE],
      terrain_height: this.data[idx + CompactTerrain.TERRAIN_HEIGHT],
      water_height: this.data[idx + CompactTerrain.WATER_HEIGHT],
      distance_from_water: this.data[idx + CompactTerrain.DISTANCE_FROM_WATER],
      base_moisture: this.data[idx + CompactTerrain.BASE_MOISTURE],
      added_moisture: this.data[idx + CompactTerrain.ADDED_MOISTURE],
      moisture: this.data[idx + CompactTerrain.MOISTURE],
      temperature: this.data[idx + CompactTerrain.TEMPERATURE],
      air_humidity: this.data[idx + CompactTerrain.AIR_HUMIDITY],
      type: this.decodeType(this.data[idx + CompactTerrain.TYPE]),
      river_name: null, // Store separately if needed
    };
  }
  
  setCell(x: number, y: number, cell: Partial<TerrainCell>): void {
    const idx = this.getIndex(x, y);
    if (cell.altitude !== undefined) this.data[idx + CompactTerrain.ALTITUDE] = cell.altitude;
    if (cell.moisture !== undefined) this.data[idx + CompactTerrain.MOISTURE] = cell.moisture;
    // ... set other properties
  }
  
  private decodeType(encoded: number): string {
    const types = ["rock", "earth", "mud", "river", "spring"];
    return types[Math.floor(encoded)] || "rock";
  }
  
  private encodeType(type: string): number {
    const types = ["rock", "earth", "mud", "river", "spring"];
    return types.indexOf(type);
  }
}
```

**Memory savings**: 
- Before: 100M cells × 150 bytes = 15GB
- After: 100M cells × 52 bytes = 5.2GB
- **Reduction: 65%**

### 🔬 Advanced Optimizations

#### 7. WebGL Rendering
**Impact**: 100x faster rendering for large grids  
**Effort**: 1-2 weeks  
**Technology**: Three.js or raw WebGL  

**Benefits**:
- GPU-accelerated rendering
- Can handle 10M+ cells at 60 FPS
- Efficient for height maps and color gradients

**Implementation outline**:
```typescript
// Use Three.js PlaneGeometry with vertex colors
// Each cell = 1 vertex with color based on moisture/elevation
// Update vertex colors on data change
```

#### 8. Spatial Partitioning (Quadtree/Grid)
**Impact**: O(log n) lookups instead of O(n)  
**Effort**: 1 week  

**Use cases**:
- Neighbor queries
- Range queries (find all cells in area)
- Collision detection

#### 9. Multi-threaded Processing
**Impact**: 2-4x faster updates on multi-core systems  
**Effort**: 2-3 weeks  
**Technology**: Worker threads (Node.js)

```typescript
// server/workers/moistureWorker.ts
import { parentPort, workerData } from 'worker_threads';

// Process moisture for a chunk of the grid
const processChunk = (terrain: TerrainCell[][], startY: number, endY: number) => {
  // ... moisture propagation logic
};

parentPort?.postMessage(result);
```

#### 10. Database-Backed Storage
**Impact**: Support unlimited grid sizes  
**Effort**: 2-3 weeks  
**Technology**: PostgreSQL with PostGIS or Redis

**Benefits**:
- Persistent storage
- Can handle grids larger than RAM
- Query only needed cells

**Drawbacks**:
- Slower than in-memory
- More complex architecture

#### 11. Incremental Updates
**Impact**: Only send changed cells to frontend  
**Effort**: 1 week  

```typescript
// Track dirty cells
private dirtySet = new Set<string>();

markDirty(x: number, y: number) {
  this.dirtySet.add(`${x},${y}`);
}

getDirtyUpdates(): TerrainCell[] {
  const updates = Array.from(this.dirtySet).map(key => {
    const [x, y] = key.split(',').map(Number);
    return this.terrain[y][x];
  });
  
  this.dirtySet.clear();
  return updates;
}
```

## Recommended Implementation Order

### Phase 1: Quick Wins (1-2 days)
1. ✅ Add HTTP compression
2. ✅ Implement LOD rendering
3. ✅ Limit BFS processing per tick

**Expected result**: gridSize 1000 works smoothly

### Phase 2: Medium-Term (1-2 weeks)
4. ✅ Viewport culling
5. ✅ Chunked API endpoints
6. ✅ Typed arrays for storage

**Expected result**: gridSize 2000-5000 usable

### Phase 3: Advanced (1-2 months)
7. ✅ WebGL rendering
8. ✅ Spatial partitioning
9. ✅ Multi-threaded processing

**Expected result**: gridSize 10000+ possible

### Phase 4: Scale-Out (2-3 months)
10. ✅ Database-backed storage
11. ✅ Incremental updates
12. ✅ Server-side rendering/streaming

**Expected result**: Unlimited grid sizes

## Configuration Recommendations by Grid Size

### Small Grids (< 500)
```typescript
// server/config.ts
gridSize: 300,
maxCellsProcessed: 1000000,
transferRate: 0.05,

// No special optimizations needed
```

### Medium Grids (500-1000)
```typescript
gridSize: 1000,
maxCellsProcessed: 2000000,
transferRate: 0.04,

// Enable:
// - HTTP compression
// - LOD rendering (step = 2)
```

### Large Grids (1000-5000)
```typescript
gridSize: 2000,
maxCellsProcessed: 5000000,
transferRate: 0.03,

// Enable:
// - HTTP compression
// - LOD rendering (step = 4)
// - Viewport culling
// - Chunked API
```

### Very Large Grids (5000+)
```typescript
gridSize: 10000,
maxCellsProcessed: 10000000,
transferRate: 0.02,

// Enable:
// - All above optimizations
// - Typed arrays
// - WebGL rendering
// - Multi-threading
```

## Performance Monitoring

### Add Performance Metrics

```typescript
// server/storage.ts
private performanceMetrics = {
  moistureTime: 0,
  humidityTime: 0,
  temperatureTime: 0,
  totalCells: 0,
};

landUpdate() {
  const startTime = performance.now();
  
  this.propagateMoisture();
  this.performanceMetrics.moistureTime = performance.now() - startTime;
  
  // Log every 10 ticks
  if (this.gameTime.hour % 10 === 0) {
    console.log('[perf]', this.performanceMetrics);
  }
}
```

### Monitor Memory Usage

```typescript
// server/index.ts
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('[memory]', {
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`,
  });
}, 60000); // Every minute
```

## Troubleshooting Performance Issues

### Frontend Freezing
**Symptoms**: UI unresponsive, browser tab frozen  
**Solutions**:
1. Enable LOD rendering
2. Implement viewport culling
3. Reduce grid size
4. Switch to WebGL

### Slow Server Updates
**Symptoms**: Console shows "Hit cell processing limit"  
**Solutions**:
1. Increase `maxCellsProcessed`
2. Reduce `maxPropagationDistance`
3. Implement multi-threading
4. Use typed arrays

### Out of Memory
**Symptoms**: Server crashes with "JavaScript heap out of memory"  
**Solutions**:
1. Increase Node.js heap: `NODE_OPTIONS='--max-old-space-size=16384'`
2. Reduce grid size
3. Use typed arrays
4. Implement database-backed storage

### Network Lag
**Symptoms**: Long delays between updates  
**Solutions**:
1. Enable HTTP compression
2. Implement chunked API
3. Add incremental updates
4. Reduce update frequency

## Future Considerations

### Distributed Computing
For extremely large simulations (100K+ grid):
- Split grid across multiple servers
- Each server handles a region
- Coordinate boundary updates via message queue

### GPU Acceleration
Use GPU compute shaders for:
- Moisture diffusion
- Temperature calculations
- Humidity propagation

### Streaming Architecture
- Server streams updates via WebSocket
- Client maintains local cache
- Only send deltas, not full state

## Benchmarks

### Target Performance Goals

| Grid Size | Render FPS | Update Time | Memory | Status |
|-----------|------------|-------------|--------|--------|
| 300 | 60 | <10ms | <50MB | ✅ Achieved |
| 500 | 60 | <50ms | <100MB | ✅ Achieved |
| 1000 | 30+ | <200ms | <500MB | ⚠️ With LOD |
| 2000 | 30+ | <500ms | <2GB | ⚠️ Needs chunking |
| 5000 | 15+ | <2s | <8GB | ❌ Needs WebGL |
| 10000 | 15+ | <5s | <20GB | ❌ Needs all optimizations |

## Summary

**Current State**: Works well up to 500x500, usable up to 1000x1000  
**With Quick Wins**: Works well up to 1000x1000, usable up to 2000x2000  
**With Medium-Term**: Works well up to 2000x2000, usable up to 5000x5000  
**With Advanced**: Can handle 10000x10000 and beyond

**Priority**: Implement Phase 1 (Quick Wins) first for immediate 4x improvement in maximum usable grid size.
