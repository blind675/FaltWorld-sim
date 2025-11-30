/**
 * Temperature System for World Simulator
 * 
 * Temperature calculation depends on:
 * - Altitude: Higher elevations are colder (lapse rate)
 * - Latitude: Distance from poles/equator affects base temperature
 * - Season: Annual cycle creates seasonal variation
 * - Hemisphere: North/South hemispheres have reversed seasonal effects
 * 
 * The world has a wrapped vertical axis (cylindrical map):
 * - Poles are at top and bottom of map
 * - Equator band is in the middle
 * - Seasonal effects are strongest at poles, weakest at equator
 */

// Temperature Constants
export const TEMPERATURE_CONFIG = {
  // Base temperatures (sea level, no season)
  T_EQUATOR: 28,           // Temperature at equator in °C
  T_POLE_DIFF: 40,         // Temperature difference from equator to pole in °C

  // Altitude lapse rate
  LAPSE_RATE: -0.006,      // °C per meter (≈ -6°C per 1000m)

  // Seasonal amplitude (how much temperature swings with seasons)
  A_MIN: 2,                // Amplitude at equator in °C
  A_MAX: 15,               // Amplitude at poles in °C
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
 * Formula breakdown:
 * 1. Base temp: T_EQUATOR - T_POLE_DIFF * |lat|  (stronger at poles)
 * 2. Altitude: LAPSE_RATE * altitude               (colder higher up)
 * 3. Season: amplitude * seasonCos * hemisign      (swings based on season)
 */
export function getTemperature(
  x: number,
  y: number,
  altitudeMeters: number,
  worldWidth: number,
  worldHeight: number,
  seasonCos: number
): number {
  // Calculate latitude on wrapped vertical axis
  // theta ranges from 0 to 2π as y goes from 0 to worldHeight
  const theta = (y / worldHeight) * 2 * Math.PI;
  
  // lat = sin(theta): -1 at bottom pole, +1 at top pole, 0 at equator bands
  const lat = Math.sin(theta);
  
  // latFactor = |lat|: 0 at equator, 1 at poles (controls pole strength)
  const latFactor = Math.abs(lat);
  
  // hemiSign: +1 if north (lat > 0), -1 if south (lat < 0), 0 if equator
  const hemiSign = lat > 0 ? 1 : (lat < 0 ? -1 : 0);

  // 1. Base temperature (sea level, no season)
  // At equator: 28°C
  // At poles: 28 - 40 = -12°C
  const T_base = TEMPERATURE_CONFIG.T_EQUATOR - TEMPERATURE_CONFIG.T_POLE_DIFF * latFactor;

  // 2. Altitude effect (lapse rate: -6°C per 1000m)
  const effectiveAltitude = Math.max(0, altitudeMeters);
  const T_altitude = TEMPERATURE_CONFIG.LAPSE_RATE * effectiveAltitude;

  // 3. Seasonal amplitude (stronger at poles, weaker at equator)
  // At equator: 2°C swing
  // At poles: 15°C swing
  const amplitude = TEMPERATURE_CONFIG.A_MIN + 
    (TEMPERATURE_CONFIG.A_MAX - TEMPERATURE_CONFIG.A_MIN) * latFactor;

  // 4. Seasonal variation
  // seasonCos is precomputed: cos(2π * (yearProgress - 0.5))
  // yearProgress 0.5 (mid-June, north summer): seasonCos ≈ +1 (warm)
  // yearProgress 0 or 1 (mid-December, north winter): seasonCos ≈ -1 (cold)
  // hemiSign flips the effect: North gets summer when seasonCos > 0
  const T_season = amplitude * seasonCos * hemiSign;

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
