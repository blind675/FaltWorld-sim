import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { TerrainCanvas } from '@/components/TerrainCanvas';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const { data: terrain, isLoading, refetch } = useQuery({
    queryKey: ['/api/terrain'],
  });

  const handleRegenerate = async () => {
    await apiRequest('POST', '/api/terrain/generate');
    refetch();
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
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Button onClick={handleRegenerate}>
              Regenerate Terrain
            </Button>
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
