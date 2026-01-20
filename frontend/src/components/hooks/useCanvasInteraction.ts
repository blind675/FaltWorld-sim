import { useCallback, useState } from "react";
import type React from "react";
import { type TerrainGrid } from "@/shared/schema";
import { type CellInfo, type VisualizationSettings } from "../canvas/types";

interface UseCanvasInteractionOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  terrainGrid: TerrainGrid;
  width: number;
  height: number;
  settings: VisualizationSettings;
  onCellSelect?: (cellInfo: CellInfo | null) => void;
}

interface UseCanvasInteractionResult {
  hoveredCell: CellInfo | null;
  selectedCell: CellInfo | null;
  mousePosition: { x: number; y: number };
  handleMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseLeave: () => void;
  handleClick: (event: React.MouseEvent<HTMLCanvasElement>) => void;
}

export const useCanvasInteraction = ({
  canvasRef,
  terrainGrid,
  width,
  height,
  settings,
  onCellSelect,
}: UseCanvasInteractionOptions): UseCanvasInteractionResult => {
  const [hoveredCell, setHoveredCell] = useState<CellInfo | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const getCellFromEvent = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current || !terrainGrid.length) {
        return null;
      }

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Fixed 100x100 viewport with zoom only (no panning)
      const viewportSize = terrainGrid.length;
      const zoomLevel = settings.zoomLevel || 1.0;

      // Calculate cell size based on zoom
      const visibleCells = viewportSize / zoomLevel;
      const cellWidth = width / visibleCells;
      const cellHeight = height / visibleCells;

      // Direct mapping - no panning offset
      const cellX = Math.floor(mouseX / cellWidth);
      const cellY = Math.floor(mouseY / cellHeight);

      // Check bounds
      if (cellX < 0 || cellX >= viewportSize || cellY < 0 || cellY >= viewportSize) {
        return null;
      }

      const cell = terrainGrid[cellY]?.[cellX];
      if (!cell) {
        return null;
      }

      return {
        cell,
        x: cellX,
        y: cellY,
        screenX: mouseX,
        screenY: mouseY,
      } as CellInfo;
    },
    [canvasRef, terrainGrid, settings.zoomLevel, width, height],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const cellInfo = getCellFromEvent(event);
      setMousePosition({ x: event.clientX, y: event.clientY });
      setHoveredCell(cellInfo);
    },
    [getCellFromEvent],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) return;
      const cellInfo = getCellFromEvent(event);
      if (!cellInfo) return;

      if (
        selectedCell &&
        selectedCell.x === cellInfo.x &&
        selectedCell.y === cellInfo.y
      ) {
        setSelectedCell(null);
        onCellSelect?.(null);
        return;
      }

      setSelectedCell(cellInfo);
      onCellSelect?.(cellInfo);
    },
    [getCellFromEvent, onCellSelect, selectedCell],
  );

  return {
    hoveredCell,
    selectedCell,
    mousePosition,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
  };
};
