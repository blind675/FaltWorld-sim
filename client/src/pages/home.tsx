import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { TerrainCanvas } from '@/components/TerrainCanvas';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { type TerrainGrid } from '@shared/schema';

export default function Home() {
  const [refreshInterval, setRefreshInterval] = useState(15); // 15 seconds
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(refreshInterval);
  
  const { data: terrain, isLoading, refetch } = useQuery<TerrainGrid>({
    queryKey: ['/api/terrain'],
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
      const elapsedTime = Math.floor((new Date().getTime() - lastRefresh.getTime()) / 1000);
      const remaining = Math.max(0, refreshInterval - elapsedTime);
      setTimeUntilRefresh(remaining);
    }, 1000);
    
    return () => clearInterval(countdownTimer);
  }, [lastRefresh, refreshInterval]);

  const handleRegenerate = async () => {
    await apiRequest('POST', '/api/terrain/generate');
    refetch();
    setLastRefresh(new Date());
    setTimeUntilRefresh(refreshInterval);
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
      <Card>
        <CardHeader>
          <CardTitle>Terrain Visualization</CardTitle>
          <CardDescription>
            Next refresh in {timeUntilRefresh} seconds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Button onClick={handleRegenerate}>
                Regenerate Terrain
              </Button>
              <div className="text-sm text-muted-foreground">
                Auto-refresh every {refreshInterval} seconds
              </div>
            </div>
            
            {terrain && (
              <TerrainCanvas
                terrain={terrain}
                width={800}
                height={800}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
