import { useEffect, useRef, useState } from "react";
import { type TerrainGrid, type TerrainCell } from "@shared/schema";

// Visualization settings interface
export interface VisualizationSettings {
  showRivers: boolean;
  showMoisture: boolean;
  showElevation: boolean;
  exaggerateHeight: number; // 1.0 is normal, higher values exaggerate the height differences
  contourLines: boolean;
  contourInterval: number; // Interval for contour lines
  colorMode: "default" | "heightmap" | "moisture" | "temperature";
  wireframe: boolean;
}

interface TerrainCanvasProps {
  terrain: TerrainGrid;
  width: number;
  height: number;
  onCellSelect?: (cellInfo: CellInfo | null) => void;
  visualizationSettings?: Partial<VisualizationSettings>;
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
  width,
  height,
  onCellSelect,
  visualizationSettings = {},
}: TerrainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCell, setHoveredCell] = useState<CellInfo | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

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
  };

  // Merge default settings with provided settings
  const settings: VisualizationSettings = {
    ...defaultSettings,
    ...visualizationSettings,
  };

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

    // If we're using temperature mode (estimated based on altitude)
    if (settings.colorMode === "temperature") {
      // Approximate temperature based on altitude (higher = colder)
      const normalizedAltitude = (cell.altitude + 200) / 2400;
      // Inverse for temperature (higher altitude = lower temp)
      const temperature = 1 - normalizedAltitude * settings.exaggerateHeight;

      // Red (hot) to blue (cold) gradient
      const r = Math.floor(255 * temperature);
      const g = Math.floor(100 * temperature);
      const b = Math.floor(255 * (1 - temperature));
      return `rgb(${r}, ${g}, ${b})`;
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
      // Apply height exaggeration
      const adjustedValue = Math.min(
        1,
        normalizedValue * settings.exaggerateHeight,
      );
      // For mud: Dark brown with height-based gradient (102-51-0 to 80-40-0)
      const r = Math.floor(102 - adjustedValue * 22);
      const g = Math.floor(51 - adjustedValue * 11);
      const b = Math.floor(0);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (cell.type === "earth" && settings.showMoisture) {
      // Medium brown for earth (medium moisture) with gradient based on altitude
      const normalizedValue = (cell.altitude + 200) / 2400;
      // Apply height exaggeration
      const adjustedValue = Math.min(
        1,
        normalizedValue * settings.exaggerateHeight,
      );
      // For earth: Brown with height-based gradient (153-102-51 to 120-80-40)
      const r = Math.floor(153 - adjustedValue * 33);
      const g = Math.floor(102 - adjustedValue * 22);
      const b = Math.floor(51 - adjustedValue * 11);
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
    if (!canvasRef.current || !terrain.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gridSize = terrain.length;
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;

    ctx.clearRect(0, 0, width, height);

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = terrain[y][x];
        if (!cell) continue;

        // Get cell color based on visualization settings
        ctx.fillStyle = getCellColor(cell);

        // Draw cell
        ctx.fillRect(
          x * cellWidth,
          y * cellHeight,
          cellWidth + 1, // Add 1 to prevent gaps
          cellHeight + 1,
        );

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
              x * cellWidth,
              y * cellHeight,
              cellWidth,
              cellHeight,
            );
          }
        }

        // Draw wireframe if enabled
        if (settings.wireframe) {
          ctx.strokeStyle = "rgba(0,0,0,0.2)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
        }

        // Highlight the selected cell with a golden border (drawn first to be under hover)
        if (selectedCell && selectedCell.x === x && selectedCell.y === y) {
          ctx.strokeStyle = "gold";
          ctx.lineWidth = 3;
          ctx.strokeRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
        }

        // Highlight the hovered cell with a white border
        if (hoveredCell && hoveredCell.x === x && hoveredCell.y === y) {
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.strokeRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
        }
      }
    }
  }, [terrain, width, height, hoveredCell, selectedCell, settings]);

  // Mouse move handler to determine hovered cell
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !terrain.length) return;

    // Get canvas position and mouse coordinates
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setMousePosition({ x: e.clientX, y: e.clientY });

    // Calculate cell coordinates
    const gridSize = terrain.length;
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;

    const cellX = Math.floor(mouseX / cellWidth);
    const cellY = Math.floor(mouseY / cellHeight);

    // Check if coordinates are within bounds
    if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
      const cell = terrain[cellY][cellX];
      if (cell) {
        setHoveredCell({
          cell,
          x: cellX,
          y: cellY,
          screenX: mouseX,
          screenY: mouseY,
        });
        return;
      }
    }

    setHoveredCell(null);
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
  };

  // Mouse click handler to select a cell
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !terrain.length) return;

    // Get canvas position and mouse coordinates
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate cell coordinates
    const gridSize = terrain.length;
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;

    const cellX = Math.floor(mouseX / cellWidth);
    const cellY = Math.floor(mouseY / cellHeight);

    // Check if coordinates are within bounds
    if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
      const cell = terrain[cellY][cellX];
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
      />

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
              {hoveredCell.cell.base_moisture.toFixed(2)}
            </span>
          </div>
          <div>
            Moisture:{" "}
            <span className="font-medium">
              {hoveredCell.cell.moisture.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
