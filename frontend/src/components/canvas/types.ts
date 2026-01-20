import { type TerrainCell } from "@/shared/schema";

export interface VisualizationSettings {
  showRivers: boolean;
  showMoisture: boolean;
  showElevation: boolean;
  showClouds: boolean;
  showPrecipitation: boolean;
  exaggerateHeight: number; // 1.0 is normal, higher values exaggerate the height differences
  contourLines: boolean;
  contourInterval: number; // Interval for contour lines
  colorMode:
  | "default"
  | "heightmap"
  | "moisture"
  | "temperature"
  | "humidity"
  | "wind"
  | "grass"
  | "pressure"
  | "cloud";
  wireframe: boolean;
  zoomLevel: number; // 1.0 is normal, higher values zoom in
  panOffset: { x: number; y: number }; // Offset for panning
}

export interface CellInfo {
  cell: TerrainCell;
  x: number;
  y: number;
  screenX: number;
  screenY: number;
}
