import { type TerrainCell, type TerrainGrid } from "@shared/schema";
import { WorldGenerator } from "./worldGenerator";
import { getTemperature } from "./temperature";
import {
  DEFAULT_WORLD_CONFIG,
  TIME_CONFIG,
  EROSION_CONFIG,
  MOISTURE_CONFIG,
  EVAPORATION_CONFIG,
  SATURATION_CONFIG,
  DIFFUSION_CONFIG,
  CONDENSATION_CONFIG,
} from "./config";

// Month information with daylight hours and base temperatures (at equator, sea level)
interface MonthInfo {
  month: string;
  month_number: number;
  daylight_hours: number;
  temp_day: number;    // Day temperature at equator, sea level (°C)
  temp_night: number;  // Night temperature at equator, sea level (°C)
}

const MONTHS_INFO: MonthInfo[] = [
  { month: "January", month_number: 1, daylight_hours: 8, temp_day: 24, temp_night: 18 },
  { month: "February", month_number: 2, daylight_hours: 9, temp_day: 25, temp_night: 19 },
  { month: "March", month_number: 3, daylight_hours: 12, temp_day: 26, temp_night: 20 },
  { month: "April", month_number: 4, daylight_hours: 13, temp_day: 27, temp_night: 21 },
  { month: "May", month_number: 5, daylight_hours: 15, temp_day: 28, temp_night: 22 },
  { month: "June", month_number: 6, daylight_hours: 16, temp_day: 29, temp_night: 23 },
  { month: "July", month_number: 7, daylight_hours: 15, temp_day: 28, temp_night: 22 },
  { month: "August", month_number: 8, daylight_hours: 14, temp_day: 27, temp_night: 21 },
  { month: "September", month_number: 9, daylight_hours: 12, temp_day: 26, temp_night: 20 },
  { month: "October", month_number: 10, daylight_hours: 10, temp_day: 25, temp_night: 19 },
  { month: "November", month_number: 11, daylight_hours: 9, temp_day: 24, temp_night: 18 },
  { month: "December", month_number: 12, daylight_hours: 8, temp_day: 23, temp_night: 17 }
];

// River data structure
interface River {
  name: string;
  points: TerrainCell[];
}

// Game time tracking system
export interface GameTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  is_day: boolean;
  month_name: string;
  daylight_hours: number;
}

export interface IStorage {
  getTerrainData(): Promise<TerrainGrid>;
  generateTerrain(): Promise<TerrainGrid>;
  landUpdate(): Promise<void>;
  getGameTime(): GameTime;
}

export class MemStorage implements IStorage {
  private terrain: TerrainGrid;
  private worldGenerator: WorldGenerator;
  private rivers: River[]; // Array of river objects, each with a name and water points
  private gameTime: GameTime;
  private riverNameCounter: number;

  constructor() {
    this.terrain = [];
    this.worldGenerator = new WorldGenerator(DEFAULT_WORLD_CONFIG);
    this.rivers = [];
    this.riverNameCounter = 0;

    // Initialize game time - starting at Year 1, January 1st, midnight
    this.gameTime = {
      year: 1,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      is_day: false,
      month_name: "January",
      daylight_hours: 8
    };
    this.updateDayNightStatus();
  }

  private updateDayNightStatus(): void {
    // Get current month info
    const monthInfo = MONTHS_INFO[this.gameTime.month - 1];
    this.gameTime.month_name = monthInfo.month;
    this.gameTime.daylight_hours = monthInfo.daylight_hours;

    // Day starts at 6 AM and lasts for daylight_hours
    // For example, if daylight_hours = 8, day is from 6:00 to 14:00 (6am to 2pm)
    // If daylight_hours = 16, day is from 6:00 to 22:00 (6am to 10pm)
    const dayStartHour = 6;
    const dayEndHour = dayStartHour + monthInfo.daylight_hours;

    this.gameTime.is_day = this.gameTime.hour >= dayStartHour && this.gameTime.hour < dayEndHour;
  }

