import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { type VisualizationSettings } from "../canvas/types";

interface UseCanvasPanOptions {
  settings: VisualizationSettings;
  onVisualizationSettingsChange?: (settings: Partial<VisualizationSettings>) => void;
}

interface UseCanvasPanResult {
  isPanning: boolean;
  handleMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void;
}

export const useCanvasPan = ({
  settings,
  onVisualizationSettingsChange,
}: UseCanvasPanOptions): UseCanvasPanResult => {
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPosition, setLastPanPosition] = useState({ x: 0, y: 0 });
  const panAccumulatorRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (event.button === 1 || event.button === 2) {
        event.preventDefault();
        setIsPanning(true);
        setLastPanPosition({ x: event.clientX, y: event.clientY });
        panAccumulatorRef.current = { x: 0, y: 0 };
      }
    },
    [],
  );

  useEffect(() => {
    const handlePanMove = (event: MouseEvent) => {
      if (!isPanning) return;

      const dx = event.clientX - lastPanPosition.x;
      const dy = event.clientY - lastPanPosition.y;

      panAccumulatorRef.current.x += dx;
      panAccumulatorRef.current.y += dy;

      setLastPanPosition({ x: event.clientX, y: event.clientY });

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          const currentPan = settings.panOffset || { x: 0, y: 0 };
          const newPan = {
            x: currentPan.x + panAccumulatorRef.current.x,
            y: currentPan.y + panAccumulatorRef.current.y,
          };

          panAccumulatorRef.current = { x: 0, y: 0 };
          rafIdRef.current = null;

          onVisualizationSettingsChange?.({
            ...settings,
            panOffset: newPan,
          });
        });
      }
    };

    if (isPanning) {
      window.addEventListener("mousemove", handlePanMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handlePanMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseUp, isPanning, lastPanPosition, onVisualizationSettingsChange, settings]);

  return {
    isPanning,
    handleMouseDown,
  };
};
