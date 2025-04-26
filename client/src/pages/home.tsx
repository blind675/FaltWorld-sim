import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { TerrainCanvas } from "@/components/TerrainCanvas";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useEffect, useState } from "react";
import { type TerrainGrid } from "@shared/schema";

export default function Home() {
  const [refreshInterval, setRefreshInterval] = useState(15); // 15 seconds
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(refreshInterval);

  const {
    data: terrain,
    isLoading,
    refetch,
  } = useQuery<TerrainGrid>({
    queryKey: ["/api/terrain"],
    // Don't refetch automatically on window focus as we're managing it manually
    refetchOnWindowFocus: false,
  });

  // Auto-refresh timer
  useEffect(() => {
    const timer = setInterval(() => {
      refetch();
      setLastRefresh(new Date());
      setTimeUntilRefresh(refreshInterval);
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

  return (
    <div className="container mx-auto p-4 min-h-screen">
      <div className="flex flex-row gap-4">
        {/* Terrain Canvas */}
        <div className="flex-shrink-0">
          {terrain && (
            <TerrainCanvas terrain={terrain} width={800} height={800} />
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
                <div className="text-sm text-muted-foreground">
                  Auto-refresh every {refreshInterval} seconds
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Map Information</h3>
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
