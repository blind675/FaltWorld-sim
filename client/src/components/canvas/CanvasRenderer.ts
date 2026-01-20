import { type TerrainCell, type TerrainGrid } from "@shared/schema";
import { type CellInfo, type VisualizationSettings } from "./types";
import {
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
  ) {
    const context = this.buildContext(ctx, terrainGrid, settings, width, height);

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
  ): LayerRenderContext {
    const gridSize = terrainGrid.length;
    const zoomLevel = settings.zoomLevel || 1.0;
    const panOffset = settings.panOffset || { x: 0, y: 0 };
    const cellWidth = (width / gridSize) * zoomLevel;
    const cellHeight = (height / gridSize) * zoomLevel;
    const worldWidth = gridSize * cellWidth;
    const worldHeight = gridSize * cellHeight;
    const normalizedPanX = ((panOffset.x % worldWidth) + worldWidth) % worldWidth;
    const normalizedPanY = ((panOffset.y % worldHeight) + worldHeight) % worldHeight;
    const startX = Math.floor(-normalizedPanX / cellWidth);
    const startY = Math.floor(-normalizedPanY / cellHeight);
    const endX = Math.ceil((width - normalizedPanX) / cellWidth);
    const endY = Math.ceil((height - normalizedPanY) / cellHeight);

    return {
      ctx,
      terrainGrid,
      settings,
      cellWidth,
      cellHeight,
      startX,
      startY,
      endX,
      endY,
      normalizedPanX,
      normalizedPanY,
      gridSize,
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
      gridSize,
      settings,
    } = context;

    const shouldRenderDetails = cellWidth >= 0.5 && cellHeight >= 0.5;

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const wrappedX = ((x % gridSize) + gridSize) % gridSize;
        const wrappedY = ((y % gridSize) + gridSize) % gridSize;
        const cell = terrainGrid[wrappedY]?.[wrappedX];
        if (!cell) continue;

        const color = layer.getCellColor
          ? layer.getCellColor(cell, settings)
          : null;
        const fillColor = color ?? this.defaultLayer.getCellColor(cell, settings);

        if (ctx.fillStyle !== fillColor) {
          ctx.fillStyle = fillColor;
        }

        ctx.fillRect(
          x * cellWidth + normalizedPanX,
          y * cellHeight + normalizedPanY,
          Math.ceil(cellWidth + 1),
          Math.ceil(cellHeight + 1),
        );

        if (shouldRenderDetails && settings.wireframe) {
          ctx.strokeStyle = "rgba(0,0,0,0.2)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(
            x * cellWidth + normalizedPanX,
            y * cellHeight + normalizedPanY,
            cellWidth,
            cellHeight,
          );
        }
      }
    }
  }
}
