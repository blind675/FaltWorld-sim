# Moisture & Humidity System Configuration Guide

All moisture and humidity parameters are centralized in configuration files for easy tweaking.

## Locations
- **Moisture Config**: `/server/config.ts` → `MOISTURE_CONFIG`
- **Humidity Config**: `/server/config.ts` → `EVAPORATION_CONFIG`
- **Spring Generation**: `/server/worldGenerator.ts` → `selectSpringPoints()`

## Recent Improvements (December 2024)

### ✅ Moisture System Enhancements
1. **Toroidal Distance Calculation**: Spring placement now accounts for map wrapping
2. **Iterative Diffusion Algorithm**: Replaced BFS with smooth diffusion for realistic gradients
3. **Realistic Parameters**: Adjusted for higher moisture near water (70-85% vs previous 50%)
4. **Smooth Gradients**: Eliminated blocky patterns and sharp cutoffs
5. **Dynamic Spring Count**: Springs are now a maximum, not exact count (4-6 springs typical)
6. **Minimum Spring Distance**: Springs spread across entire map instead of clustering

### ✅ Humidity System Enhancements
1. **Increased Evaporation Rates**: Faster humidity changes (visible within 10-20 ticks)
2. **Temperature-Dependent Evaporation**: Warmer water evaporates faster
3. **Ground Evapotranspiration**: Land moisture contributes to air humidity
4. **Humidity Diffusion**: Air humidity spreads between cells naturally

## Configuration Parameters

### Base Moisture Transfer
```typescript
maxLandMoisture: 0.85
```
- Maximum moisture a land cell can hold (0.0 to 1.0)
- Higher = cells can get wetter
- Recommended range: 0.7 - 0.9

```typescript
transferRate: 0.05
```
- Base amount of moisture spread each tick
- Higher = faster moisture spread and higher moisture values near water
- **Current value (0.05)**: Allows 70-85% moisture near water sources
- **Old value (0.025)**: Only reached ~50% moisture
- Recommended range: 0.03 - 0.08

```typescript
minTransfer: 0.00001
```
- Stop propagating below this threshold
- Lower = moisture spreads further with smoother gradients
- **Current value (0.00001)**: Eliminates sharp cutoff lines
- **Old value (0.00005)**: Created visible boundary where moisture stopped
- Recommended range: 0.000005 - 0.00005

### Propagation Limits
```typescript
maxPropagationDistance: 1000
```
- Maximum cells moisture can travel per tick (or disable by commenting out the check)
- Higher = wider moisture zones without artificial boundaries
- **Current value (1000)**: Effectively unlimited for most maps
- **Old value (50)**: Created horizontal line artifacts where propagation stopped
- Recommended range: 500 - 2000 (or disable for natural spread)
- **Note**: With iterative diffusion, this limit is less critical

```typescript
maxCellsProcessed: 5000000
```
- Hard limit on cells processed per tick (performance)
- Higher = more complete propagation (but slower)
- **Current value (5M)**: Handles up to ~2000x2000 grids per tick
- **Old value (500k)**: Caused incomplete propagation on large maps
- Recommended range: 1000000 - 10000000
- **Performance impact**: Adjust based on grid size (see PERFORMANCE_OPTIMIZATION.md)

### Altitude Effects (Percentage-Based)
```typescript
uphillPenaltyPercent: 0.0006
```
- % reduction per meter when going uphill
- Higher = harder for moisture to climb
- Recommended range: 0.0003 - 0.001
- Example: 100m climb = 6% penalty

```typescript
altitudeDrynessPercent: 0.0001
```
- % reduction based on absolute altitude
- Higher = mountains are drier
- **Current value (0.0001)**: Less aggressive drying, more realistic
- **Old value (0.0004)**: Made mountains too dry
- Recommended range: 0.00005 - 0.0003
- Example: 1000m elevation = 10% drier (current) vs 40% drier (old)

```typescript
downhillBonusPercent: 0.0003
```
- % bonus per meter when going downhill
- Higher = moisture flows easier downhill
- Recommended range: 0.0001 - 0.0005
- Example: 100m descent = 3% bonus

### Water Volume Effects
```typescript
waterVolumeBoostFactor: 0.3
```
- Multiplier for water height boost
- Higher = water volume has more influence
- Recommended range: 0.2 - 0.5
- Formula: boost = 1.0 + (water_height × factor)

```typescript
maxWaterVolumeBoost: 1.5
```
- Maximum boost from water volume
- Caps the total boost to prevent extreme values
- Recommended range: 1.0 - 2.0
- Example: 1.5 = up to 2.5x moisture (1.0 + 1.5)

### Diminishing Returns
```typescript
saturationExponent: 0.8
```
- Controls how aggressively moisture saturates
- Lower = less aggressive, allows higher moisture near water
- Higher = more aggressive, creates steeper gradients
- **Current value (0.8)**: Allows 70-85% moisture near water
- **Old value (1.2)**: Limited moisture to ~50% near water
- Recommended range: 0.6 - 1.5
- Formula: diminishingReturns = saturationFactor^exponent