  private advanceTime(): void {
    // Each tick = 1 hour in-game
    this.gameTime.hour += 1;

    // Handle hour overflow (24 hours per day)
    if (this.gameTime.hour >= TIME_CONFIG.HOURS_PER_DAY) {
      this.gameTime.hour = 0;
      this.gameTime.day += 1;

      // Handle day overflow (30 days per month)
      if (this.gameTime.day > TIME_CONFIG.DAYS_PER_MONTH) {
        this.gameTime.day = 1;
        this.gameTime.month += 1;

        // Handle month overflow (12 months per year)
        if (this.gameTime.month > TIME_CONFIG.MONTHS_PER_YEAR) {
          this.gameTime.month = 1;
          this.gameTime.year += 1;
        }
      }
    }

    // Update day/night status after time change
    this.updateDayNightStatus();
  }

  getGameTime(): GameTime {
    return { ...this.gameTime };
  }

  private getNeighbors(x: number, y: number): TerrainCell[] {
    const neighbors: TerrainCell[] = [];
    const directions = [
      [0, -1], // North
      [0, 1], // South
      [-1, 0], // West
      [1, 0], // East
      [-1, -1], // Northwest
      [1, -1], // Northeast
      [-1, 1], // Southwest
      [1, 1], // Southeast
    ];

    const width = this.terrain[0].length;
    const height = this.terrain.length;

    for (const [dx, dy] of directions) {
      // Apply wrapping: use modulo to wrap around edges
      // Add width/height before modulo to handle negative numbers correctly
      const newX = (x + dx + width) % width;
      const newY = (y + dy + height) % height;

      const cell = this.terrain[newY][newX];
      neighbors.push(cell);
    }

    return neighbors;
  }

  /**
   * Generate a unique river name
   */
  private generateRiverName(): string {
    this.riverNameCounter++;
    const names = [
      "Azure", "Crystal", "Silver", "Golden", "Emerald", "Sapphire", "Ruby",
      "Amber", "Pearl", "Diamond", "Jade", "Opal", "Topaz", "Moonlit",
      "Starlight", "Shadow", "Misty", "Whispering", "Thunder", "Serpent",
      "Dragon", "Phoenix", "Eagle", "Wolf", "Bear", "Salmon", "Trout"
    ];
    const suffixes = ["River", "Stream", "Creek", "Brook", "Flow", "Waters"];

    const nameIndex = (this.riverNameCounter - 1) % names.length;
    const suffixIndex = Math.floor((this.riverNameCounter - 1) / names.length) % suffixes.length;

    return `${names[nameIndex]} ${suffixes[suffixIndex]}`;
  }

