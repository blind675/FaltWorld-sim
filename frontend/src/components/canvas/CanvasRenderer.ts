import { type TerrainCell, type TerrainGrid } from "@/shared/schema";
import { type CellInfo, type VisualizationSettings } from "./types";
import {
  CloudColorLayer,
  CloudLayer,
  ContourLayer,
  GrassLayer,
  HeightmapLayer,
  HumidityLayer,
  MoistureLayer,
  PrecipitationLayer,
  PressureLayer,
  RiverLayer,
  SelectionLayer,
  TemperatureLayer,
  TerrainLayer,
  WindLayer,
} from "./layers";
import { type ICanvasLayer, type LayerRenderContext } from "./layers";

export class CanvasRenderer {
  private layers: ICanvasLayer[] = [];
  private colorModeLayers: Map<string, ICanvasLayer> = new Map();
  private overlayLayers: ICanvasLayer[] = [];
  private selectionLayer: SelectionLayer;
  private defaultLayer: TerrainLayer;

  constructor() {
    this.defaultLayer = new TerrainLayer();
    this.selectionLayer = new SelectionLayer();

    this.registerColorModeLayer("default", this.defaultLayer);
    this.registerColorModeLayer("heightmap", new HeightmapLayer());
    this.registerColorModeLayer("moisture", new MoistureLayer());
    this.registerColorModeLayer("temperature", new TemperatureLayer());
    this.registerColorModeLayer("humidity", new HumidityLayer());
    this.registerColorModeLayer("wind", new WindLayer());
    this.registerColorModeLayer("grass", new GrassLayer());
    this.registerColorModeLayer("pressure", new PressureLayer());
    this.registerColorModeLayer("cloud", new CloudColorLayer());

    this.registerOverlayLayer(new RiverLayer());
    this.registerOverlayLayer(new ContourLayer());
    this.registerOverlayLayer(new CloudLayer());
    this.registerOverlayLayer(new PrecipitationLayer());
    this.registerOverlayLayer(this.selectionLayer);
  }

  /** Register a color mode layer for base terrain rendering. */
  registerColorModeLayer(mode: string, layer: ICanvasLayer) {
    this.colorModeLayers.set(mode, layer);
    this.layers.push(layer);
  }

  /** Register an overlay layer for additional rendering. */
  registerOverlayLayer(layer: ICanvasLayer) {
    this.overlayLayers.push(layer);
    this.layers.push(layer);
  }

  /** Render the terrain and overlays to the canvas. */
  render(
    ctx: CanvasRenderingContext2D,
    terrainGrid: TerrainGrid,
    settings: VisualizationSettings,
    width: number,
    height: number,
    selectedCell: CellInfo | null,
    hoveredCell: CellInfo | null,
    worldSize?: number,
  ) {
    const context = this.buildContext(ctx, terrainGrid, settings, width, height, worldSize);

    const colorLayer =
      this.colorModeLayers.get(settings.colorMode) || this.defaultLayer;

    this.selectionLayer.setSelection(selectedCell, hoveredCell);

    this.renderTerrain(context, colorLayer);

    // Call render on color layer for additional rendering (e.g., wind arrows)
    if (colorLayer.shouldRender(settings)) {
      colorLayer.render(context);
    }

    for (const layer of this.overlayLayers) {
      if (layer.shouldRender(settings)) {
        layer.render(context);
      }
    }
  }

  /** Get a cell color for the current settings. */
  getCellColor(cell: TerrainCell, settings: VisualizationSettings): string {
    const colorLayer =
      this.colorModeLayers.get(settings.colorMode) || this.defaultLayer;
    const color = colorLayer.getCellColor?.(cell, settings);
    if (color) {
      return color;
    }
    return this.defaultLayer.getCellColor(cell, settings);
  }

  private buildContext(
    ctx: CanvasRenderingContext2D,
    terrainGrid: TerrainGrid,
    settings: VisualizationSettings,
    width: number,
    height: number,
    worldSize?: number,
  ): LayerRenderContext {
    // Fixed 100x100 viewport, no panning
    const viewportSize = terrainGrid.length;
    const zoomLevel = settings.zoomLevel || 1.0;

    // Calculate cell size based on zoom
    // At zoom=1, show all 100 cells. At zoom=2.22 (100/45), show 45 cells
    const visibleCells = viewportSize / zoomLevel;
    const cellWidth = width / visibleCells;
    const cellHeight = height / visibleCells;

    return {
      ctx,
      terrainGrid,
      settings,
      cellWidth,
      cellHeight,
      startX: 0,
      startY: 0,
      endX: viewportSize,
      endY: viewportSize,
      normalizedPanX: 0,
      normalizedPanY: 0,
      gridSize: worldSize ?? viewportSize,
      viewportSize,
    };
  }

  private renderTerrain(context: LayerRenderContext, layer: ICanvasLayer) {
    const {
      ctx,
      terrainGrid,
      cellWidth,
      cellHeight,
      startX,
      startY,
      endX,
      endY,
      normalizedPanX,
      normalizedPanY,
      settings,
    } = context;

    const shouldRenderDetails = cellWidth >= 0.5 && cellHeight >= 0.5;

    // Render viewport data which is already extracted for the visible region
    const viewportHeight = terrainGrid.length;
    const viewportWidth = terrainGrid[0]?.length || 0;

    for (let viewportY = 0; viewportY < viewportHeight; viewportY++) {
      for (let viewportX = 0; viewportX < viewportWidth; viewportX++) {
        const cell = terrainGrid[viewportY]?.[viewportX];
        if (!cell) continue;

        // Map viewport index back to world coordinate for screen positioning
        const worldX = startX + viewportX;
        const worldY = startY + viewportY;

        const color = layer.getCellColor
          ? layer.getCellColor(cell, settings)
          : null;
        const fillColor = color ?? this.defaultLayer.getCellColor(cell, settings);

        if (ctx.fillStyle !== fillColor) {
          ctx.fillStyle = fillColor;
        }

        ctx.fillRect(
          worldX * cellWidth + normalizedPanX,
          worldY * cellHeight + normalizedPanY,
          Math.ceil(cellWidth + 1),
          Math.ceil(cellHeight + 1),
        );

        if (shouldRenderDetails && settings.wireframe) {
          ctx.strokeStyle = "rgba(0,0,0,0.2)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(
            worldX * cellWidth + normalizedPanX,
            worldY * cellHeight + normalizedPanY,
            cellWidth,
            cellHeight,
          );
        }
      }
    }
  }
}
