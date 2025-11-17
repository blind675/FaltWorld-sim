import { type TerrainCell, type TerrainGrid } from "@shared/schema";
import { WorldGenerator, DEFAULT_WORLD_CONFIG } from "./worldGenerator";

// Month information with daylight hours for seasonal day/night cycles
interface MonthInfo {
  month: string;
  month_number: number;
  daylight_hours: number;
}

const MONTHS_INFO: MonthInfo[] = [
  { month: "January", month_number: 1, daylight_hours: 8 },
  { month: "February", month_number: 2, daylight_hours: 9 },
  { month: "March", month_number: 3, daylight_hours: 12 },
  { month: "April", month_number: 4, daylight_hours: 13 },
  { month: "May", month_number: 5, daylight_hours: 15 },
  { month: "June", month_number: 6, daylight_hours: 16 },
  { month: "July", month_number: 7, daylight_hours: 15 },
  { month: "August", month_number: 8, daylight_hours: 14 },
  { month: "September", month_number: 9, daylight_hours: 12 },
  { month: "October", month_number: 10, daylight_hours: 10 },
  { month: "November", month_number: 11, daylight_hours: 9 },
  { month: "December", month_number: 12, daylight_hours: 8 }
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

  static GRID_SIZE = 300;
  static NOISE_SCALE = 0.02;
  static NUMBER_OF_SPRINGS = 8;
  static HOURS_PER_DAY = 24;
  static DAYS_PER_MONTH = 30;
  static MONTHS_PER_YEAR = 12;

  static EROSION_RATE_WATER = 0.0001; // 0.1mm per hour
  static EROSION_RATE_WIND = 0.0001; // 0.1mm per hour
  // static EVAPORATION_RATE_WATER = 0.0001;

  // Moisture System Configuration
  static MOISTURE_CONFIG = {
    // Base moisture transfer
    maxLandMoisture: 0.85,              // Maximum moisture a land cell can hold
    transferRate: 0.025,                 // Base amount of moisture spread each tick
    minTransfer: 0.00005,                // Stop propagating below this threshold

    // Propagation limits
    maxPropagationDistance: 50,          // Maximum cells moisture can travel per tick
    maxCellsProcessed: 500000,           // Hard limit on cells processed per tick

    // Altitude effects (percentage-based)
    uphillPenaltyPercent: 0.0006,        // % reduction per meter when going uphill
    altitudeDrynessPercent: 0.0004,      // % reduction based on absolute altitude
    downhillBonusPercent: 0.0003,        // % bonus per meter when going downhill

    // Water volume effects
    waterVolumeBoostFactor: 0.3,         // Multiplier for water height boost
    maxWaterVolumeBoost: 1.5,            // Maximum boost from water volume

    // Diminishing returns
    saturationExponent: 1.2,             // Controls how aggressively moisture saturates (lower = less aggressive)

    // Evaporation
    baseDecay: 0.99,                     // Global evaporation (1 - this value = % moisture lost per tick)
  };

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
    if (this.gameTime.hour >= MemStorage.HOURS_PER_DAY) {
      this.gameTime.hour = 0;
      this.gameTime.day += 1;

      // Handle day overflow (30 days per month)
      if (this.gameTime.day > MemStorage.DAYS_PER_MONTH) {
        this.gameTime.day = 1;
        this.gameTime.month += 1;

        // Handle month overflow (12 months per year)
        if (this.gameTime.month > MemStorage.MONTHS_PER_YEAR) {
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
      cell.terrain_height = Math.max(
        cell.terrain_height - MemStorage.EROSION_RATE_WATER,
        -200
      );
      cell.water_height += MemStorage.EROSION_RATE_WATER;
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
    const config = MemStorage.MOISTURE_CONFIG;
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
          queue.push({ cell, distance: 0, moisture: 1.0 });
        }
      }
    }

    // Breadth-first propagation (limited distance and cells per tick)
    while (queue.length > 0 && cellsProcessed < MAX_CELLS_PROCESSED) {
      const { cell, distance, moisture } = queue.shift()!;
      cellsProcessed++;

      if (distance >= MAX_PROPAGATION_DISTANCE) continue;

      const neighbors = this.getNeighbors(cell.x, cell.y);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        // Skip if already visited or is water
        if (visited.has(neighborKey)) continue;
        if (neighbor.type === "river" || neighbor.type === "spring") continue;

        // Calculate distance-based moisture (linear decay from source)
        const newDistance = distance + 1;
        const distanceDecay = Math.max(0, 1 - (newDistance * 0.015)); // Decay 1.5% per cell (~67 cell max range)

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
    // if (cellsProcessed >= MAX_CELLS_PROCESSED) {
    //   console.log(`Hit cell processing limit: ${cellsProcessed} cells, queue remaining: ${queue.length}`);
    // }

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

  async landUpdate() {
    // Advance game time by 1 hour each tick
    this.advanceTime();

    // Calculate moisture propagation
    this.propagateMoisture();

    // Process water flow for each river/stream
    // Note: We iterate backwards to safely handle river merges
    for (let i = this.rivers.length - 1; i >= 0; i--) {
      if (i < this.rivers.length) { // Check if river still exists (might have been merged)
        this.processRiverFlow(this.rivers[i]);
      }
    }

    // TODO: add temperature
    // TODO: add humidity
    // TODO: add pressure
    // TODO: add light
    // TODO: add air
    // TODO: add atmosphere
    // TODO: add weather (rain, snow, etc)
    // TODO: add seasons
    // TODO: add day/night cycle
    // TODO: add erosion

    // TODO: add grass - and grass mechanincs 
    // TODO: add trees - and tree mechanins
    // TODO: add fruits - and fruit mechanins


    // TODO: add rabbits
    // TODO: add foxes
    // TODO: add wolves
    // TODO: add bears
    // TODO: add humans

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
