import { TerrainCell, TerrainGrid } from "@/shared/schema";
import { VisualizationSettings } from "../types";

export interface LayerRenderContext {
  ctx: CanvasRenderingContext2D;
  terrainGrid: TerrainGrid;
  settings: VisualizationSettings;
  cellWidth: number;
  cellHeight: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  normalizedPanX: number;
  normalizedPanY: number;
  gridSize: number;
  /** Size of the viewport data array (may differ from gridSize/worldSize) */
  viewportSize: number;
}

export interface ICanvasLayer {
  /** Unique identifier for the layer */
  id: string;

  /** Whether this layer should render given current settings */
  shouldRender(settings: VisualizationSettings): boolean;

  /** Render the layer to the canvas */
  render(context: LayerRenderContext): void;

  /** Optional: Get cell color for this layer (used by terrain/color mode layers) */
  getCellColor?(cell: TerrainCell, settings: VisualizationSettings): string | null;
}
