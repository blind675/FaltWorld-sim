# Moisture System Configuration Guide

All moisture parameters are now centralized in `MemStorage.MOISTURE_CONFIG` for easy tweaking.

## Location
File: `/server/storage.ts`
Object: `MemStorage.MOISTURE_CONFIG`

## Configuration Parameters

### Base Moisture Transfer
```typescript
maxLandMoisture: 0.85
```
- Maximum moisture a land cell can hold (0.0 to 1.0)
- Higher = cells can get wetter
- Recommended range: 0.7 - 0.9

```typescript
transferRate: 0.025
```
- Base amount of moisture spread each tick
- Higher = faster moisture spread
- Recommended range: 0.015 - 0.040

```typescript
minTransfer: 0.00005
```
- Stop propagating below this threshold
- Lower = moisture spreads further (but slower)
- Recommended range: 0.00001 - 0.0001

### Propagation Limits
```typescript
maxPropagationDistance: 50
```
- Maximum cells moisture can travel per tick
- Higher = wider moisture zones
- Recommended range: 30 - 100

```typescript
maxCellsProcessed: 500000
```
- Hard limit on cells processed per tick (performance)
- Higher = more complete propagation (but slower)
- Recommended range: 100000 - 1000000

### Altitude Effects (Percentage-Based)
```typescript
uphillPenaltyPercent: 0.0006
```
- % reduction per meter when going uphill
- Higher = harder for moisture to climb
- Recommended range: 0.0003 - 0.001
- Example: 100m climb = 6% penalty

```typescript
altitudeDrynessPercent: 0.0004
```
- % reduction based on absolute altitude
- Higher = mountains are drier
- Recommended range: 0.0002 - 0.0008
- Example: 1000m elevation = 40% drier

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
saturationExponent: 1.2
```
- Controls how aggressively moisture saturates
- Lower = less aggressive, allows higher moisture near water
- Higher = more aggressive, creates steeper gradients
- Recommended range: 1.0 - 2.0
- Formula: diminishingReturns = saturationFactor^exponent

**Effect of different values:**
- 1.0 = Linear saturation (gentle)
- 1.2 = Slight curve (current)
- 1.5 = Moderate curve
- 2.0 = Steep curve (aggressive)

### Evaporation
```typescript
baseDecay: 0.99
```
- Global evaporation rate
- (1 - this value) = % moisture lost per tick
- 0.99 = 1% evaporation per tick
- 0.95 = 5% evaporation per tick
- Recommended range: 0.95 - 0.995

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
