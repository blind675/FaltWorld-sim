import { Button } from "@/components/ui/button";
import {
  TerrainCanvas,
  VisualizationSettings,
} from "@/components/TerrainCanvas";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useEffect, useState, useCallback } from "react";
import { type TerrainCell } from "@shared/schema";
import { ViewportManager } from "@/lib/viewportManager";
import {
  RefreshCw,
  Eye,
  Droplets,
  Mountain,
  Grid,
  MapPin,
  Thermometer,
  Wind,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { GameClock } from "@/components/GameClock";

// Define CellInfo type for selected cell
type CellInfo = {
  cell: TerrainCell;
  x: number;
  y: number;
  screenX: number;
  screenY: number;
};

type HomeProps = {
  viewportManager: ViewportManager;
};

export default function Home({ viewportManager }: HomeProps) {
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(refreshInterval);
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [terrain, setTerrain] = useState<any>(null);

  // Canvas dimensions
  const canvasWidth = 800;
  const canvasHeight = 800;

  // Calculate zoom levels to show 20x20 (max zoom) to 100x100 (min zoom) cells
  const worldSize = 1000;
  const minCellsVisible = 20;  // max zoom shows 20x20 cells
  const maxCellsVisible = 100; // min zoom shows 100x100 cells
  const maxZoom = (canvasWidth / worldSize) * (worldSize / minCellsVisible);  // 40
  const minZoom = (canvasWidth / worldSize) * (worldSize / maxCellsVisible);  // 8

  // Logarithmic zoom conversion for smooth feel across the range
  // Slider value is 0-1, convert to/from actual zoom level using log scale
  const sliderToZoom = (sliderValue: number): number => {
    // Use exponential interpolation: zoom = minZoom * (maxZoom/minZoom)^sliderValue
    return minZoom * Math.pow(maxZoom / minZoom, sliderValue);
  };
  const zoomToSlider = (zoomLevel: number): number => {
    // Inverse: sliderValue = log(zoom/minZoom) / log(maxZoom/minZoom)
    return Math.log(zoomLevel / minZoom) / Math.log(maxZoom / minZoom);
  };
  const defaultZoom = sliderToZoom(0.5); // Start at middle of log scale (~50x50 cells)

  // Visualization settings state
  const [visualizationSettings, setVisualizationSettings] =
    useState<VisualizationSettings>({
      showRivers: true,
      showMoisture: true,
      showElevation: true,
      exaggerateHeight: 1.0,
      contourLines: false,
      contourInterval: 100,
      colorMode: "default",
      wireframe: false,
      zoomLevel: defaultZoom, // Start at middle of log scale (~50x50 cells)
      panOffset: { x: 0, y: 0 },
    });

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await apiRequest("GET", "/api/config");
        const data = (await response.json()) as { updateInterval?: number };
        if (data.updateInterval) {
          const intervalSeconds = Math.max(
            1,
            Math.round(data.updateInterval / 1000),
          );
          setRefreshInterval(intervalSeconds);
          setTimeUntilRefresh(intervalSeconds);
        }
      } catch (error) {
        console.error("Failed to load config", error);
      }
    };

    void loadConfig();
  }, []);

  // Fetch terrain data (full grid for now - viewport chunking needs more work)
  useEffect(() => {
    const fetchTerrain = async () => {
      try {
        const response = await apiRequest("GET", "/api/terrain");
        const data = await response.json();
        setTerrain(data);
      } catch (error) {
        console.error("Failed to fetch terrain", error);
      }
    };

    void fetchTerrain();
  }, [refreshToken]);

  useEffect(() => {
    setTimeUntilRefresh(refreshInterval);
  }, [refreshInterval]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(() => {
    viewportManager.invalidateCache();
    setRefreshToken((token) => token + 1);

    setLastRefresh(new Date());
    setTimeUntilRefresh(refreshInterval);

    console.log("Map manually refreshed");
  }, [viewportManager, refreshInterval]);

  // Auto-refresh timer
  useEffect(() => {
    const timer = setInterval(() => {
      viewportManager.invalidateCache();
      setRefreshToken((token) => token + 1);
      setLastRefresh(new Date());
      setTimeUntilRefresh(refreshInterval);
    }, refreshInterval * 1000);

    return () => clearInterval(timer);
  }, [viewportManager, refreshInterval]);

  // Countdown timer
  useEffect(() => {
    if (lastRefresh === null) {
      setLastRefresh(new Date());
      return;
    }

    const countdownTimer = setInterval(() => {
      const elapsedTime = Math.floor(
        (new Date().getTime() - lastRefresh.getTime()) / 1000,
      );
      const remaining = Math.max(0, refreshInterval - elapsedTime);
      setTimeUntilRefresh(remaining);
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, [lastRefresh, refreshInterval]);

  const handleRegenerate = async () => {
    try {
      // Generate new terrain on the backend
      await apiRequest("POST", "/api/terrain/generate");

      viewportManager.invalidateCache();
      setRefreshToken((token) => token + 1);

      // Reset timers
      setLastRefresh(new Date());
      setTimeUntilRefresh(refreshInterval);

      console.log("Terrain regenerated successfully");
    } catch (error) {
      console.error("Error regenerating terrain:", error);
    }
  };

  return (
    <div className="container mx-auto p-4 min-h-screen">
      <div className="flex flex-row gap-4">
        {/* Terrain Canvas */}
        <div className="flex-shrink-0">
          <TerrainCanvas
            terrain={terrain}
            width={canvasWidth}
            height={canvasHeight}
            onCellSelect={setSelectedCell}
            visualizationSettings={visualizationSettings}
            onVisualizationSettingsChange={(settings) => {
              setVisualizationSettings({
                ...visualizationSettings,
                ...settings,
              });
            }}
          />
        </div>

        {/* Controls and Info */}
        <Card className="flex-grow">
          <CardHeader>
            <CardTitle>Terrain Visualization</CardTitle>
            <CardDescription>
              Next refresh in {timeUntilRefresh} seconds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {/* Game Clock */}
              <GameClock />
              <div className="flex items-center gap-4">
                <Button onClick={handleRegenerate}>Regenerate Terrain</Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      // First trigger a landUpdate on the server
                      await apiRequest("GET", "/api/terrain/update");
                      // Then refresh the UI data
                      await handleManualRefresh();
                    } catch (error) {
                      console.error("Error refreshing map:", error);
                    }
                  }}
                  title="Manually refresh terrain data"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Map
                </Button>
                <div className="text-sm text-muted-foreground">
                  Auto-refresh every {refreshInterval} seconds
                </div>
              </div>

              {/* Selected Cell Information */}
              {selectedCell && (
                <div className="mt-4 p-4 border border-gold rounded-lg bg-background/50">
                  <h3 className="text-lg font-medium mb-2 text-gold">
                    Selected Cell Information
                  </h3>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <div className="font-semibold">Position:</div>
                    <div>
                      ({selectedCell.x}, {selectedCell.y})
                    </div>

                    <div className="font-semibold">Type:</div>
                    <div className="capitalize">{selectedCell.cell.type}</div>

                    {selectedCell.cell.river_name && (
                      <>
                        <div className="font-semibold">River Name:</div>
                        <div className="text-blue-500">🌊 {selectedCell.cell.river_name}</div>
                      </>
                    )}

                    <div className="font-semibold">Altitude:</div>
                    <div>{selectedCell.cell.altitude.toFixed(2)}</div>

                    <div className="font-semibold">Terrain Height:</div>
                    <div>{selectedCell.cell.terrain_height.toFixed(2)}</div>

                    <div className="font-semibold">Water Height:</div>
                    <div>{selectedCell.cell.water_height.toFixed(2)}</div>

                    <div className="font-semibold">Base Moisture:</div>
                    <div>{selectedCell.cell.base_moisture.toFixed(2)}</div>

                    <div className="font-semibold">Moisture:</div>
                    <div>{selectedCell.cell.moisture.toFixed(2)}</div>

                    <div className="font-semibold flex items-center gap-1">
                      <Thermometer className="h-4 w-4" />
                      Temperature:
                    </div>
                    <div>{selectedCell.cell.temperature.toFixed(1)}°C</div>

                    <div className="font-semibold flex items-center gap-1">
                      <Droplets className="h-4 w-4" />
                      Air Humidity:
                    </div>
                    <div>{(selectedCell.cell.air_humidity * 100).toFixed(1)}%</div>

                    <div className="font-semibold flex items-center gap-1">
                      <Wind className="h-4 w-4" />
                      Wind:
                    </div>
                    <div>
                      {selectedCell.cell.wind_speed != null
                        ? `${selectedCell.cell.wind_speed.toFixed(1)} m/s @ ${selectedCell.cell.wind_direction?.toFixed(0)}°`
                        : "N/A"}
                    </div>
                  </div>
                </div>
              )}

              {/* Visualization Settings */}
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-4">
                  Visualization Settings
                </h3>

                <Tabs defaultValue="display-mode">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="display-mode">Display Mode</TabsTrigger>
                    <TabsTrigger value="features">Features</TabsTrigger>
                  </TabsList>

                  <TabsContent value="display-mode" className="space-y-4">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Color Mode</h4>
                        <Select
                          defaultValue={visualizationSettings.colorMode}
                          onValueChange={(value) => {
                            setVisualizationSettings({
                              ...visualizationSettings,
                              colorMode: value as
                                | "default"
                                | "heightmap"
                                | "moisture"
                                | "temperature"
                                | "humidity"
                                | "wind",
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select color mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="heightmap">Heightmap</SelectItem>
                            <SelectItem value="moisture">Moisture</SelectItem>
                            <SelectItem value="temperature">
                              Temperature
                            </SelectItem>
                            <SelectItem value="humidity">
                              Humidity
                            </SelectItem>
                            <SelectItem value="wind">
                              Wind
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label
                            htmlFor="height-exaggeration"
                            className="text-sm font-medium"
                          >
                            <Mountain className="h-4 w-4 inline-block mr-1" />
                            Height Exaggeration:{" "}
                            {visualizationSettings.exaggerateHeight.toFixed(1)}x
                          </Label>
                        </div>
                        <Slider
                          id="height-exaggeration"
                          min={0.5}
                          max={3}
                          step={0.1}
                          defaultValue={[
                            visualizationSettings.exaggerateHeight,
                          ]}
                          onValueChange={(value) => {
                            setVisualizationSettings({
                              ...visualizationSettings,
                              exaggerateHeight: value[0],
                            });
                          }}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor="wireframe-toggle"
                            className="cursor-pointer"
                          >
                            <Grid className="h-4 w-4 inline-block mr-1" />
                            Show Wireframe
                          </Label>
                          <Switch
                            id="wireframe-toggle"
                            checked={visualizationSettings.wireframe}
                            onCheckedChange={(checked) => {
                              setVisualizationSettings({
                                ...visualizationSettings,
                                wireframe: checked,
                              });
                            }}
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Map Navigation Controls */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium mb-2">Map Navigation</h4>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label
                              htmlFor="zoom-level"
                              className="text-sm font-medium"
                            >
                              <svg className="h-4 w-4 inline-block mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                <line x1="11" y1="8" x2="11" y2="14"></line>
                                <line x1="8" y1="11" x2="14" y2="11"></line>
                              </svg>
                              Zoom: {Math.round((canvasWidth / worldSize) * (worldSize / visualizationSettings.zoomLevel))}x{Math.round((canvasHeight / worldSize) * (worldSize / visualizationSettings.zoomLevel))} cells
                            </Label>
                          </div>
                          <Slider
                            id="zoom-level"
                            min={0}
                            max={1}
                            step={0.01}
                            value={[zoomToSlider(visualizationSettings.zoomLevel)]}
                            onValueChange={(value) => {
                              setVisualizationSettings({
                                ...visualizationSettings,
                                zoomLevel: sliderToZoom(value[0]),
                              });
                            }}
                          />
                        </div>

                        <div className="text-sm text-muted-foreground mt-1">
                          <p>Use the slider above to zoom and pan with middle/right click drag.</p>
                          <p className="mt-1">Zoom range: {minCellsVisible}x{minCellsVisible} to {maxCellsVisible}x{maxCellsVisible} cells</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              setVisualizationSettings({
                                ...visualizationSettings,
                                zoomLevel: defaultZoom,
                                panOffset: { x: 0, y: 0 }
                              });
                            }}
                          >
                            Reset View
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="features" className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="rivers-toggle"
                          className="cursor-pointer"
                        >
                          <Droplets className="h-4 w-4 inline-block mr-1" />
                          Show Rivers
                        </Label>
                        <Switch
                          id="rivers-toggle"
                          defaultChecked={visualizationSettings.showRivers}
                          onCheckedChange={(checked) => {
                            setVisualizationSettings({
                              ...visualizationSettings,
                              showRivers: checked,
                            });
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="moisture-toggle"
                          className="cursor-pointer"
                        >
                          <Droplets className="h-4 w-4 inline-block mr-1" />
                          Show Moisture (Mud & Earth)
                        </Label>
                        <Switch
                          id="moisture-toggle"
                          defaultChecked={visualizationSettings.showMoisture}
                          onCheckedChange={(checked) => {
                            setVisualizationSettings({
                              ...visualizationSettings,
                              showMoisture: checked,
                            });
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="elevation-toggle"
                          className="cursor-pointer"
                        >
                          <Mountain className="h-4 w-4 inline-block mr-1" />
                          Show Elevation
                        </Label>
                        <Switch
                          id="elevation-toggle"
                          defaultChecked={visualizationSettings.showElevation}
                          onCheckedChange={(checked) => {
                            setVisualizationSettings({
                              ...visualizationSettings,
                              showElevation: checked,
                            });
                          }}
                        />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="contours-toggle"
                          className="cursor-pointer"
                        >
                          <MapPin className="h-4 w-4 inline-block mr-1" />
                          Show Contour Lines
                        </Label>
                        <Switch
                          id="contours-toggle"
                          checked={visualizationSettings.contourLines}
                          onCheckedChange={(checked) => {
                            setVisualizationSettings({
                              ...visualizationSettings,
                              contourLines: checked,
                            });
                          }}
                        />
                      </div>

                      {visualizationSettings.contourLines && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label
                              htmlFor="contour-interval"
                              className="text-sm font-medium"
                            >
                              Contour Interval:{" "}
                              {visualizationSettings.contourInterval}
                            </Label>
                          </div>
                          <Slider
                            id="contour-interval"
                            min={25}
                            max={250}
                            step={25}
                            defaultValue={[
                              visualizationSettings.contourInterval,
                            ]}
                            onValueChange={(value) => {
                              setVisualizationSettings({
                                ...visualizationSettings,
                                contourInterval: value[0],
                              });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Map Legend</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[rgb(0,0,255)]"></div>
                    <span>Spring</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[rgb(0,128,255)]"></div>
                    <span>River (Low Water)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[rgb(0,64,192)]"></div>
                    <span>River (High Water)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[rgb(102,51,0)]"></div>
                    <span>Mud (High Moisture)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[rgb(153,102,51)]"></div>
                    <span>Earth (Medium Moisture)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[rgb(0,0,0)]"></div>
                    <span>High Elevation (Rock)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[rgb(255,255,255)]"></div>
                    <span>Low Elevation (Rock)</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
