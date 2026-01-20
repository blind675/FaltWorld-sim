import { useEffect, useRef, useState, useCallback } from "react";
import { type TerrainCell, type TerrainGrid } from "@/shared/schema";
import { ViewportManager } from "@/lib/viewportManager";
import { CanvasRenderer } from "./canvas/CanvasRenderer";
import { MinimapRenderer } from "./canvas/MinimapRenderer";
import { type CellInfo, type VisualizationSettings } from "./canvas/types";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";

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
  const [minimapData, setMinimapData] = useState<TerrainCell[][] | null>(null);
  const minimapFetchedRef = useRef(false);

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
    showClouds: false,
    showPrecipitation: false,
    exaggerateHeight: 1.0,
    contourLines: false,
    contourInterval: 100,
    colorMode: "default",
    wireframe: false,
    zoomLevel: 100 / 45, // Show 45x45 cells initially
    panOffset: { x: 0, y: 0 },
  };

  const settings: VisualizationSettings = {
    ...defaultSettings,
    ...visualizationSettings,
  };

  const terrainGrid = terrain ?? renderTerrain;


  useEffect(() => {
    if (terrain) {
      setRenderTerrain(terrain);
      setWorldSize(terrain.length);
    }
  }, [terrain]);

  // Fetch fixed 100x100 viewport on mount and refresh
  useEffect(() => {
    if (!viewportManager || terrain) {
      return;
    }

    setIsLoading(true);

    viewportManager
      .getViewportData()
      .then((viewport) => {
        const nextWorldSize = viewportManager.getWorldSize();
        setWorldSize(nextWorldSize);
        setRenderTerrain(viewport);
      })
      .catch((error: Error) => {
        console.error("Failed to load viewport data", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [viewportManager, terrain, refreshToken]);

  // Fetch minimap data separately at a lower interval
  useEffect(() => {
    if (terrain) {
      // If full terrain is provided, use it for minimap
      setMinimapData(terrain);
      return;
    }

    const fetchMinimap = async () => {
      if (!viewportManager) return;

      try {
        const data = await viewportManager.getMinimapData(150);
        if (data.minimap) {
          setMinimapData(data.minimap);
        }
        if (data.worldSize) {
          setWorldSize(data.worldSize);
        }
      } catch (error) {
        console.error("Failed to fetch minimap data", error);
      }
    };

    // Initial fetch
    if (!minimapFetchedRef.current) {
      minimapFetchedRef.current = true;
      void fetchMinimap();
    }

    // Refresh minimap every 5 minutes
    const minimapInterval = window.setInterval(() => {
      void fetchMinimap();
    }, 5 * 60 * 1000);

    return () => window.clearInterval(minimapInterval);
  }, [terrain, refreshToken]);

  const { hoveredCell, selectedCell, mousePosition, handleMouseMove, handleMouseLeave, handleClick } =
    useCanvasInteraction({
      canvasRef,
      terrainGrid,
      width,
      height,
      settings,
      onCellSelect,
    });

  // Move viewport and fetch new data
  const moveViewport = useCallback((deltaX: number, deltaY: number) => {
    if (!viewportManager) return;

    const VIEWPORT_SIZE = 100;
    const currentPos = viewportManager.getViewportPosition();

    // Calculate new position with wrapping for circular world
    let newViewportX = currentPos.x + deltaX;
    let newViewportY = currentPos.y + deltaY;

    // The valid range for viewport position is [0, worldSize - VIEWPORT_SIZE]
    // because the viewport is VIEWPORT_SIZE cells wide/tall
    const maxViewportPos = worldSize - VIEWPORT_SIZE;

    // Wrap X coordinate (circular horizontally)
    if (newViewportX < 0) {
      // Moving left past 0, wrap to the right side
      newViewportX = maxViewportPos + (newViewportX % maxViewportPos);
      if (newViewportX < 0) newViewportX += maxViewportPos;
    } else if (newViewportX > maxViewportPos) {
      // Moving right past max, wrap to the left side
      newViewportX = newViewportX % (maxViewportPos + 1);
    }

    // Wrap Y coordinate (circular vertically)
    if (newViewportY < 0) {
      // Moving up past 0, wrap to the bottom
      newViewportY = maxViewportPos + (newViewportY % maxViewportPos);
      if (newViewportY < 0) newViewportY += maxViewportPos;
    } else if (newViewportY > maxViewportPos) {
      // Moving down past max, wrap to the top
      newViewportY = newViewportY % (maxViewportPos + 1);
    }

    // Update viewport position and fetch new data
    viewportManager.setViewportPosition(newViewportX, newViewportY);
    viewportManager.invalidateCache();

    // Trigger re-fetch by updating state
    setIsLoading(true);
    viewportManager
      .getViewportData()
      .then((viewport) => {
        const nextWorldSize = viewportManager.getWorldSize();
        setWorldSize(nextWorldSize);
        setRenderTerrain(viewport);
      })
      .catch((error: Error) => {
        console.error("Failed to load viewport data", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [viewportManager, worldSize]);

  // Handle minimap click to move viewport
  const handleMinimapClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!minimapRef.current || !viewportManager) return;

    const rect = minimapRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const MINIMAP_SIZE = 150;
    const VIEWPORT_SIZE = 100;

    // Convert minimap click to world coordinates
    const worldX = Math.floor((clickX / MINIMAP_SIZE) * worldSize);
    const worldY = Math.floor((clickY / MINIMAP_SIZE) * worldSize);

    // Center the viewport on the clicked position
    const currentPos = viewportManager.getViewportPosition();
    const deltaX = worldX - VIEWPORT_SIZE / 2 - currentPos.x;
    const deltaY = worldY - VIEWPORT_SIZE / 2 - currentPos.y;

    moveViewport(deltaX, deltaY);
  }, [viewportManager, worldSize, moveViewport]);

  // Handle keyboard arrow keys for navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle arrow keys
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        return;
      }

      // Prevent default scrolling behavior
      event.preventDefault();

      const step = 10;
      switch (event.key) {
        case 'ArrowUp':
          moveViewport(0, -step);
          break;
        case 'ArrowDown':
          moveViewport(0, step);
          break;
        case 'ArrowLeft':
          moveViewport(-step, 0);
          break;
        case 'ArrowRight':
          moveViewport(step, 0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveViewport]);

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
      worldSize,
    );

    ctx.restore();
  }, [
    terrainGrid,
    width,
    height,
    hoveredCell,
    selectedCell,
    settings,
    worldSize,
  ]);

  useEffect(() => {
    if (!minimapRef.current || !minimapData?.length) return;

    const ctx = minimapRef.current.getContext("2d");
    if (!ctx) return;

    const renderer = rendererRef.current;
    if (!renderer) return;

    const viewportPos = viewportManager?.getViewportPosition() ?? { x: 0, y: 0 };

    minimapRendererRef.current?.render(
      ctx,
      minimapData,
      settings,
      width,
      height,
      renderer.getCellColor.bind(renderer),
      worldSize,
      viewportPos,
    );
  }, [minimapData, width, height, settings, worldSize, viewportManager]);

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
        onContextMenu={(event) => event.preventDefault()}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white">Loading viewport...</div>
        </div>
      )}

      {/* Navigation arrows */}
      <div className="absolute top-4 left-4 flex flex-col gap-1">
        <button
          onClick={() => moveViewport(0, -10)}
          className="bg-black/70 hover:bg-black/90 text-white p-2 rounded border border-gold/50 hover:border-gold transition-colors"
          title="Move Up"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
        <div className="flex gap-1">
          <button
            onClick={() => moveViewport(-10, 0)}
            className="bg-black/70 hover:bg-black/90 text-white p-2 rounded border border-gold/50 hover:border-gold transition-colors"
            title="Move Left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button
            onClick={() => moveViewport(0, 10)}
            className="bg-black/70 hover:bg-black/90 text-white p-2 rounded border border-gold/50 hover:border-gold transition-colors"
            title="Move Down"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <button
            onClick={() => moveViewport(10, 0)}
            className="bg-black/70 hover:bg-black/90 text-white p-2 rounded border border-gold/50 hover:border-gold transition-colors"
            title="Move Right"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 border-2 border-gold rounded-lg shadow-lg bg-black/50 backdrop-blur-sm">
        <canvas
          ref={minimapRef}
          width={150}
          height={150}
          className="rounded-lg cursor-pointer"
          onClick={handleMinimapClick}
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
          <div>
            Pressure:{" "}
            <span className="font-medium">
              {hoveredCell.cell.atmospheric_pressure?.toFixed(0) ?? "N/A"} hPa
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
