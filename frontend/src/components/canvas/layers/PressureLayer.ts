import { type TerrainCell } from "@/shared/schema";
import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class PressureLayer implements ICanvasLayer {
  id = "pressure";

  shouldRender(settings: VisualizationSettings): boolean {
    return settings.colorMode === "pressure";
  }

  getCellColor(cell: TerrainCell): string {
    const pressure = cell.atmospheric_pressure ?? 1013;
    const minPressure = 980;
    const maxPressure = 1040;
    const normalized = (pressure - minPressure) / (maxPressure - minPressure);
    const clamped = Math.max(0, Math.min(1, normalized));

    if (clamped < 0.5) {
      const factor = clamped * 2;
      return `rgb(${Math.floor(factor * 100)}, ${Math.floor(
        150 + factor * 105,
      )}, ${Math.floor(255 * (1 - factor))})`;
    }

    const factor = (clamped - 0.5) * 2;
    return `rgb(${Math.floor(100 + factor * 155)}, ${Math.floor(
      255 * (1 - factor),
    )}, 0)`;
  }

  render(_context: LayerRenderContext): void {}
}