**Effect of different values:**
- 0.6 = Very gentle, high moisture zones (80-85%)
- 0.8 = Gentle, realistic moisture (70-85%) **← Current**
- 1.0 = Linear saturation (moderate)
- 1.2 = Slight curve (steeper gradients)
- 1.5 = Moderate curve (aggressive)
- 2.0 = Steep curve (very aggressive, dry)

### Evaporation
```typescript
baseDecay: 0.995
```
- Global evaporation rate
- (1 - this value) = % moisture lost per tick
- **Current value (0.995)**: 0.5% evaporation per tick (slower, more stable)
- **Old value (0.99)**: 1% evaporation per tick (faster drying)
- 0.99 = 1% evaporation per tick
- 0.995 = 0.5% evaporation per tick
- 0.95 = 5% evaporation per tick
- Recommended range: 0.99 - 0.998

## Quick Tweaking Guide

### Want More Moisture Near Water?
- Increase `transferRate` (0.025 → 0.035)
- Decrease `saturationExponent` (1.2 → 1.0)
- Decrease `minTransfer` (0.00005 → 0.00001)

### Want Wider Moisture Spread?
- Increase `maxPropagationDistance` (50 → 100)
- Decrease `minTransfer` (0.00005 → 0.00001)
- Increase `transferRate` (0.025 → 0.030)

### Want Drier Mountains?
- Increase `altitudeDrynessPercent` (0.0004 → 0.0008)
- Increase `uphillPenaltyPercent` (0.0006 → 0.001)

### Want Wetter Valleys?
- Increase `downhillBonusPercent` (0.0003 → 0.0005)
- Decrease `altitudeDrynessPercent` (0.0004 → 0.0002)

### Want Faster Moisture Changes?
- Increase `transferRate` (0.025 → 0.040)
- Decrease `baseDecay` (0.99 → 0.95) for faster evaporation

### Want More Stable Moisture?
- Decrease `transferRate` (0.025 → 0.015)
- Increase `baseDecay` (0.99 → 0.995) for slower evaporation

## Example Configurations

### Tropical (Wet Everywhere)
```typescript
transferRate: 0.040,
baseDecay: 0.995,
altitudeDrynessPercent: 0.0002,
saturationExponent: 1.0,
```

### Desert (Very Dry)
```typescript
transferRate: 0.015,
baseDecay: 0.93,
altitudeDrynessPercent: 0.0008,
uphillPenaltyPercent: 0.001,
```

### Temperate (Balanced)
```typescript
transferRate: 0.025,
baseDecay: 0.99,
altitudeDrynessPercent: 0.0004,
uphillPenaltyPercent: 0.0006,
```

### Alpine (Dry Mountains, Wet Valleys)
```typescript
altitudeDrynessPercent: 0.0008,
uphillPenaltyPercent: 0.001,
downhillBonusPercent: 0.0005,
```

## Humidity System Configuration

### Location
File: `/server/config.ts` → `EVAPORATION_CONFIG`

### Parameters

```typescript
BASE_EVAP_RATE: 0.02
```
- Base evaporation rate from water bodies (meters/tick)
- Higher = faster humidity increase
- **Current value (0.02)**: Visible humidity changes within 10-20 ticks
- **Old value (0.005)**: Very slow, took 40+ ticks to see 1% humidity
- Recommended range: 0.01 - 0.05

```typescript
EVAP_TEMP_COEFF: 0.05
```
- Temperature coefficient for evaporation
- 5% increase in evaporation per °C above 0°C
- Warmer water evaporates faster (realistic)
- Recommended range: 0.03 - 0.08

```typescript
MAX_EVAP_DEPTH: 2.0
```
- Maximum water depth for surface area calculation (meters)
- Deeper water doesn't increase evaporation beyond this
- Recommended range: 1.0 - 3.0

```typescript
WATER_TO_HUMIDITY_FACTOR: 0.5
```
- Conversion ratio from water evaporated to air humidity
- Higher = more humidity per unit of water evaporated
- **Current value (0.5)**: Faster humidity accumulation
- **Old value (0.1)**: Very slow humidity increase
- Recommended range: 0.3 - 0.7

```typescript
BASE_EVAPOTRANSPIRATION: 0.01
```
- Evapotranspiration rate from ground moisture (meters/tick)
- Land with moisture contributes to air humidity
- **Current value (0.01)**: Significant contribution from moist ground
- **Old value (0.002)**: Minimal contribution
- Recommended range: 0.005 - 0.02

```typescript
MIN_GROUND_MOISTURE: 0.1
```
- Minimum ground moisture threshold for evapotranspiration
- Below this value, no evapotranspiration occurs
- Recommended range: 0.05 - 0.2

### How Humidity Works

1. **Evaporation from Water**: Water bodies evaporate based on temperature and depth
2. **Evapotranspiration**: Moist ground releases moisture into the air
3. **Humidity Diffusion**: Air humidity spreads to neighboring cells
4. **Condensation**: High humidity can condense back into ground moisture (future feature)

### Tweaking Humidity

