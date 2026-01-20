import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { INTERVAL } from "./index";
import { VIEWPORT_CONFIG } from "./config";
import type { TerrainCell, TerrainGrid } from "./schema";

function extractViewport(
  terrain: TerrainGrid,
  x: number,
  y: number,
  width: number,
  height: number,
): TerrainCell[][] {
  const gridSize = terrain.length;
  const viewport: TerrainCell[][] = [];

  for (let dy = 0; dy < height; dy += 1) {
    const row: TerrainCell[] = [];
    for (let dx = 0; dx < width; dx += 1) {
      const wrappedX = ((x + dx) % gridSize + gridSize) % gridSize;
      const wrappedY = ((y + dy) % gridSize + gridSize) % gridSize;
      row.push(terrain[wrappedY][wrappedX]);
    }
    viewport.push(row);
  }

  return viewport;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Generate initial terrain
  await storage.generateTerrain();

  app.get("/api/terrain", async (req, res) => {
    try {
      const terrain = await storage.getTerrainData();

      res.json(terrain);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch terrain data" });
    }
  });

  app.get("/api/time", async (req, res) => {
    try {
      const gameTime = storage.getGameTime();
      res.json(gameTime);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch game time" });
    }
  });

  app.get("/api/weather-stats", async (req, res) => {
    try {
      const metrics = storage.getSimulationEngine().getWeatherMetrics();
      const latest = metrics.getLatest();
      const history = metrics.getHistory();

      res.json({
        current: latest,
        history: history.slice(-20),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get weather stats" });
    }
  });

  app.get("/api/viewport", async (req, res) => {
    try {
      const x = Number(req.query.x);
      const y = Number(req.query.y);
      const width = Number(req.query.width);
      const height = Number(req.query.height);

      if (![x, y, width, height].every((value) => Number.isFinite(value))) {
        res.status(400).json({ error: "Invalid viewport parameters" });
        return;
      }

      if (width < 1 || height < 1) {
        res.status(400).json({ error: "Viewport dimensions must be positive" });
        return;
      }

      const clampedWidth = Math.max(
        1,
        Math.min(Math.floor(width), VIEWPORT_CONFIG.MAX_VIEWPORT_SIZE),
      );
      const clampedHeight = Math.max(
        1,
        Math.min(Math.floor(height), VIEWPORT_CONFIG.MAX_VIEWPORT_SIZE),
      );

      const terrain = await storage.getTerrainData();
      const viewport = extractViewport(
        terrain,
        Math.floor(x),
        Math.floor(y),
        clampedWidth,
        clampedHeight,
      );

      res.json({
        viewport,
        worldSize: terrain.length,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch viewport" });
    }
  });

  app.get("/api/minimap", async (req, res) => {
    try {
      const resolutionParam = req.query.resolution;
      const requestedResolution = resolutionParam === undefined
        ? VIEWPORT_CONFIG.DEFAULT_MINIMAP_RES
        : Number(resolutionParam);

      if (!Number.isFinite(requestedResolution) || requestedResolution < 1) {
        res.status(400).json({ error: "Invalid minimap resolution" });
        return;
      }

      const worldSize = storage.getWorldSize();
      const clampedResolution = Math.max(
        1,
        Math.min(Math.floor(requestedResolution), worldSize),
      );
      const minimap = storage.getMinimapData(clampedResolution);

      res.json({
        minimap,
        resolution: clampedResolution,
        worldSize,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch minimap" });
    }
  });

  app.get("/api/config", async (req, res) => {
    try {
      res.json({
        updateInterval: INTERVAL, // Backend update interval in milliseconds
        worldSize: storage.getWorldSize(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
