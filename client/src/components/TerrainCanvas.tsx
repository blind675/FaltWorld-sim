import { useEffect, useRef, useState } from "react";
import { type TerrainGrid, type TerrainCell } from "@shared/schema";

interface TerrainCanvasProps {
  terrain: TerrainGrid;
  width: number;
  height: number;
}

interface CellInfo {
  cell: TerrainCell;
  x: number;
  y: number;
  screenX: number;
  screenY: number;
}

export function TerrainCanvas({ terrain, width, height }: TerrainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCell, setHoveredCell] = useState<CellInfo | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

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

        if (cell.type === "spring") {
          ctx.fillStyle = "rgb(0, 0, 255)"; // Blue for springs
        } else if (cell.type === "river") {
          // Different blue shades based on water height
          if (cell.water_height >= 1) {
            ctx.fillStyle = "rgb(0, 64, 192)"; // Darker blue for deeper rivers
          } else {
            ctx.fillStyle = "rgb(0, 128, 255)"; // Light blue for shallow rivers
          }
        } else if (cell.type === "mud") {
          // Dark brown for mud (high moisture)
          ctx.fillStyle = "rgb(102, 51, 0)"; // Dark brown
        } else if (cell.type === "earth") {
          // Medium brown for earth (medium moisture)
          ctx.fillStyle = "rgb(153, 102, 51)"; // Brown
        } else {
          // Map altitude to grayscale (0-255)
          // Map from [-200,2200] to [0,255]
          const normalizedValue = (cell.altitude + 200) / 2400;
          // Inverse the value (255-value) to make high values darker
          const value = Math.floor(255 - normalizedValue * 255);
          ctx.fillStyle = `rgb(${value},${value},${value})`;
        }

        ctx.fillRect(
          x * cellWidth,
          y * cellHeight,
          cellWidth + 1, // Add 1 to prevent gaps
          cellHeight + 1,
        );

        // Highlight the hovered cell with a white border
        if (hoveredCell && hoveredCell.x === x && hoveredCell.y === y) {
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.strokeRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
        }
      }
    }
  }, [terrain, width, height, hoveredCell]);

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

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-border rounded-lg"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
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