  /**
   * Find the river index that contains a specific cell
   */
  private findRiverContainingCell(cell: TerrainCell): number {
    for (let i = 0; i < this.rivers.length; i++) {
      if (this.rivers[i].points.some(c => c.x === cell.x && c.y === cell.y)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Merge two rivers when they meet
   * The larger river absorbs the smaller one and keeps its name
   */
  private mergeRivers(riverIndex1: number, riverIndex2: number): void {
    if (riverIndex1 === riverIndex2) return;

    const river1 = this.rivers[riverIndex1];
    const river2 = this.rivers[riverIndex2];

    // Determine which river is larger
    const largerRiver = river1.points.length >= river2.points.length ? river1 : river2;
    const smallerRiver = river1.points.length >= river2.points.length ? river2 : river1;
    const largerIndex = river1.points.length >= river2.points.length ? riverIndex1 : riverIndex2;
    const smallerIndex = river1.points.length >= river2.points.length ? riverIndex2 : riverIndex1;

    // Add all cells from smaller river to larger river (avoiding duplicates)
    for (const cell of smallerRiver.points) {
      if (!largerRiver.points.some(c => c.x === cell.x && c.y === cell.y)) {
        cell.river_name = largerRiver.name; // Update river name to the larger river
        largerRiver.points.push(cell);
      }
    }

    // Log the merge
    console.log(`🌊 ${smallerRiver.name} merged into ${largerRiver.name} (${largerRiver.points.length} total points)`);

    // Remove the smaller river
    this.rivers.splice(smallerIndex, 1);
  }

  /**
   * Process water flow for a single stream/river
   * Returns true if the river was processed successfully
   */
  private processRiverFlow(river: River): boolean {
    if (river.points.length === 0) return false;

    // Process each cell in the river
    for (const cell of river.points) {
      // Apply erosion: decrease terrain height, increase water height
      const erosionAmount = EROSION_CONFIG.EROSION_RATE_WATER;
      cell.terrain_height = Math.max(
        cell.terrain_height - erosionAmount,
        -200
      );
      cell.water_height += erosionAmount;
      cell.altitude = cell.terrain_height + cell.water_height;
    }

    // Find the lowest point in the river
    const lowestCell = river.points.reduce((min, current) =>
      current.altitude < min.altitude ? current : min
    );

    // Get neighbors of the lowest point
    const neighbors = this.getNeighbors(lowestCell.x, lowestCell.y);

    // Find the lowest neighbor that is not water/river/spring
    const nonWaterNeighbors = neighbors.filter(
      n => n.type !== "river" && n.type !== "spring"
    );

    if (nonWaterNeighbors.length > 0) {
      const lowestNonWaterNeighbor = nonWaterNeighbors.reduce((min, current) =>
        current.altitude < min.altitude ? current : min
      );

      // Check if water should flow to this neighbor
      if (lowestNonWaterNeighbor.altitude < lowestCell.altitude) {
        // Convert neighbor to river and add to this stream
        lowestNonWaterNeighbor.type = "river";
        lowestNonWaterNeighbor.water_height = 0.5;
        lowestNonWaterNeighbor.base_moisture = 1;
        lowestNonWaterNeighbor.added_moisture = 0;
        lowestNonWaterNeighbor.moisture = 1;
        lowestNonWaterNeighbor.altitude =
          lowestNonWaterNeighbor.terrain_height + lowestNonWaterNeighbor.water_height;
        lowestNonWaterNeighbor.distance_from_water = 0;
        lowestNonWaterNeighbor.river_name = river.name; // Set river name on new water cell

        river.points.push(lowestNonWaterNeighbor);
        return true;
      }
    }

    // Check if lowest point has river/spring neighbors (potential merge)
    const waterNeighbors = neighbors.filter(
      n => (n.type === "river" || n.type === "spring") &&
        !river.points.some(c => c.x === n.x && c.y === n.y)
    );

    if (waterNeighbors.length > 0) {
      // Find which river(s) these neighbors belong to
      for (const waterNeighbor of waterNeighbors) {
        const otherRiverIndex = this.findRiverContainingCell(waterNeighbor);
        if (otherRiverIndex !== -1) {
          const currentRiverIndex = this.rivers.indexOf(river);
          if (currentRiverIndex !== -1 && currentRiverIndex !== otherRiverIndex) {
            // Merge the two rivers
            this.mergeRivers(currentRiverIndex, otherRiverIndex);
            return true;
          }
        }
      }
    }

    // No expansion possible, increase water level at lowest point
    lowestCell.water_height += 0.5;
    lowestCell.altitude = lowestCell.terrain_height + lowestCell.water_height;

    return true;
  }

  private propagateMoisture(): void {
    // Use centralized moisture configuration
    const config = MOISTURE_CONFIG;
    const MAX_LAND_MOISTURE = config.maxLandMoisture;
    const MOISTURE_TRANSFER_RATE = config.transferRate;
    const UPHILL_PENALTY_PERCENT = config.uphillPenaltyPercent;
    const ALTITUDE_DRYNESS_PERCENT = config.altitudeDrynessPercent;
    const DOWNHILL_BONUS_PERCENT = config.downhillBonusPercent;
    const MIN_TRANSFER = config.minTransfer;
    const MAX_PROPAGATION_DISTANCE = config.maxPropagationDistance;
    const MAX_CELLS_PROCESSED = config.maxCellsProcessed;
    const BASE_DECAY = config.baseDecay;

    // Track visited cells to prevent duplicate processing
    const visited = new Set<string>();
    let cellsProcessed = 0;

    // BFS from all water sources
    const queue: Array<{ cell: TerrainCell, distance: number, moisture: number }> = [];

    // Initialize queue with all river cells
    for (const river of this.rivers) {
      for (const cell of river.points) {
        const key = `${cell.x},${cell.y}`;
        if (!visited.has(key)) {
          visited.add(key);
          cell.distance_from_water = 0;
          cell.base_moisture = 1.0;
          cell.moisture = 1.0;
          queue.push({ cell, distance: 0, moisture: 1.0 });
        }
      }
    }

    console.log(`[moisture] Found ${this.rivers.length} rivers, ${queue.length} water cells`);

    if (queue.length === 0) {
      console.log('[moisture] WARNING: No water sources found!');
      return;
    }

    // Breadth-first propagation (limited distance and cells per tick)
    while (queue.length > 0 && cellsProcessed < MAX_CELLS_PROCESSED) {
      const { cell, distance, moisture } = queue.shift()!;
      cellsProcessed++;

      // if (distance >= MAX_PROPAGATION_DISTANCE) continue;

      const neighbors = this.getNeighbors(cell.x, cell.y);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        // Skip if already visited or is water
        if (visited.has(neighborKey)) continue;
        if (neighbor.type === "river" || neighbor.type === "spring") continue;

        // Calculate distance-based moisture (linear decay from source)
        const newDistance = distance + 1;
        const distanceDecay = Math.max(0, 1 - (newDistance * 0.008)); // Decay 0.8% per cell (~125 cell max range)

        // Water volume boost: cells with more water spread moisture more effectively
        // This simulates larger water bodies having greater influence
        const waterVolumeBoost = 1.0 + Math.min(
          cell.water_height * config.waterVolumeBoostFactor,
          config.maxWaterVolumeBoost
        );

        const baseMoisture = distanceDecay * MOISTURE_TRANSFER_RATE * waterVolumeBoost;

        if (baseMoisture < MIN_TRANSFER) continue;

        // Calculate altitude-based moisture modifier (percentage-based)
        let moistureMultiplier = 1.0;

        // 1. Direction-based modifier: uphill vs downhill
        const heightDiff = neighbor.altitude - cell.altitude;
        if (heightDiff > 0) {
          // Going uphill - apply penalty
          const uphillPenalty = heightDiff * UPHILL_PENALTY_PERCENT;
          moistureMultiplier -= uphillPenalty;
        } else if (heightDiff < 0) {
          // Going downhill - moisture flows easier (bonus)
          const downhillBonus = Math.abs(heightDiff) * DOWNHILL_BONUS_PERCENT;
          moistureMultiplier += downhillBonus;
        }

        // 2. Absolute altitude dryness: higher elevations are naturally drier
        // This is a percentage reduction based on elevation
        const altitudeDryness = Math.max(0, neighbor.terrain_height) * ALTITUDE_DRYNESS_PERCENT;
        moistureMultiplier -= altitudeDryness;

        // Ensure multiplier stays in reasonable bounds
        moistureMultiplier = Math.max(0.05, Math.min(1.5, moistureMultiplier));

        let effectiveTransfer = baseMoisture * moistureMultiplier;

        // Apply diminishing returns based on existing moisture
        // Cells with high moisture are harder to increase (saturation effect)
        // This creates more natural moisture gradients
        if (neighbor.base_moisture > 0) {
          // Calculate saturation factor: as moisture approaches max, it's harder to add more
          const saturationFactor = 1 - (neighbor.base_moisture / MAX_LAND_MOISTURE);

          // Apply exponential diminishing returns based on saturation exponent
          // Lower exponent = less aggressive saturation, allows higher moisture near water
          // Dry cells (low moisture) accept moisture easily
          // Wet cells (high moisture) resist additional moisture
          const diminishingReturns = Math.pow(saturationFactor, config.saturationExponent);

          effectiveTransfer *= diminishingReturns;
        }

        if (effectiveTransfer > 0 && neighbor.base_moisture < MAX_LAND_MOISTURE) {
          const newMoisture = Math.min(
            neighbor.base_moisture + effectiveTransfer,
            MAX_LAND_MOISTURE
          );

          // Only update if we're adding meaningful moisture
          if (newMoisture > neighbor.base_moisture + 0.00001) {
            neighbor.base_moisture = newMoisture;
            neighbor.moisture = newMoisture;

            // Update distance tracking
            neighbor.distance_from_water = newDistance;

            // Mark as visited and add to queue
            visited.add(neighborKey);
            queue.push({
              cell: neighbor,
              distance: newDistance,
              moisture: newMoisture // Pass along for terrain type calculation
            });

            // Update terrain type based on moisture
            if (neighbor.moisture > 0.8) {
              neighbor.type = "mud";
            } else if (neighbor.moisture > 0.2) {
              neighbor.type = "earth";
            }
          }
        }
      }
    }

    // Optional: Log if we hit the processing limit (for debugging)
    if (cellsProcessed >= MAX_CELLS_PROCESSED) {
      console.log(`Hit cell processing limit: ${cellsProcessed} cells, queue remaining: ${queue.length}`);
    }

    // Apply evaporation to non-water cells
    for (let y = 0; y < this.terrain.length; y++) {
      for (let x = 0; x < this.terrain[0].length; x++) {
        const cell = this.terrain[y][x];
        if (cell.type !== "spring" && cell.type !== "river") {
          cell.base_moisture *= BASE_DECAY;
          cell.moisture = cell.base_moisture;
          if (cell.base_moisture < 0.000001) {
            cell.base_moisture = 0;
            cell.moisture = 0;
          }
        }
      }
    }
  }

  /**
   * Calculate saturation capacity for air at given temperature and altitude
   * Returns maximum water vapor the air can hold (0-1 scale)
   */
  private getSaturationCapacity(temperatureCelsius: number, altitudeMeters: number): number {
    const config = SATURATION_CONFIG;

    // Temperature effect (exponential - Clausius-Clapeyron relation)
    const tempFactor = Math.exp(config.TEMP_COEFFICIENT * temperatureCelsius);

    // Altitude effect (barometric pressure decrease)
    const pressureFactor = Math.exp(-altitudeMeters / config.SCALE_HEIGHT);

    return config.BASE_SATURATION * tempFactor * pressureFactor;
  }

  /**
   * Process evaporation from water bodies into air
   */
  private processWaterEvaporation(): void {
    const config = EVAPORATION_CONFIG;

    for (let y = 0; y < this.terrain.length; y++) {
      for (let x = 0; x < this.terrain[0].length; x++) {
        const cell = this.terrain[y][x];

        // Only evaporate from water bodies
        if (cell.type !== "spring" && cell.type !== "river") continue;
        if (cell.water_height <= 0) continue;

        // Temperature factor (no evaporation below 0°C)
        if (cell.temperature < 0) continue;
        const temperatureFactor = Math.max(0, 1 + config.EVAP_TEMP_COEFF * cell.temperature);

        // Surface area factor (shallow water evaporates faster per unit volume)
        const surfaceAreaFactor = Math.min(1.0, cell.water_height / config.MAX_EVAP_DEPTH);

        // Saturation deficit (can't evaporate into saturated air)
        const saturationDeficit = Math.max(0, 1 - cell.air_humidity);

        // Calculate evaporation rate
        const evaporationRate = config.BASE_EVAP_RATE
          * temperatureFactor
          * surfaceAreaFactor
          * saturationDeficit;

        // Apply evaporation (remove from water, add to air)
        const waterLost = Math.min(evaporationRate, cell.water_height);
        cell.water_height -= waterLost;
        cell.altitude = cell.terrain_height + cell.water_height;

        // Convert water loss to humidity gain
        const humidityGain = waterLost * config.WATER_TO_HUMIDITY_FACTOR;
        cell.air_humidity = Math.min(1.5, cell.air_humidity + humidityGain); // Allow oversaturation
      }
    }
  }

  /**
   * Process evapotranspiration from ground moisture into air
   */
  private processEvapotranspiration(): void {
    const config = EVAPORATION_CONFIG;

    for (let y = 0; y < this.terrain.length; y++) {
      for (let x = 0; x < this.terrain[0].length; x++) {
        const cell = this.terrain[y][x];

        // Skip water bodies (already handled in water evaporation)
        if (cell.type === "spring" || cell.type === "river") continue;

        // Only evaporate from moist ground
        if (cell.base_moisture < config.MIN_GROUND_MOISTURE) continue;

        // Temperature factor (no evapotranspiration below 0°C)
        if (cell.temperature < 0) continue;
        const temperatureFactor = Math.max(0, 1 + EVAPORATION_CONFIG.EVAP_TEMP_COEFF * cell.temperature);

        // Saturation deficit
        const saturationDeficit = Math.max(0, 1 - cell.air_humidity);

        // Calculate evapotranspiration rate
        const evapotranspirationRate = config.BASE_EVAPOTRANSPIRATION
          * cell.base_moisture
          * temperatureFactor
          * saturationDeficit;

        // Apply evapotranspiration (remove from ground, add to air)
        const moistureLost = Math.min(evapotranspirationRate, cell.base_moisture);
        cell.base_moisture -= moistureLost;
        cell.moisture = cell.base_moisture;

        // Convert to humidity gain
        const humidityGain = moistureLost * EVAPORATION_CONFIG.WATER_TO_HUMIDITY_FACTOR;
        cell.air_humidity = Math.min(1.5, cell.air_humidity + humidityGain); // Allow oversaturation
      }
    }
  }

  /**
   * Diffuse humidity across the map with altitude bias
   */
  private diffuseHumidity(): void {
    const config = DIFFUSION_CONFIG;
    const height = this.terrain.length;
    const width = this.terrain[0].length;

    // Create a copy of humidity values for double-buffering
    const newHumidity: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));

    // Copy current humidity values
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        newHumidity[y][x] = this.terrain[y][x].air_humidity;
      }
    }

    let cellsProcessed = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.terrain[y][x];

        if (cellsProcessed >= config.MAX_CELLS_PROCESSED_PER_TICK) break;
        if (cell.air_humidity < config.MIN_TRANSFER_THRESHOLD) continue;

        const neighbors = this.getNeighbors(x, y);
        const cellCapacity = this.getSaturationCapacity(cell.temperature, Math.max(0, cell.terrain_height));
        const cellAbsolute = cell.air_humidity * cellCapacity;

        for (const neighbor of neighbors) {
          const altitudeDiff = neighbor.altitude - cell.altitude;

          // Base transfer amount (percentage of current humidity)
          let transfer = config.HUMIDITY_DIFFUSION_RATE;

          // Altitude bias (humid air rises)
          if (altitudeDiff > 0) {
            // Going uphill - bonus
            const altitudeBonus = Math.min(config.UPWARD_BIAS_MAX, altitudeDiff * config.UPWARD_BIAS_COEFF);
            transfer *= (1 + altitudeBonus);
          } else if (altitudeDiff < 0) {
            // Going downhill - penalty
            const altitudePenalty = Math.min(config.DOWNWARD_PENALTY_MAX, Math.abs(altitudeDiff) * config.DOWNWARD_PENALTY_COEFF);
            transfer *= (1 - altitudePenalty);
          }

          // Calculate absolute humidity transfer
          const neighborCapacity = this.getSaturationCapacity(neighbor.temperature, Math.max(0, neighbor.terrain_height));
          const neighborAbsolute = neighbor.air_humidity * neighborCapacity;

          // Maximum transfer limited by neighbor's capacity
          const maxTransferAbsolute = Math.max(0, neighborCapacity - neighborAbsolute);
          const transferAbsolute = Math.min(transfer * cellAbsolute, maxTransferAbsolute);

          if (transferAbsolute > 0.0001) {
            // Apply transfer to new humidity array
            newHumidity[y][x] -= transferAbsolute / cellCapacity;
            newHumidity[neighbor.y][neighbor.x] += transferAbsolute / neighborCapacity;
            cellsProcessed++;
          }
        }
      }
    }

    // Apply new humidity values
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.terrain[y][x].air_humidity = Math.max(0, newHumidity[y][x]);
      }
    }
  }

  /**
   * Process condensation from air to ground
   */
  private processCondensation(): void {
    const config = CONDENSATION_CONFIG;

    for (let y = 0; y < this.terrain.length; y++) {
      for (let x = 0; x < this.terrain[0].length; x++) {
        const cell = this.terrain[y][x];

        // Oversaturation condensation (air cooled or too humid)
        if (cell.air_humidity > 1.0) {
          const excess = cell.air_humidity - 1.0;
          const condensationAmount = excess * config.CONDENSATION_RATE;

          cell.air_humidity -= condensationAmount;

          // Add to ground moisture (skip water bodies)
          if (cell.type !== "spring" && cell.type !== "river") {
            cell.base_moisture = Math.min(
              MOISTURE_CONFIG.maxLandMoisture,
              cell.base_moisture + condensationAmount * config.AIR_TO_GROUND_FACTOR
            );
            cell.moisture = cell.base_moisture;
          }
        }

        // Dew formation (high humidity + cold conditions)
        if (cell.air_humidity > config.DEW_THRESHOLD && cell.temperature < 15) {
          const dewAmount = (cell.air_humidity - config.DEW_THRESHOLD) * config.DEW_CONDENSATION_RATE;

          cell.air_humidity -= dewAmount;

          // Add to ground moisture (skip water bodies)
          if (cell.type !== "spring" && cell.type !== "river") {
            cell.base_moisture = Math.min(
              MOISTURE_CONFIG.maxLandMoisture,
              cell.base_moisture + dewAmount * config.AIR_TO_GROUND_FACTOR
            );
            cell.moisture = cell.base_moisture;
          }
        }
      }
    }
  }

  /**
   * Adjust humidity when temperature changes (maintains absolute humidity)
   */
  private adjustHumidityForTemperatureChange(): void {
    for (let y = 0; y < this.terrain.length; y++) {
      for (let x = 0; x < this.terrain[0].length; x++) {
        const cell = this.terrain[y][x];

        // Get current capacity
        const currentCapacity = this.getSaturationCapacity(cell.temperature, Math.max(0, cell.terrain_height));

        // Calculate absolute humidity (stays constant when temp changes)
        const absoluteHumidity = cell.air_humidity * currentCapacity;

        // Recalculate relative humidity with new capacity
        // (This happens automatically in next tick, but we check for condensation here)
        const newRelativeHumidity = absoluteHumidity / currentCapacity;

        // Update relative humidity
        cell.air_humidity = newRelativeHumidity;

        // If oversaturated due to cooling, will be handled in condensation step
      }
    }
  }

  async landUpdate() {
    // Advance game time by 1 hour each tick
    this.advanceTime();

    // Process water flow for each river/stream
    // Note: We iterate backwards to safely handle river merges
    for (let i = this.rivers.length - 1; i >= 0; i--) {
      if (i < this.rivers.length) { // Check if river still exists (might have been merged)
        this.processRiverFlow(this.rivers[i]);
      }
    }

    // 1. Update temperature for all cells (affects saturation capacity)
    this.updateTemperature();

    // 2. Adjust air humidity for temperature change (maintains absolute humidity)
    this.adjustHumidityForTemperatureChange();

    // 3. Evaporation from water bodies → air humidity
    this.processWaterEvaporation();

    // 4. Evapotranspiration from ground → air humidity
    this.processEvapotranspiration();

    // 5. Humidity diffusion/spread across cells
    this.diffuseHumidity();

    // 6. Condensation checks (oversaturation, dew point)
    this.processCondensation();

    // 7. Update ground moisture from existing propagation system
    this.propagateMoisture();

    // TODO: add pressure
    // TODO: add light
    // TODO: add weather (rain, snow, etc)
    // Note: Seasonal day/night cycles with daylight hours are implemented
    // TODO: add erosion

    // TODO: add grass - and grass mechanics 
    // TODO: add trees - and tree mechanics
    // TODO: add fruits - and fruit mechanics

    // TODO: add rabbits
    // TODO: add foxes
    // TODO: add wolves
    // TODO: add bears
    // TODO: add humans

  }

  private updateTemperature(): void {
    // Get current month info for base temperatures
    const monthInfo = MONTHS_INFO[this.gameTime.month - 1];
    const monthTempDay = monthInfo.temp_day;
    const monthTempNight = monthInfo.temp_night;
    const currentHour = this.gameTime.hour;

    // Update temperature for each cell
    const height = this.terrain.length;
    const width = this.terrain[0].length;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.terrain[y][x];
        // Use terrain_height as altitude in meters
        const altitudeMeters = cell.terrain_height;
        cell.temperature = getTemperature(
          x,
          y,
          altitudeMeters,
          width,
          height,
          monthTempDay,
          monthTempNight,
          currentHour
        );
      }
    }
  }

  async getTerrainData(): Promise<TerrainGrid> {
    return this.terrain;
  }

  async generateTerrain(): Promise<TerrainGrid> {
    // Regenerate the world with new noise seed
    this.worldGenerator.regenerate();

    // Generate terrain using the world generator with wrapping noise
    this.terrain = this.worldGenerator.generateTerrain();

    // Select and mark spring points
    const springs = this.worldGenerator.selectSpringPoints(this.terrain);
    this.rivers = []; // Reset rivers on new terrain generation

    // Each spring starts its own river (stream)
    for (const spring of springs) {
      if (this.terrain[spring.y] && this.terrain[spring.y][spring.x]) {
        const cell = this.terrain[spring.y][spring.x];
        cell.type = "spring";
        cell.base_moisture = 1;
        cell.added_moisture = 0;
        cell.moisture = 1;
        cell.water_height = 1;
        cell.altitude = cell.terrain_height + cell.water_height;
        cell.distance_from_water = 0;
        cell.temperature = 0;

        // Create a new river starting from this spring
        const riverName = this.generateRiverName();
        cell.river_name = riverName; // Set river name on the spring cell
        this.rivers.push({
          name: riverName,
          points: [cell]
        });
        console.log(`🌊 Created ${riverName} at (${cell.x}, ${cell.y})`);
      }
    }

    return this.terrain;
  }
}

export const storage = new MemStorage();
