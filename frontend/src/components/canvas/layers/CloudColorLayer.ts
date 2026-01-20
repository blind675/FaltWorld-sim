import { type TerrainCell } from "@/shared/schema";
import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class CloudColorLayer implements ICanvasLayer {
    id = "cloud";

    shouldRender(settings: VisualizationSettings): boolean {
        return settings.colorMode === "cloud";
    }

    getCellColor(cell: TerrainCell): string {
        const cloudDensity = cell.cloud_density ?? 0;

        // Color gradient from dark blue (no clouds) to white (full clouds)
        // 0.0 = dark blue sky
        // 1.0 = white (full cloud cover)
        if (cloudDensity < 0.01) {
            return "rgb(30, 60, 120)"; // Clear sky - dark blue
        }

        // Interpolate from blue to white based on cloud density
        const blueR = 30;
        const blueG = 60;
        const blueB = 120;
        const whiteR = 255;
        const whiteG = 255;
        const whiteB = 255;

        const r = Math.floor(blueR + (whiteR - blueR) * cloudDensity);
        const g = Math.floor(blueG + (whiteG - blueG) * cloudDensity);
        const b = Math.floor(blueB + (whiteB - blueB) * cloudDensity);

        return `rgb(${r}, ${g}, ${b})`;
    }

    render(_context: LayerRenderContext): void { }
}
