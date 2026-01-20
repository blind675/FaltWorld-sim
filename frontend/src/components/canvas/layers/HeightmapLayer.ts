import { type TerrainCell } from "@/shared/schema";
import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class HeightmapLayer implements ICanvasLayer {
  id = "heightmap";

  /** Whether this layer should render given current settings */
  shouldRender(settings: VisualizationSettings): boolean {
    return settings.colorMode === "heightmap";
  }

  /** Render the layer to the canvas */
  render(_context: LayerRenderContext): void {}

  /** Get cell color for the heightmap visualization */
  getCellColor(cell: TerrainCell, settings: VisualizationSettings): string {
    const normalizedValue = (cell.altitude + 200) / 2400;
    const adjustedValue = Math.min(
      1,
      normalizedValue * settings.exaggerateHeight,
    );

    if (adjustedValue < 0.5) {
      const factor = adjustedValue * 2;
      const r = Math.floor(255 * factor);
      const g = Math.floor(255 * factor);
      const b = 255;
      return `rgb(${r}, ${g}, ${b})`;
    }

    const factor = (adjustedValue - 0.5) * 2;
    const r = Math.floor(255 - (255 - 102) * factor);
    const g = Math.floor(255 - (255 - 51) * factor);
    const b = Math.floor(255 - 255 * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }
}
