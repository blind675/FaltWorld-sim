import { useEffect, useRef, useState } from "react";
import { type TerrainGrid } from "@shared/schema";
import { ViewportManager } from "@/lib/viewportManager";
import { CanvasRenderer } from "./canvas/CanvasRenderer";
import { MinimapRenderer } from "./canvas/MinimapRenderer";
import { type CellInfo, type VisualizationSettings } from "./canvas/types";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";
import { useCanvasPan } from "./hooks/useCanvasPan";

export type { VisualizationSettings } from "./canvas/types";

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
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const minimapRendererRef = useRef<MinimapRenderer | null>(null);
  const [renderTerrain, setRenderTerrain] = useState<TerrainGrid>(
    terrain ?? [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [worldSize, setWorldSize] = useState(
    terrain?.length ?? viewportManager?.getWorldSize() ?? 0,
  );

  if (!rendererRef.current) {
    rendererRef.current = new CanvasRenderer();
  }

  if (!minimapRendererRef.current) {
    minimapRendererRef.current = new MinimapRenderer();
  }

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

  const settings: VisualizationSettings = {
    ...defaultSettings,
    ...visualizationSettings,
  };

  const terrainGrid = terrain ?? renderTerrain;

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
    const normalizedPanX = ((panOffset.x % worldWidth) + worldWidth) % worldWidth;
    const normalizedPanY = ((panOffset.y % worldHeight) + worldHeight) % worldHeight;
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
        setRenderTerrain(viewport);
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

  const {
    hoveredCell,
    selectedCell,
    mousePosition,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
  } = useCanvasInteraction({
    canvasRef,
    terrainGrid,
    width,
    height,
    settings,
    onCellSelect,
  });

  const { handleMouseDown } = useCanvasPan({
    settings,
    onVisualizationSettingsChange,
  });

  useEffect(() => {
    if (!canvasRef.current || !terrainGrid.length) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    rendererRef.current?.render(
      ctx,
      terrainGrid,
      settings,
      width,
      height,
      selectedCell,
      hoveredCell,
    );

    ctx.restore();
  }, [
    terrainGrid,
    width,
    height,
    hoveredCell,
    selectedCell,
    settings,
  ]);

  useEffect(() => {
    if (!minimapRef.current || !terrainGrid.length) return;

    const ctx = minimapRef.current.getContext("2d");
    if (!ctx) return;

    const renderer = rendererRef.current;
    if (!renderer) return;

    minimapRendererRef.current?.render(
      ctx,
      terrainGrid,
      settings,
      width,
      height,
      renderer.getCellColor.bind(renderer),
    );
  }, [terrainGrid, width, height, settings]);

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
        onContextMenu={(event) => event.preventDefault()}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white">Loading viewport...</div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 border-2 border-gold rounded-lg shadow-lg bg-black/50 backdrop-blur-sm">
        <canvas
          ref={minimapRef}
          width={150}
          height={150}
          className="rounded-lg"
        />
      </div>

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
              River:{" "}
              <span className="font-medium text-blue-300">
                🌊 {hoveredCell.cell.river_name}
              </span>
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
