/**
 * Temperature System for World Simulator
 * 
 * Temperature calculation depends on:
 * - Altitude: Higher elevations are colder (lapse rate)
 * - Latitude: Distance from temperature zones affects base temperature
 * - Season: Annual cycle creates seasonal variation
 * - Zones: Four alternating temperature zones (cold-warm-cold-warm) wrap seamlessly
 * 
 * The world has a wrapped vertical axis (cylindrical map with 4 zones):
 * - Zone 1 (top ~1/4): Warm zone gradually cooling
 * - Zone 2 (2nd ~1/4): Cold zone (pole)
 * - Zone 3 (3rd ~1/4): Warm zone gradually warming
 * - Zone 4 (bottom ~1/4): Cold zone (pole)
 * - Zones wrap seamlessly: warm zone at bottom connects to warm zone at top
 * - Seasonal effects vary by latitude/zone
 */

// Temperature Constants
export const TEMPERATURE_CONFIG = {
  // Base temperatures (sea level, no season)
  T_WARM_ZONE: 25,         // Temperature in warm zones in °C
  T_COLD_ZONE: -8,         // Temperature in cold zones (poles) in °C

  // Altitude lapse rate
  LAPSE_RATE: -0.006,      // °C per meter (≈ -6°C per 1000m)

  // Seasonal amplitude (how much temperature swings with seasons)
  A_MIN: 2,                // Amplitude in warm zones in °C
  A_MAX: 12,               // Amplitude in cold zones in °C
};

/**
 * Calculates temperature for a single terrain cell
 * 
 * @param x - X coordinate on the map [0, worldWidth)
 * @param y - Y coordinate on the map [0, worldHeight)
 * @param altitudeMeters - Altitude in meters (sea level = 0, can be negative)
 * @param worldWidth - Total map width in cells
 * @param worldHeight - Total map height in cells
 * @param seasonCos - Precomputed cos(2π * (yearProgress - 0.5)) value
 * @returns Temperature in °C
 * 
 * Formula breakdown with 4 alternating temperature zones:
 * 1. Calculate zone position using sin(2*theta) to create 4 zones
 * 2. Base temp: T_WARM_ZONE or T_COLD_ZONE based on zone and distance from pole/equator
 * 3. Altitude: LAPSE_RATE * altitude (colder higher up)
 * 4. Season: amplitude varies by zone, with seasonal oscillation
 * 
 * Zone pattern (as y increases from 0 to worldHeight):
 * - y ≈ 0-25%: Warm zone (gradually cooling toward pole)
 * - y ≈ 25-50%: Cold zone (pole, gradually warming away)
 * - y ≈ 50-75%: Warm zone (gradually warming away from pole)
 * - y ≈ 75-100%: Cold zone (pole, gradually cooling toward equator)
 * Wraps seamlessly: warm zone at 100% connects to warm zone at 0%
 */
export function getTemperature(
  x: number,
  y: number,
  altitudeMeters: number,
  worldWidth: number,
  worldHeight: number,
  seasonCos: number
): number {
  // Calculate position on wrapped vertical axis using 4-zone pattern
  // theta ranges from 0 to 2π as y goes from 0 to worldHeight
  const theta = (y / worldHeight) * 2 * Math.PI;
  
  // Use sin(2*theta) to create 4 alternating zones instead of 2 poles
  // This oscillates twice around the cylinder:
  // sin(2*theta) ranges from -1 to 1, creating warm-cold-warm-cold pattern
  const zoneFactor = Math.sin(2 * theta);
  
  // zoneFactor absolute distance from equator of the zone:
  // 0 = neutral transition point
  // ±1 = center of warm zone (+) or cold zone (-)
  const distFromZoneCenter = Math.abs(zoneFactor);
  
  // Determine if we're in a warm or cold zone
  const isWarmZone = zoneFactor > 0;

  // 1. Base temperature (sea level, no season)
  // Interpolate between warm and cold zone temperatures
  // At distFromZoneCenter=1: full effect of the zone
  // At distFromZoneCenter=0: neutral (between zones)
  let T_base: number;
  if (isWarmZone) {
    // Warm zone: start at T_WARM_ZONE, cool toward center as we leave the zone
    T_base = TEMPERATURE_CONFIG.T_WARM_ZONE - 
      (TEMPERATURE_CONFIG.T_WARM_ZONE - TEMPERATURE_CONFIG.T_COLD_ZONE) * (1 - distFromZoneCenter);
  } else {
    // Cold zone: start at T_COLD_ZONE, warm toward center as we leave the zone
    T_base = TEMPERATURE_CONFIG.T_COLD_ZONE + 
      (TEMPERATURE_CONFIG.T_WARM_ZONE - TEMPERATURE_CONFIG.T_COLD_ZONE) * (1 - distFromZoneCenter);
  }

  // 2. Altitude effect (lapse rate: -6°C per 1000m)
  const effectiveAltitude = Math.max(0, altitudeMeters);
  const T_altitude = TEMPERATURE_CONFIG.LAPSE_RATE * effectiveAltitude;

  // 3. Seasonal amplitude (stronger in cold zones, weaker in warm zones)
  const amplitude = TEMPERATURE_CONFIG.A_MIN + 
    (TEMPERATURE_CONFIG.A_MAX - TEMPERATURE_CONFIG.A_MIN) * distFromZoneCenter;

  // 4. Seasonal variation
  // seasonCos oscillates: +1 in summer, -1 in winter
  // Apply with zone-aware sign
  const T_season = amplitude * seasonCos * (isWarmZone ? 1 : -1);

  // Final temperature
  return T_base + T_altitude + T_season;
}

/**
 * Precompute the seasonal cos factor for this tick
 * Call this once per tick and pass to getTemperature for all cells
 * 
 * @param yearProgress - Fraction of year [0, 1), where 0.5 = mid-June
 * @returns cos(2π * (yearProgress - 0.5))
 */
export function computeSeasonCos(yearProgress: number): number {
  const seasonPhase = yearProgress - 0.5;
  return Math.cos(2 * Math.PI * seasonPhase);
}
