import { useQuery } from "@tanstack/react-query";
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
import { type TerrainGrid, type TerrainCell } from "@shared/schema";
import {
  RefreshCw,
  Eye,
  Droplets,
  Mountain,
  Grid,
  MapPin,
  Thermometer,
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

// Define CellInfo type for selected cell
type CellInfo = {
  cell: TerrainCell;
  x: number;
  y: number;
  screenX: number;
  screenY: number;
};

export default function Home() {
  const [refreshInterval, setRefreshInterval] = useState(15); // 15 seconds to match server interval
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(refreshInterval);
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null);

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
    });

  const {
    data: terrain,
    isLoading,
    refetch,
  } = useQuery<TerrainGrid>({
    queryKey: ["/api/terrain"],
    // Don't refetch automatically on window focus as we're managing it manually
    refetchOnWindowFocus: false,
  });

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    // Manually fetch new data from backend
    await refetch();

    // Reset timers
    setLastRefresh(new Date());
    setTimeUntilRefresh(refreshInterval);

    console.log("Map manually refreshed");
  }, [refetch, refreshInterval]);

  // Auto-refresh timer
  useEffect(() => {
    const timer = setInterval(async () => {
      // Need to manually call API for terrain update
      try {
        await refetch();
        setLastRefresh(new Date());
        setTimeUntilRefresh(refreshInterval);
      } catch (error) {
        console.error("Error during auto-refresh:", error);
      }
    }, refreshInterval * 1000);

    return () => clearInterval(timer);
  }, [refetch, refreshInterval]);

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

      // Fetch the new terrain data to update the UI
      await refetch();

      // Reset timers
      setLastRefresh(new Date());
      setTimeUntilRefresh(refreshInterval);

      console.log("Terrain regenerated successfully");
    } catch (error) {
      console.error("Error regenerating terrain:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">Loading terrain...</div>
      </div>
    );
  }

  // a funtion to find all the river and spring terren types and log them
  const findRiversAndSprings = (terrain?: TerrainGrid) => {
    if (!terrain) return;
    const riversAndSprings = terrain
      .flat()
      .filter((cell) => cell.type === "river" || cell.type === "spring");

    console.log(`found ${riversAndSprings.length} rivers and springs`);
  };

  findRiversAndSprings(terrain);

  return (
    <div className="container mx-auto p-4 min-h-screen">
      <div className="flex flex-row gap-4">
        {/* Terrain Canvas */}
        <div className="flex-shrink-0">
          {terrain && (
            <TerrainCanvas
              terrain={terrain}
              width={800}
              height={800}
              onCellSelect={setSelectedCell}
              visualizationSettings={visualizationSettings}
            />
          )}
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
                                | "temperature",
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
