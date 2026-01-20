import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { storage } from "./storage";

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

const app = express();

// CORS middleware for separate frontend deployment
app.use((req, res, next) => {
  const allowedOrigins = [
    "http://localhost:3000",  // Next.js dev server
    "http://localhost:3001",  // Alternative Next.js port
    process.env.FRONTEND_URL, // Production frontend URL
  ].filter(Boolean);

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }

  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set up periodic task
export const INTERVAL = 1000 * 60; // 60 second in milliseconds (update interval)
let intervalId: NodeJS.Timeout;

function startPeriodicTask() {
  // Clear any existing interval
  if (intervalId) {
    clearInterval(intervalId);
  }

  // Set up new interval
  intervalId = setInterval(async () => {
    try {
      log("Running periodic terrain update");
      storage.landUpdate();
    } catch (error) {
      console.error("Error in periodic task:", error);
    }
  }, INTERVAL);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      // log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Start periodic task after server is ready
  startPeriodicTask();

  const PORT = 5001;
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();