**Want Faster Humidity Changes?**
- Increase `BASE_EVAP_RATE` (0.02 → 0.03)
- Increase `WATER_TO_HUMIDITY_FACTOR` (0.5 → 0.6)
- Increase `BASE_EVAPOTRANSPIRATION` (0.01 → 0.015)

**Want More Humid Climate?**
- Increase `WATER_TO_HUMIDITY_FACTOR` (0.5 → 0.7)
- Increase `BASE_EVAPOTRANSPIRATION` (0.01 → 0.02)
- Decrease `MIN_GROUND_MOISTURE` (0.1 → 0.05)

**Want Drier Climate?**
- Decrease `BASE_EVAP_RATE` (0.02 → 0.01)
- Decrease `WATER_TO_HUMIDITY_FACTOR` (0.5 → 0.3)
- Increase `MIN_GROUND_MOISTURE` (0.1 → 0.2)

## Spring Generation System

### Location
File: `/server/worldGenerator.ts` → `selectSpringPoints()`

### Recent Improvements

1. **Toroidal Distance Calculation**: Springs respect map wrapping
   - Springs at opposite edges are recognized as neighbors
   - Prevents clustering at map boundaries
   
2. **Minimum Distance Enforcement**: Springs spread across entire map
   - Formula: `minDistance = sqrt(mapArea / numberOfSprings) * 0.6`
   - For 1000x1000 grid with 20 springs: ~120 cells apart
   
3. **Dynamic Spring Count**: `numberOfSprings` is now a maximum
   - Algorithm places as many springs as possible while respecting distance
   - Typical result: 4-6 springs for small maps, 15-25 for large maps
   - Formula: `numberOfSprings = floor((gridSize / 100) * 2)`

### Configuration

```typescript
// In server/config.ts
springMinHeight: 1000  // Minimum elevation for springs (meters)
springMaxHeight: 1900  // Maximum elevation for springs (meters)
numberOfSprings: 50    // Maximum number of springs (not exact count)
```

### Tweaking Spring Generation

**Want More Springs?**
- Increase `numberOfSprings` (50 → 100)
- Widen height range: decrease `springMinHeight` (1000 → 800)

**Want Springs Closer Together?**
- Modify `minDistance` calculation in `worldGenerator.ts`:
  ```typescript
  const minDistance = Math.floor(Math.sqrt(mapArea / numberOfSprings) * 0.4);
  // Changed from 0.6 to 0.4 for closer spacing
  ```

**Want Springs at Different Elevations?**
- Adjust `springMinHeight` and `springMaxHeight`
- Lower values = springs in valleys (more realistic for rivers)
- Higher values = springs on mountains (alpine streams)

## Troubleshooting

### Issue: Moisture stays at 0
**Cause**: No water sources found
**Solution**: Check console for `[moisture] WARNING: No water sources found!`
- Verify springs are being generated (check for "🌊 Created" messages)
- Adjust `springMinHeight`/`springMaxHeight` to match terrain elevation range

### Issue: Horizontal line in moisture map
**Cause**: `maxPropagationDistance` too low or BFS hitting cell limit
**Solution**: 
- Increase `maxPropagationDistance` (50 → 1000)
- Increase `maxCellsProcessed` (500000 → 5000000)
- Or comment out the distance check in `storage.ts`

### Issue: Max moisture only 50% near water
**Cause**: `transferRate` too low or `saturationExponent` too high
**Solution**:
- Increase `transferRate` (0.025 → 0.05)
- Decrease `saturationExponent` (1.2 → 0.8)

### Issue: Blocky/square moisture patterns
**Cause**: Using BFS algorithm instead of iterative diffusion
**Solution**: Ensure you're using the iterative diffusion implementation (December 2024 version)

### Issue: Springs clustered in one area
**Cause**: Not using toroidal distance calculation
**Solution**: Ensure `worldGenerator.ts` uses wrapped distance:
```typescript
const wrappedDx = Math.min(dx, mapWidth - dx);
const wrappedDy = Math.min(dy, mapHeight - dy);
```

## Real-World Comparison

### Current System vs Reality

| Metric | Real World | Current System | Status |
|--------|-----------|----------------|--------|
| Moisture near rivers | 80-100% | 70-85% | ✅ Good |
| Moisture 100m from water | 40-60% | 35-50% | ✅ Good |
| Moisture 500m from water | 10-20% | 5-15% | ✅ Good |
| Gradient smoothness | Gradual fade | Smooth diffusion | ✅ Good |
| Mountain dryness | 30-50% drier | 10-30% drier | ⚠️ Could be more aggressive |
| Evaporation rate | ~5mm/day | Configurable | ✅ Good |
| Humidity changes | Hours to days | 10-20 ticks | ✅ Good |

## Version History

### December 2024 - Major Overhaul
- Implemented iterative diffusion algorithm
- Added toroidal distance for spring placement
- Increased transfer rates for realistic moisture levels
- Reduced altitude dryness for better balance
- Enhanced humidity system with faster evaporation
- Added dynamic spring count with minimum distance

### November 2024 - Initial Implementation
- BFS-based moisture propagation
- Basic evaporation system
- Fixed spring count
- Linear distance calculations
