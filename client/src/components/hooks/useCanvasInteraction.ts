import { useCallback, useState } from "react";
import type React from "react";
import { type TerrainGrid } from "@shared/schema";
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

      const zoomLevel = settings.zoomLevel || 1.0;
      const panOffset = settings.panOffset || { x: 0, y: 0 };
      const gridSize = terrainGrid.length;
      const cellWidth = (width / gridSize) * zoomLevel;
      const cellHeight = (height / gridSize) * zoomLevel;
      const worldWidth = gridSize * cellWidth;
      const worldHeight = gridSize * cellHeight;
      const normalizedPanX = ((panOffset.x % worldWidth) + worldWidth) % worldWidth;
      const normalizedPanY = ((panOffset.y % worldHeight) + worldHeight) % worldHeight;
      const adjustedMouseX = mouseX - normalizedPanX;
      const adjustedMouseY = mouseY - normalizedPanY;
      const rawCellX = Math.floor(adjustedMouseX / cellWidth);
      const rawCellY = Math.floor(adjustedMouseY / cellHeight);
      const cellX = ((rawCellX % gridSize) + gridSize) % gridSize;
      const cellY = ((rawCellY % gridSize) + gridSize) % gridSize;
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
    [canvasRef, terrainGrid, height, settings.panOffset, settings.zoomLevel, width],
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
