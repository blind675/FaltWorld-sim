import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Generate initial terrain
  await storage.generateTerrain();

  app.get('/api/terrain', async (req, res) => {
    try {
      const terrain = await storage.getTerrainData();
      res.json(terrain);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch terrain data" });
    }
  });

  app.post('/api/terrain/generate', async (req, res) => {
    try {
      const terrain = await storage.generateTerrain();
      res.json(terrain);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate terrain" });
    }
  });

  app.get('/api/terrain/update', async (req, res) => {
    try {
      const terrain = await storage.landUpdate();
      res.json(terrain);
    } catch (error) {
      res.status(500).json({ error: "Failed to update terrain" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
