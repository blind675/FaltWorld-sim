import { type TerrainCell } from "@/shared/schema";
import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class MoistureLayer implements ICanvasLayer {
  id = "moisture";

  /** Whether this layer should render given current settings */
  shouldRender(settings: VisualizationSettings): boolean {
    return settings.colorMode === "moisture";
  }

  /** Render the layer to the canvas */
  render(_context: LayerRenderContext): void {}

  /** Get cell color for the moisture visualization */
  getCellColor(cell: TerrainCell): string {
    const moistureValue = cell.moisture;
    const b = Math.floor(255);
    const g = Math.floor(255 * (1 - moistureValue));
    const r = Math.floor(255 * (1 - moistureValue));
    return `rgb(${r}, ${g}, ${b})`;
  }
}
