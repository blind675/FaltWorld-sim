import { type CellInfo, type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class SelectionLayer implements ICanvasLayer {
  id = "selection";
  private selectedCell: CellInfo | null = null;
  private hoveredCell: CellInfo | null = null;

  /** Update selection/hovered cell info before rendering */
  setSelection(selectedCell: CellInfo | null, hoveredCell: CellInfo | null) {
    this.selectedCell = selectedCell;
    this.hoveredCell = hoveredCell;
  }

  /** Whether this layer should render given current settings */
  shouldRender(_settings: VisualizationSettings): boolean {
    return Boolean(this.selectedCell || this.hoveredCell);
  }

  /** Render selection highlights on top of the terrain */
  render(context: LayerRenderContext): void {
    if (!this.shouldRender(context.settings)) {
      return;
    }

    const {
      ctx,
      cellWidth,
      cellHeight,
      startX,
      startY,
      endX,
      endY,
      normalizedPanX,
      normalizedPanY,
      gridSize,
    } = context;

    const viewportHeight = context.terrainGrid.length;
    const viewportWidth = context.terrainGrid[0]?.length || 0;

    for (let viewportY = 0; viewportY < viewportHeight; viewportY++) {
      for (let viewportX = 0; viewportX < viewportWidth; viewportX++) {
        const worldX = startX + viewportX;
        const worldY = startY + viewportY;
        const wrappedX = ((worldX % gridSize) + gridSize) % gridSize;
        const wrappedY = ((worldY % gridSize) + gridSize) % gridSize;

        if (
          this.selectedCell &&
          this.selectedCell.x === wrappedX &&
          this.selectedCell.y === wrappedY
        ) {
          ctx.strokeStyle = "gold";
          ctx.lineWidth = 3;
          ctx.strokeRect(
            worldX * cellWidth + normalizedPanX,
            worldY * cellHeight + normalizedPanY,
            cellWidth,
            cellHeight,
          );
        }

        if (
          this.hoveredCell &&
          this.hoveredCell.x === wrappedX &&
          this.hoveredCell.y === wrappedY
        ) {
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
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
