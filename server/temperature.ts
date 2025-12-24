/**
 * Simplified Temperature System for World Simulator
 * 
 * Temperature calculation:
 * 1. Base Temperature: Monthly day/night temps at equator (sea level)
 * 2. Latitude Modifier: Temperature drops as you move north/south from equator
 * 3. Altitude Modifier: Temperature drops with elevation (lapse rate)
 * 4. Day/Night Cycle: Smooth transition between day and night temps throughout the day
 * 
 * The world wraps seamlessly in both directions (toroidal topology)
 */

// Temperature Constants
export const TEMPERATURE_CONFIG = {
  // Latitude effect: temperature drop per unit distance from equator
  LATITUDE_COOLING: 40,    // °C drop from equator to pole (max cooling)

  // Altitude lapse rate
  LAPSE_RATE: -0.006,      // °C per meter (≈ -6°C per 1000m)

  // Day/night cycle timing
  PEAK_DAY_HOUR: 14,       // Hour of maximum daily temperature (2 PM)
  PEAK_NIGHT_HOUR: 3,      // Hour of minimum daily temperature (3 AM)
};

/**
 * Calculates temperature for a single terrain cell using simplified algorithm
 * 
 * @param x - X coordinate on the map [0, worldWidth)
 * @param y - Y coordinate on the map [0, worldHeight)
 * @param altitudeMeters - Altitude in meters (sea level = 0, can be negative)
 * @param worldWidth - Total map width in cells
 * @param worldHeight - Total map height in cells
 * @param monthTempDay - Day temperature for current month at equator, sea level (°C)
 * @param monthTempNight - Night temperature for current month at equator, sea level (°C)
 * @param currentHour - Current hour of the day (0-23)
 * @returns Temperature in °C
 * 
 * Algorithm:
 * 1. Calculate base temperature from monthly day/night temps and current hour
 * 2. Apply latitude cooling (distance from equator)
 * 3. Apply altitude cooling (lapse rate)
 */
export function getTemperature(
  x: number,
  y: number,
  altitudeMeters: number,
  worldWidth: number,
  worldHeight: number,
  monthTempDay: number,
  monthTempNight: number,
  currentHour: number
): number {
  // 1. Calculate base temperature with day/night cycle
  // Use smooth cosine interpolation between night and day temps
  // Peak day temp at PEAK_DAY_HOUR (14:00), peak night temp at PEAK_NIGHT_HOUR (3:00)

  // Calculate hours since peak night (3 AM)
  let hoursSincePeakNight = currentHour - TEMPERATURE_CONFIG.PEAK_NIGHT_HOUR;
  if (hoursSincePeakNight < 0) hoursSincePeakNight += 24;

  // Map to 0-2π cycle (0 at night peak, π at day peak, 2π back to night peak)
  const dayNightAngle = (hoursSincePeakNight / 24) * 2 * Math.PI;

  // Cosine oscillates from -1 (night) to +1 (day)
  const dayNightFactor = (1 - Math.cos(dayNightAngle)) / 2; // 0 at night, 1 at day

  // Interpolate between night and day temperatures
  const baseTemp = monthTempNight + (monthTempDay - monthTempNight) * dayNightFactor;

  // 2. Calculate latitude modifier (distance from equator)
  // Use sin²(theta/2) for smooth wrapping on toroidal world
  const theta = (y / worldHeight) * 2 * Math.PI;
  const sinHalfTheta = Math.sin(theta / 2);
  const latitudeFactor = sinHalfTheta * sinHalfTheta;
  // latitudeFactor: 0 at poles, 1 at equator

  // Temperature drops as we move away from equator
  const latitudeCooling = -TEMPERATURE_CONFIG.LATITUDE_COOLING * (1 - latitudeFactor);

  // 3. Calculate altitude modifier (lapse rate)
  const effectiveAltitude = Math.max(0, altitudeMeters);
  const altitudeCooling = TEMPERATURE_CONFIG.LAPSE_RATE * effectiveAltitude;

  // Final temperature = base + latitude effect + altitude effect
  return baseTemp + latitudeCooling + altitudeCooling;
}

