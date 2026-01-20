import { type TerrainCell } from "@/shared/schema";
import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class GrassLayer implements ICanvasLayer {
  id = "grass";

  shouldRender(settings: VisualizationSettings): boolean {
    return settings.colorMode === "grass";
  }

  getCellColor(cell: TerrainCell, _settings: VisualizationSettings): string {
    const density = cell.grass_density ?? 0;
    const grassType = cell.grass_type ?? "default";

    if (density < 0.05) {
      const moisture = cell.moisture ?? 0;
      const brownBase = 139 + Math.floor(moisture * 50);
      const r = brownBase;
      const g = Math.floor(brownBase * 0.7);
      const b = Math.floor(brownBase * 0.4);
      return `rgb(${r}, ${g}, ${b})`;
    }

    let greenHue = { r: 34, g: 139, b: 34 };

    switch (grassType) {
      case "cool_season":
        greenHue = { r: 46, g: 139, b: 87 };
        break;
      case "warm_season":
        greenHue = { r: 107, g: 142, b: 35 };
        break;
      case "drought_resistant":
        greenHue = { r: 85, g: 107, b: 47 };
        break;
      case "wetland":
        greenHue = { r: 0, g: 128, b: 0 };
        break;
    }

    if (density < 0.3) {
      const factor = density / 0.3;
      const r = Math.floor(139 + (greenHue.r - 139) * factor);
      const g = Math.floor(90 + (greenHue.g - 90) * factor);
      const b = Math.floor(43 + (greenHue.b - 43) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    }

    if (density < 0.7) {
      const factor = (density - 0.3) / 0.4;
      const r = Math.floor(greenHue.r * (1 - factor * 0.3));
      const g = greenHue.g;
      const b = Math.floor(greenHue.b * (1 - factor * 0.3));
      return `rgb(${r}, ${g}, ${b})`;
    }

    const factor = (density - 0.7) / 0.3;
    const r = Math.floor(greenHue.r * (0.7 - factor * 0.4));
    const g = Math.floor(greenHue.g * (1 - factor * 0.2));
    const b = Math.floor(greenHue.b * (0.7 - factor * 0.4));
    return `rgb(${r}, ${g}, ${b})`;
  }

  render(_context: LayerRenderContext): void {}
}
