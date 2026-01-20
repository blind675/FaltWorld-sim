import { type TerrainCell } from "@/shared/schema";
import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class TerrainLayer implements ICanvasLayer {
  id = "terrain";

  /** Whether this layer should render given current settings */
  shouldRender(): boolean {
    return true;
  }

  /** Render the layer to the canvas */
  render(_context: LayerRenderContext): void {}

  /** Get cell color for the default terrain visualization */
  getCellColor(cell: TerrainCell, settings: VisualizationSettings): string {
    if (cell.type === "spring" && settings.showRivers) {
      return "rgb(0, 0, 255)";
    }

    if (cell.type === "river" && settings.showRivers) {
      if (cell.water_height >= 2) {
        return "rgb(0, 64, 192)";
      }
      return "rgb(0, 128, 255)";
    }

    if (cell.type === "mud" && settings.showMoisture) {
      const normalizedValue = (cell.altitude + 200) / 2400;
      const baseR = 120;
      const baseG = 60;
      const baseB = 0;
      const darkenFactor = normalizedValue * settings.exaggerateHeight;
      const r = Math.max(40, Math.floor(baseR - darkenFactor * 80));
      const g = Math.max(20, Math.floor(baseG - darkenFactor * 40));
      const b = baseB;
      return `rgb(${r}, ${g}, ${b})`;
    }

    if (cell.type === "earth" && settings.showMoisture) {
      const normalizedValue = (cell.altitude + 200) / 2400;
      const baseR = 180;
      const baseG = 120;
      const baseB = 60;
      const darkenFactor = normalizedValue * settings.exaggerateHeight;
      const r = Math.max(25, Math.floor(baseR - darkenFactor * 185));
      const g = Math.max(10, Math.floor(baseG - darkenFactor * 140));
      const b = Math.max(7, Math.floor(baseB - darkenFactor * 83));
      return `rgb(${r}, ${g}, ${b})`;
    }

    if (settings.showElevation) {
      const normalizedValue = (cell.altitude + 200) / 2400;
      const adjustedValue = Math.min(
        1,
        normalizedValue * settings.exaggerateHeight,
      );
      const value = Math.floor(255 - adjustedValue * 255);
      return `rgb(${value},${value},${value})`;
    }

    return "rgb(200,200,200)";
  }
}
