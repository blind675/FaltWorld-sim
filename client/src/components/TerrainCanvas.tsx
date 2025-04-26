import { useEffect, useRef } from 'react';
import { type TerrainGrid } from '@shared/schema';

interface TerrainCanvasProps {
  terrain: TerrainGrid;
  width: number;
  height: number;
}

export function TerrainCanvas({ terrain, width, height }: TerrainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !terrain.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridSize = terrain.length;
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;

    ctx.clearRect(0, 0, width, height);

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = terrain[y][x];
        if (!cell) continue;

        if (cell.type === 'spring') {
          ctx.fillStyle = 'rgb(0, 0, 255)'; // Blue for springs
        } else if (cell.type === 'river') {
          ctx.fillStyle = 'rgb(0, 128, 255)'; // Light blue for rivers
        } else {
          // Map altitude to grayscale (0-255)
          // Map from [-200,2200] to [0,255]
          const normalizedValue = (cell.altitude + 200) / 2400;
          // Inverse the value (255-value) to make high values darker
          const value = Math.floor(255 - (normalizedValue * 255));
          ctx.fillStyle = `rgb(${value},${value},${value})`;
        }

        ctx.fillRect(
          x * cellWidth,
          y * cellHeight,
          cellWidth + 1, // Add 1 to prevent gaps
          cellHeight + 1
        );
      }
    }
  }, [terrain, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-border rounded-lg"
    />
  );
}