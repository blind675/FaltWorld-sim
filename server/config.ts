/**
 * Centralized configuration for the world simulation
 */

// World Generation Configuration
export interface WorldConfig {
    gridSize: number;
    noiseScale: number;
    numberOfSprings: number;
    minHeight: number;
    maxHeight: number;
    springMinHeight: number;
    springMaxHeight: number;
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
    gridSize: 300,
    noiseScale: 0.003, // Matches Unity terrainFrequency
    numberOfSprings: 50,
    minHeight: -200,
    maxHeight: 2000, // Matches Unity MAX_HEIGHT_VALUE
    springMinHeight: 1000,
    springMaxHeight: 1900,
};

// Time System Configuration
export const TIME_CONFIG = {
    HOURS_PER_DAY: 24,
    DAYS_PER_MONTH: 30,
    MONTHS_PER_YEAR: 12,
};

// Viewport + Minimap Configuration
export const VIEWPORT_CONFIG = {
    MAX_VIEWPORT_SIZE: 200,      // Max cells per dimension
    DEFAULT_MINIMAP_RES: 200,    // Default minimap resolution
    MINIMAP_CACHE_TTL: 60000,    // Cache time in ms
};

// Erosion Configuration
export const EROSION_CONFIG = {
    EROSION_RATE_WATER: 0.0001, // 0.1mm per hour
    EROSION_RATE_WIND: 0.0001,  // 0.1mm per hour
};

// Moisture System Configuration
export const MOISTURE_CONFIG = {
    // Base moisture transfer
    maxLandMoisture: 0.85,              // Maximum moisture a land cell can hold
    transferRate: 0.05,                 // Base amount of moisture spread each tick
    minTransfer: 0.00001,                // Stop propagating below this threshold

    // Propagation limits
    maxPropagationDistance: 1000,          // Maximum cells moisture can travel per tick
    maxCellsProcessed: 5000000,           // Hard limit on cells processed per tick

    // Altitude effects (percentage-based)
    uphillPenaltyPercent: 0.0006,        // % reduction per meter when going uphill
    altitudeDrynessPercent: 0.0001,      // % reduction based on absolute altitude
    downhillBonusPercent: 0.0003,        // % bonus per meter when going downhill

    // Water volume effects
    waterVolumeBoostFactor: 0.3,         // Multiplier for water height boost
    maxWaterVolumeBoost: 1.5,            // Maximum boost from water volume

    // Diminishing returns
    saturationExponent: 0.8,             // Controls how aggressively moisture saturates (lower = less aggressive)

    // Evaporation
    baseDecay: 0.995,                     // Global evaporation (0.5% - this value = % moisture lost per tick)
};

// Atmospheric Humidity System Configuration
export const EVAPORATION_CONFIG = {
    BASE_EVAP_RATE: 0.02,              // m/tick from water bodies
    EVAP_TEMP_COEFF: 0.05,              // 5% increase per °C
    MAX_EVAP_DEPTH: 2.0,                // meters (depth at which surface area maxes out)
    WATER_TO_HUMIDITY_FACTOR: 0.5,     // conversion ratio from water to air humidity

    BASE_EVAPOTRANSPIRATION: 0.01,    // m/tick from ground moisture
    MIN_GROUND_MOISTURE: 0.1,           // threshold for evapotranspiration
};

export const SATURATION_CONFIG = {
    BASE_SATURATION: 1.0,               // reference at 0°C
    TEMP_COEFFICIENT: 0.07,             // 7% increase per °C
    SCALE_HEIGHT: 8500,                 // meters (atmospheric scale height for altitude effect)
};

export const DIFFUSION_CONFIG = {
    HUMIDITY_DIFFUSION_RATE: 0.15,      // 15% spreads to neighbors per tick
    UPWARD_BIAS_COEFF: 0.001,           // 0.1% bonus per meter climbed
    UPWARD_BIAS_MAX: 0.5,               // 50% max bonus
    DOWNWARD_PENALTY_COEFF: 0.0005,     // 0.05% penalty per meter descended
    DOWNWARD_PENALTY_MAX: 0.3,          // 30% max penalty
    MIN_TRANSFER_THRESHOLD: 0.01,       // stop spreading below 1% humidity
    MAX_CELLS_PROCESSED_PER_TICK: 1000000,
};

export const CONDENSATION_CONFIG = {
    CONDENSATION_RATE: 0.5,             // 50% of excess condenses per tick
    DEW_THRESHOLD: 0.85,                // 85% humidity for dew formation
    DEW_CONDENSATION_RATE: 0.1,         // 10% per tick dew rate
    AIR_TO_GROUND_FACTOR: 0.05,         // conversion to ground moisture
};
