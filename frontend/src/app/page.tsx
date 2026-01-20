"use client";

import { useEffect, useState } from "react";
import Home from "@/components/Home";
import { ViewportManager } from "@/lib/viewportManager";
import { getApiUrl } from "@/lib/api";

export default function Page() {
    const [viewportManager] = useState(() => new ViewportManager(2000));
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Fetch initial config to get worldSize
        fetch(`${getApiUrl()}/api/config`)
            .then((res) => res.json())
            .then((data: { worldSize?: number; updateInterval?: number }) => {
                if (data.worldSize) {
                    viewportManager.setWorldSize(data.worldSize);
                }
                setIsReady(true);
            })
            .catch(() => {
                setIsReady(true);
            });
    }, [viewportManager]);

    useEffect(() => {
        const updateInterval = 1000 * 30;
        const interval = window.setInterval(() => {
            viewportManager.invalidateCache();
        }, updateInterval);

        return () => window.clearInterval(interval);
    }, [viewportManager]);

    if (!isReady) {
        return (
            <div className="flex items-center justify-center h-screen">
                Loading...
            </div>
        );
    }

    return <Home viewportManager={viewportManager} />;
}
