import { useEffect, useRef, useState } from "react";
import { type TerrainGrid, type TerrainCell } from "@shared/schema";
import { ViewportManager } from "@/lib/viewportManager";

// Visualization settings interface
export interface VisualizationSettings {
  showRivers: boolean;
  showMoisture: boolean;
  showElevation: boolean;
  exaggerateHeight: number; // 1.0 is normal, higher values exaggerate the height differences
  contourLines: boolean;
  contourInterval: number; // Interval for contour lines
  colorMode: "default" | "heightmap" | "moisture" | "temperature" | "humidity";
  wireframe: boolean;
  zoomLevel: number; // 1.0 is normal, higher values zoom in
  panOffset: { x: number; y: number }; // Offset for panning
}

interface TerrainCanvasProps {
  terrain?: TerrainGrid;
  viewportManager?: ViewportManager;
  refreshToken?: number;
  width: number;
  height: number;
  onCellSelect?: (cellInfo: CellInfo | null) => void;
  visualizationSettings?: Partial<VisualizationSettings>;
  onVisualizationSettingsChange?: (
    settings: Partial<VisualizationSettings>,
  ) => void;
}

interface CellInfo {
  cell: TerrainCell;
  x: number;
  y: number;
  screenX: number;
  screenY: number;
}

export function TerrainCanvas({
  terrain,
  viewportManager,
  refreshToken = 0,
  width,
  height,
  onCellSelect,
  visualizationSettings = {},
  onVisualizationSettingsChange,
}: TerrainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCell, setHoveredCell] = useState<CellInfo | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [renderTerrain, setRenderTerrain] = useState<TerrainGrid>(
    terrain ?? [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [worldSize, setWorldSize] = useState(
    terrain?.length ?? viewportManager?.getWorldSize() ?? 0,
  );

  // Default visualization settings
  const defaultSettings: VisualizationSettings = {
    showRivers: true,
    showMoisture: true,
    showElevation: true,
    exaggerateHeight: 1.0,
    contourLines: false,
    contourInterval: 100,
    colorMode: "default",
    wireframe: false,
    zoomLevel: 2.0,
    panOffset: { x: 0, y: 0 },
  };

  // Merge default settings with provided settings
  const settings: VisualizationSettings = {
    ...defaultSettings,
    ...visualizationSettings,
  };

  const terrainGrid = terrain ?? renderTerrain;

  const createEmptyGrid = (size: number): TerrainGrid =>
    Array.from({ length: size }, () => Array<TerrainCell>(size));

  const getViewportBounds = () => {
    if (!worldSize) {
      return null;
    }

    const zoomLevel = settings.zoomLevel || 1.0;
    const panOffset = settings.panOffset || { x: 0, y: 0 };

    const cellWidth = (width / worldSize) * zoomLevel;
    const cellHeight = (height / worldSize) * zoomLevel;
    const worldWidth = worldSize * cellWidth;
    const worldHeight = worldSize * cellHeight;

    const normalizedPanX =
      ((panOffset.x % worldWidth) + worldWidth) % worldWidth;
    const normalizedPanY =
      ((panOffset.y % worldHeight) + worldHeight) % worldHeight;

    const startX = Math.floor(-normalizedPanX / cellWidth);
    const startY = Math.floor(-normalizedPanY / cellHeight);
    const endX = Math.ceil((width - normalizedPanX) / cellWidth);
    const endY = Math.ceil((height - normalizedPanY) / cellHeight);

    return {
      startX,
      startY,
      width: Math.max(1, endX - startX),
      height: Math.max(1, endY - startY),
    };
  };

  useEffect(() => {
    if (terrain) {
      setRenderTerrain(terrain);
      setWorldSize(terrain.length);
    }
  }, [terrain]);

  useEffect(() => {
    if (!viewportManager || terrain) {
      return;
    }

    const bounds = getViewportBounds();
    if (!bounds) {
      return;
    }

    let isActive = true;
    setIsLoading(true);

    viewportManager
      .getViewportData(bounds.startX, bounds.startY, bounds.width, bounds.height)
      .then((viewport) => {
        if (!isActive) {
          return;
        }
        const nextWorldSize = viewportManager.getWorldSize();
        setWorldSize(nextWorldSize);
        setRenderTerrain((prev) => {
          const shouldReuse = prev.length === nextWorldSize;
          const base = shouldReuse ? [...prev] : createEmptyGrid(nextWorldSize);

          for (let row = 0; row < bounds.height; row += 1) {
            const viewportRow = viewport[row];
            if (!viewportRow) continue;

            const worldY =
              ((bounds.startY + row) % nextWorldSize + nextWorldSize) %
              nextWorldSize;
            const baseRow = base[worldY];
            const nextRow = shouldReuse ? [...baseRow] : baseRow;

            for (let col = 0; col < bounds.width; col += 1) {
              const cell = viewportRow[col];
              if (!cell) continue;
              const worldX =
                ((bounds.startX + col) % nextWorldSize + nextWorldSize) %
                nextWorldSize;
              nextRow[worldX] = cell;
            }

            base[worldY] = nextRow;
          }

          return base;
        });
      })
      .catch((error) => {
        console.error("Failed to load viewport data", error);
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    viewportManager,
    terrain,
    width,
    height,
    settings.zoomLevel,
    settings.panOffset,
    refreshToken,
    worldSize,
  ]);

  useEffect(() => {
    if (!viewportManager || terrain) {
      return;
    }

    const bounds = getViewportBounds();
    if (!bounds) {
      return;
    }

    const timer = window.setTimeout(() => {
      viewportManager.prefetchAdjacent(bounds.startX, bounds.startY);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    viewportManager,
    terrain,
    width,
    height,
    settings.zoomLevel,
    settings.panOffset,
    worldSize,
  ]);

  // Helper function to get cell color based on visualization settings
  const getCellColor = (cell: TerrainCell) => {
    // If we're using heightmap mode, only show elevation
    if (settings.colorMode === "heightmap") {
      const normalizedValue = (cell.altitude + 200) / 2400;
      // Adjust height exaggeration factor
      const adjustedValue = Math.min(
        1,
        normalizedValue * settings.exaggerateHeight,
      );
      // Use a blue-to-white-to-brown gradient for heightmap
      if (adjustedValue < 0.5) {
        // Blue (0,0,255) to white (255,255,255)
        const factor = adjustedValue * 2; // 0 to 1
        const r = Math.floor(255 * factor);
        const g = Math.floor(255 * factor);
        const b = 255;
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        // White (255,255,255) to brown (102,51,0)
        const factor = (adjustedValue - 0.5) * 2; // 0 to 1
        const r = Math.floor(255 - (255 - 102) * factor);
        const g = Math.floor(255 - (255 - 51) * factor);
        const b = Math.floor(255 - 255 * factor);
        return `rgb(${r}, ${g}, ${b})`;
      }
    }

    // If we're using moisture mode, only show moisture
    if (settings.colorMode === "moisture") {
      // Use blue gradient for moisture
      const moistureValue = cell.moisture;
      // Blue gradient from white (dry) to dark blue (wet)
      const b = Math.floor(255);
      const g = Math.floor(255 * (1 - moistureValue));
      const r = Math.floor(255 * (1 - moistureValue));
      return `rgb(${r}, ${g}, ${b})`;
    }

    // If we're using temperature mode, show actual temperature
    if (settings.colorMode === "temperature") {
      // Use actual temperature from cell (ranges approximately -20°C to +30°C)
      // Normalize to 0-1 range for color mapping
      const minTemp = -20;
      const maxTemp = 30;
      const normalizedTemp = (cell.temperature - minTemp) / (maxTemp - minTemp);
      const clampedTemp = Math.max(0, Math.min(1, normalizedTemp));

      // Color gradient: Blue (cold) → Cyan → Green → Yellow → Red (hot)
      if (clampedTemp < 0.25) {
        // Blue to Cyan (very cold: -20°C to -7.5°C)
        const factor = clampedTemp * 4;
        const r = 0;
        const g = Math.floor(255 * factor);
        const b = 255;
        return `rgb(${r}, ${g}, ${b})`;
      } else if (clampedTemp < 0.5) {
        // Cyan to Green (cold: -7.5°C to +5°C)
        const factor = (clampedTemp - 0.25) * 4;
        const r = 0;
        const g = 255;
        const b = Math.floor(255 * (1 - factor));
        return `rgb(${r}, ${g}, ${b})`;
      } else if (clampedTemp < 0.75) {
        // Green to Yellow (moderate: +5°C to +17.5°C)
        const factor = (clampedTemp - 0.5) * 4;
        const r = Math.floor(255 * factor);
        const g = 255;
        const b = 0;
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        // Yellow to Red (hot: +17.5°C to +30°C)
        const factor = (clampedTemp - 0.75) * 4;
        const r = 255;
        const g = Math.floor(255 * (1 - factor));
        const b = 0;
        return `rgb(${r}, ${g}, ${b})`;
      }
    }

    // If we're using humidity mode, show air humidity
    if (settings.colorMode === "humidity") {
      // Air humidity gradient: tan (dry) → light blue → deep blue (saturated)
      const humidityValue = Math.min(1, Math.max(0, cell.air_humidity));

      if (humidityValue < 0.5) {
        // 0% to 50%: Light tan (245, 222, 179) to light blue (173, 216, 230)
        const factor = humidityValue * 2; // 0 to 1
        const r = Math.floor(245 - (245 - 173) * factor);
        const g = Math.floor(222 - (222 - 216) * factor);
        const b = Math.floor(179 + (230 - 179) * factor);
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        // 50% to 100%: Light blue (173, 216, 230) to deep blue (0, 0, 139)
        const factor = (humidityValue - 0.5) * 2; // 0 to 1
        const r = Math.floor(173 - 173 * factor);
        const g = Math.floor(216 - 216 * factor);
        const b = Math.floor(230 - (230 - 139) * factor);
        return `rgb(${r}, ${g}, ${b})`;
      }
    }

    // Default visualization mode (original logic)
    if (cell.type === "spring" && settings.showRivers) {
      return "rgb(0, 0, 255)"; // Blue for springs
    } else if (cell.type === "river" && settings.showRivers) {
      // Different blue shades based on water height
      if (cell.water_height >= 2) {
        return "rgb(0, 64, 192)"; // Darker blue for deeper rivers
      } else {
        return "rgb(0, 128, 255)"; // Light blue for shallow rivers
      }
    } else if (cell.type === "mud" && settings.showMoisture) {
      // Dark brown for mud (high moisture) with gradient based on altitude
      const normalizedValue = (cell.altitude + 200) / 2400;

      // Create a stronger color gradient for mud based on altitude
      // Higher altitude mud is darker, lower altitude mud is lighter
      const baseR = 120; // Base dark brown color components
      const baseG = 60;
      const baseB = 0;

      // Calculate how much to darken based on altitude
      // We want higher altitudes to be darker (subtract from base color)
      const darkenFactor = normalizedValue * settings.exaggerateHeight;

      // Apply darkening based on height - higher = darker
      const r = Math.max(40, Math.floor(baseR - darkenFactor * 80));
      const g = Math.max(20, Math.floor(baseG - darkenFactor * 40));
      const b = 0; // Keep blue at 0 for brown

      return `rgb(${r}, ${g}, ${b})`;
    } else if (cell.type === "earth" && settings.showMoisture) {
      // Medium brown for earth (medium moisture) with gradient based on altitude
      const normalizedValue = (cell.altitude + 200) / 2400;

      // Create a stronger color gradient for earth based on altitude
      // Higher altitude earth is darker, lower altitude earth is lighter
      const baseR = 180; // Base medium brown color components
      const baseG = 120;
      const baseB = 60;

      // Calculate how much to darken based on altitude
      // We want higher altitudes to be darker (subtract from base color)
      const darkenFactor = normalizedValue * settings.exaggerateHeight;

      // Apply darkening based on height - higher = darker
      const r = Math.max(25, Math.floor(baseR - darkenFactor * 185));
      const g = Math.max(10, Math.floor(baseG - darkenFactor * 140));
      const b = Math.max(7, Math.floor(baseB - darkenFactor * 83));

      return `rgb(${r}, ${g}, ${b})`;
    } else if (settings.showElevation) {
      // Map altitude to grayscale (0-255)
      // Map from [-200,2200] to [0,255]
      const normalizedValue = (cell.altitude + 200) / 2400;
      // Apply height exaggeration
      const adjustedValue = Math.min(
        1,
        normalizedValue * settings.exaggerateHeight,
      );
      // Inverse the value (255-value) to make high values darker
      const value = Math.floor(255 - adjustedValue * 255);
      return `rgb(${value},${value},${value})`;
    } else {
      // Fallback color - subtle gray
      return "rgb(200,200,200)";
    }
  };

  // Draw the terrain grid
  useEffect(() => {
    if (!canvasRef.current || !terrainGrid.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gridSize = terrainGrid.length;

    // Apply zoom and pan transformations
    const zoomLevel = settings.zoomLevel || 1.0;
    const panOffset = settings.panOffset || { x: 0, y: 0 };

    // Calculate cell dimensions with zoom applied
    const cellWidth = (width / gridSize) * zoomLevel;
    const cellHeight = (height / gridSize) * zoomLevel;

    // Calculate the total world size in pixels
    const worldWidth = gridSize * cellWidth;
    const worldHeight = gridSize * cellHeight;

    // Normalize pan offset to wrap around the world (modulo operation)
    const normalizedPanX = ((panOffset.x % worldWidth) + worldWidth) % worldWidth;
    const normalizedPanY = ((panOffset.y % worldHeight) + worldHeight) % worldHeight;

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    // Save the context state before applying transformations
    ctx.save();

    // Calculate which cells are visible in the viewport with wrapping
    // We need to render enough to fill the screen, potentially drawing the world multiple times
    const startX = Math.floor(-normalizedPanX / cellWidth);
    const startY = Math.floor(-normalizedPanY / cellHeight);
    const endX = Math.ceil((width - normalizedPanX) / cellWidth);
    const endY = Math.ceil((height - normalizedPanY) / cellHeight);

    // Render cells with wrapping
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        // Wrap coordinates to get the actual cell from the terrain grid
        const wrappedX = ((x % gridSize) + gridSize) % gridSize;
        const wrappedY = ((y % gridSize) + gridSize) % gridSize;

        const cell = terrainGrid[wrappedY][wrappedX];
        if (!cell) continue;

        // Get cell color based on visualization settings
        ctx.fillStyle = getCellColor(cell);

        // Draw cell with zoom and pan applied
        ctx.fillRect(
          x * cellWidth + normalizedPanX,
          y * cellHeight + normalizedPanY,
          cellWidth + 1, // Add 1 to prevent gaps
          cellHeight + 1,
        );

        // Draw connected river segments for clearer stream tracking
        if (
          settings.showRivers &&
          (cell.type === "river" || cell.type === "spring") &&
          cell.river_name
        ) {
          const drawRiverSegment = (
            neighborX: number,
            neighborY: number,
            screenNeighborX: number,
            screenNeighborY: number,
          ) => {
            const neighborCell = terrainGrid[neighborY][neighborX];
            if (
              !neighborCell ||
              (neighborCell.type !== "river" && neighborCell.type !== "spring") ||
              neighborCell.river_name !== cell.river_name
            ) {
              return;
            }

            const baseWidth = Math.max(1, Math.min(3, cell.water_height || 1));
            const lineWidth =
              Math.max(1, Math.min(cellWidth, cellHeight) * 0.15) * baseWidth;

            ctx.strokeStyle = cell.water_height >= 2
              ? "rgba(0, 64, 192, 0.9)"
              : "rgba(0, 128, 255, 0.9)";
            ctx.lineWidth = lineWidth;
            ctx.lineCap = "round";

            ctx.beginPath();
            ctx.moveTo(
              x * cellWidth + normalizedPanX + cellWidth / 2,
              y * cellHeight + normalizedPanY + cellHeight / 2,
            );
            ctx.lineTo(
              screenNeighborX + cellWidth / 2,
              screenNeighborY + cellHeight / 2,
            );
            ctx.stroke();
          };

          const wrappedRightX = (wrappedX + 1) % gridSize;
          const wrappedDownY = (wrappedY + 1) % gridSize;

          drawRiverSegment(
            wrappedRightX,
            wrappedY,
            (x + 1) * cellWidth + normalizedPanX,
            y * cellHeight + normalizedPanY,
          );

          drawRiverSegment(
            wrappedX,
            wrappedDownY,
            x * cellWidth + normalizedPanX,
            (y + 1) * cellHeight + normalizedPanY,
          );
        }

        // Draw contour lines if enabled
        if (settings.contourLines && settings.showElevation) {
          // Get the altitude adjusted with the contour interval
          const altitude = cell.altitude;
          const interval = settings.contourInterval;

          // Check if this cell is on a contour line
          if (
            Math.round(altitude / interval) * interval ===
            Math.round(altitude)
          ) {
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.lineWidth = 0.5;
            ctx.strokeRect(
              x * cellWidth + normalizedPanX,
              y * cellHeight + normalizedPanY,
              cellWidth,
              cellHeight,
            );
          }
        }

        // Draw wireframe if enabled
        if (settings.wireframe) {
          ctx.strokeStyle = "rgba(0,0,0,0.2)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(
            x * cellWidth + normalizedPanX,
            y * cellHeight + normalizedPanY,
            cellWidth,
            cellHeight
          );
        }

        // Highlight the selected cell with a golden border (check wrapped coordinates)
        if (selectedCell && selectedCell.x === wrappedX && selectedCell.y === wrappedY) {
          ctx.strokeStyle = "gold";
          ctx.lineWidth = 3;
          ctx.strokeRect(
            x * cellWidth + normalizedPanX,
            y * cellHeight + normalizedPanY,
            cellWidth,
            cellHeight
          );
        }

        // Highlight the hovered cell with a white border (check wrapped coordinates)
        if (hoveredCell && hoveredCell.x === wrappedX && hoveredCell.y === wrappedY) {
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.strokeRect(
            x * cellWidth + normalizedPanX,
            y * cellHeight + normalizedPanY,
            cellWidth,
            cellHeight
          );
        }
      }
    }

    // Restore the context state
    ctx.restore();
  }, [terrainGrid, width, height, hoveredCell, selectedCell, settings]);

  // Draw the minimap
  useEffect(() => {
    if (!minimapRef.current || !terrainGrid.length) return;

    const minimap = minimapRef.current;
    const ctx = minimap.getContext("2d");
    if (!ctx) return;

    const minimapSize = 150; // Size of the minimap
    const gridSize = terrainGrid.length;
    const cellSize = minimapSize / gridSize;

    // Clear the minimap
    ctx.clearRect(0, 0, minimapSize, minimapSize);

    // Draw the terrain on the minimap (simplified version)
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = terrainGrid[y][x];
        if (!cell) continue;

        // Use simplified color scheme for minimap
        ctx.fillStyle = getCellColor(cell);
        ctx.fillRect(x * cellSize, y * cellSize, cellSize + 1, cellSize + 1);
      }
    }

    // Draw viewport indicator with wrapping support
    const zoomLevel = settings.zoomLevel || 1.0;
    const panOffset = settings.panOffset || { x: 0, y: 0 };

    // Calculate the visible area in grid coordinates
    const cellWidth = (width / gridSize) * zoomLevel;
    const cellHeight = (height / gridSize) * zoomLevel;

    // Calculate the total world size in pixels
    const worldWidth = gridSize * cellWidth;
    const worldHeight = gridSize * cellHeight;

    // Normalize pan offset to wrap around the world
    const normalizedPanX = ((panOffset.x % worldWidth) + worldWidth) % worldWidth;
    const normalizedPanY = ((panOffset.y % worldHeight) + worldHeight) % worldHeight;

    // Calculate viewport bounds in grid space (normalized to [0, gridSize])
    const viewportStartX = (-normalizedPanX / cellWidth) % gridSize;
    const viewportStartY = (-normalizedPanY / cellHeight) % gridSize;
    const viewportWidth = width / cellWidth;
    const viewportHeight = height / cellHeight;

    // Normalize viewport start to positive values
    const normalizedStartX = ((viewportStartX % gridSize) + gridSize) % gridSize;
    const normalizedStartY = ((viewportStartY % gridSize) + gridSize) % gridSize;

    // Draw viewport rectangle(s) on minimap - may need to draw multiple if wrapping
    ctx.strokeStyle = "rgba(255, 215, 0, 0.9)"; // Gold color
    ctx.lineWidth = 2;

    // Check if viewport wraps horizontally or vertically
    const wrapsX = normalizedStartX + viewportWidth > gridSize;
    const wrapsY = normalizedStartY + viewportHeight > gridSize;

    if (!wrapsX && !wrapsY) {
      // No wrapping - draw single rectangle
      ctx.strokeRect(
        normalizedStartX * cellSize,
        normalizedStartY * cellSize,
        viewportWidth * cellSize,
        viewportHeight * cellSize
      );
    } else if (wrapsX && !wrapsY) {
      // Wraps horizontally only - draw two rectangles
      const rightWidth = gridSize - normalizedStartX;
      const leftWidth = viewportWidth - rightWidth;

      // Right portion
      ctx.strokeRect(
        normalizedStartX * cellSize,
        normalizedStartY * cellSize,
        rightWidth * cellSize,
        viewportHeight * cellSize
      );
      // Left portion (wrapped)
      ctx.strokeRect(
        0,
        normalizedStartY * cellSize,
        leftWidth * cellSize,
        viewportHeight * cellSize
      );
    } else if (!wrapsX && wrapsY) {
      // Wraps vertically only - draw two rectangles
      const bottomHeight = gridSize - normalizedStartY;
      const topHeight = viewportHeight - bottomHeight;

      // Bottom portion
      ctx.strokeRect(
        normalizedStartX * cellSize,
        normalizedStartY * cellSize,
        viewportWidth * cellSize,
        bottomHeight * cellSize
      );
      // Top portion (wrapped)
      ctx.strokeRect(
        normalizedStartX * cellSize,
        0,
        viewportWidth * cellSize,
        topHeight * cellSize
      );
    } else {
      // Wraps both horizontally and vertically - draw four rectangles
      const rightWidth = gridSize - normalizedStartX;
      const leftWidth = viewportWidth - rightWidth;
      const bottomHeight = gridSize - normalizedStartY;
      const topHeight = viewportHeight - bottomHeight;

      // Bottom-right
      ctx.strokeRect(
        normalizedStartX * cellSize,
        normalizedStartY * cellSize,
        rightWidth * cellSize,
        bottomHeight * cellSize
      );
      // Bottom-left
      ctx.strokeRect(
        0,
        normalizedStartY * cellSize,
        leftWidth * cellSize,
        bottomHeight * cellSize
      );
      // Top-right
      ctx.strokeRect(
        normalizedStartX * cellSize,
        0,
        rightWidth * cellSize,
        topHeight * cellSize
      );
      // Top-left
      ctx.strokeRect(
        0,
        0,
        leftWidth * cellSize,
        topHeight * cellSize
      );
    }
  }, [terrainGrid, width, height, settings, getCellColor]);

  // Mouse move handler to determine hovered cell
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !terrainGrid.length) return;

    // Get canvas position and mouse coordinates
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setMousePosition({ x: e.clientX, y: e.clientY });

    // Apply zoom and pan transformations
    const zoomLevel = settings.zoomLevel || 1.0;
    const panOffset = settings.panOffset || { x: 0, y: 0 };

    // Calculate cell coordinates accounting for zoom and pan
    const gridSize = terrainGrid.length;
    const cellWidth = (width / gridSize) * zoomLevel;
    const cellHeight = (height / gridSize) * zoomLevel;

    // Calculate the total world size in pixels
    const worldWidth = gridSize * cellWidth;
    const worldHeight = gridSize * cellHeight;

    // Normalize pan offset to wrap around the world
    const normalizedPanX = ((panOffset.x % worldWidth) + worldWidth) % worldWidth;
    const normalizedPanY = ((panOffset.y % worldHeight) + worldHeight) % worldHeight;

    // Adjust mouse coordinates for zoom and pan with wrapping
    const adjustedMouseX = mouseX - normalizedPanX;
    const adjustedMouseY = mouseY - normalizedPanY;

    // Calculate cell coordinates
    const rawCellX = Math.floor(adjustedMouseX / cellWidth);
    const rawCellY = Math.floor(adjustedMouseY / cellHeight);

    // Wrap cell coordinates to grid bounds
    const cellX = ((rawCellX % gridSize) + gridSize) % gridSize;
    const cellY = ((rawCellY % gridSize) + gridSize) % gridSize;

    const cell = terrainGrid[cellY][cellX];
    if (cell) {
      setHoveredCell({
        cell,
        x: cellX,
        y: cellY,
        screenX: mouseX,
        screenY: mouseY,
      });
    } else {
      setHoveredCell(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
  };


  // Mouse down handler for panning
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only initiate pan with middle mouse button (button 1) or right click (button 2)
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setLastPanPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Update pan position on mouse move while panning
  useEffect(() => {
    const handlePanMove = (e: MouseEvent) => {
      if (!isPanning) return;

      const dx = e.clientX - lastPanPosition.x;
      const dy = e.clientY - lastPanPosition.y;

      const currentPan = settings.panOffset || { x: 0, y: 0 };
      const newPan = {
        x: currentPan.x + dx,
        y: currentPan.y + dy,
      };

      if (onVisualizationSettingsChange) {
        onVisualizationSettingsChange({
          ...settings,
          panOffset: newPan,
        });
      }

      setLastPanPosition({ x: e.clientX, y: e.clientY });
    };

    // Add global mouse event listeners for panning
    if (isPanning) {
      window.addEventListener("mousemove", handlePanMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handlePanMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning, lastPanPosition, settings, onVisualizationSettingsChange]);

  // Mouse click handler to select a cell
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Skip if right button or middle button (used for panning)
    if (e.button !== 0 || !canvasRef.current || !terrainGrid.length) return;

    // Get canvas position and mouse coordinates
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Apply zoom and pan transformations
    const zoomLevel = settings.zoomLevel || 1.0;
    const panOffset = settings.panOffset || { x: 0, y: 0 };

    // Calculate cell coordinates accounting for zoom and pan
    const gridSize = terrainGrid.length;
    const cellWidth = (width / gridSize) * zoomLevel;
    const cellHeight = (height / gridSize) * zoomLevel;

    // Calculate the total world size in pixels
    const worldWidth = gridSize * cellWidth;
    const worldHeight = gridSize * cellHeight;

    // Normalize pan offset to wrap around the world
    const normalizedPanX = ((panOffset.x % worldWidth) + worldWidth) % worldWidth;
    const normalizedPanY = ((panOffset.y % worldHeight) + worldHeight) % worldHeight;

    // Adjust mouse coordinates for zoom and pan with wrapping
    const adjustedMouseX = mouseX - normalizedPanX;
    const adjustedMouseY = mouseY - normalizedPanY;

    // Calculate cell coordinates
    const rawCellX = Math.floor(adjustedMouseX / cellWidth);
    const rawCellY = Math.floor(adjustedMouseY / cellHeight);

    // Wrap cell coordinates to grid bounds
    const cellX = ((rawCellX % gridSize) + gridSize) % gridSize;
    const cellY = ((rawCellY % gridSize) + gridSize) % gridSize;

    const cell = terrainGrid[cellY][cellX];
    if (cell) {
      const cellInfo = {
        cell,
        x: cellX,
        y: cellY,
        screenX: mouseX,
        screenY: mouseY,
      };

      // Toggle selection - if clicking on the same cell, deselect it
      if (
        selectedCell &&
        selectedCell.x === cellX &&
        selectedCell.y === cellY
      ) {
        setSelectedCell(null);
        // Notify parent component if callback is provided
        if (onCellSelect) onCellSelect(null);
      } else {
        setSelectedCell(cellInfo);
        // Notify parent component if callback is provided
        if (onCellSelect) onCellSelect(cellInfo);
      }
    }
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-border rounded-lg"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => e.preventDefault()} // Prevent context menu on right click
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white">Loading viewport...</div>
        </div>
      )}

      {/* Minimap */}
      <div className="absolute bottom-4 right-4 border-2 border-gold rounded-lg shadow-lg bg-black/50 backdrop-blur-sm">
        <canvas
          ref={minimapRef}
          width={150}
          height={150}
          className="rounded-lg"
        />
      </div>

      {/* Cell information popup */}
      {hoveredCell && (
        <div
          className="absolute z-10 bg-black/80 text-white p-3 rounded-md text-sm shadow-lg"
          style={{
            left: mousePosition.x + 10,
            top: mousePosition.y + 10,
            maxWidth: "250px",
          }}
        >
          <div className="font-bold mb-1">
            Position: ({hoveredCell.x}, {hoveredCell.y})
          </div>
          <div>
            Type: <span className="font-medium">{hoveredCell.cell.type}</span>
          </div>
          {hoveredCell.cell.river_name && (
            <div>
              River: <span className="font-medium text-blue-300">🌊 {hoveredCell.cell.river_name}</span>
            </div>
          )}
          <div>
            Altitude:{" "}
            <span className="font-medium">
              {hoveredCell.cell.altitude.toFixed(2)}
            </span>
          </div>
          <div>
            Terrain Height:{" "}
            <span className="font-medium">
              {hoveredCell.cell.terrain_height.toFixed(2)}
            </span>
          </div>
          <div>
            Water Height:{" "}
            <span className="font-medium">
              {hoveredCell.cell.water_height.toFixed(2)}
            </span>
          </div>
          <div>
            Base Moisture:{" "}
            <span className="font-medium">
              {hoveredCell.cell.base_moisture?.toFixed(2)}
            </span>
          </div>
          <div>
            Moisture:{" "}
            <span className="font-medium">
              {hoveredCell.cell.moisture?.toFixed(2)}
            </span>
          </div>
          <div>
            Temperature:{" "}
            <span className="font-medium">
              {hoveredCell.cell.temperature?.toFixed(1)}°C
            </span>
          </div>
          <div>
            Air Humidity:{" "}
            <span className="font-medium">
              {((hoveredCell.cell.air_humidity || 0) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
