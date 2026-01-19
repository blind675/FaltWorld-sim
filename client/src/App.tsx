import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import { ViewportManager } from "@/lib/viewportManager";

function Router({ viewportManager }: { viewportManager: ViewportManager }) {
  return (
    <Switch>
      <Route path="/" component={() => <Home viewportManager={viewportManager} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [viewportManager] = useState(() => new ViewportManager(1000));

  useEffect(() => {
    const updateInterval = 1000 * 30;
    const interval = window.setInterval(() => {
      viewportManager.invalidateCache();
    }, updateInterval);

    return () => window.clearInterval(interval);
  }, [viewportManager]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router viewportManager={viewportManager} />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
