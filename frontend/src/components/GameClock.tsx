import { useQuery } from "@tanstack/react-query";
import { type GameTime } from "@/shared/schema";
import { Card, CardContent } from "@/components/card";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

interface BackendConfig {
  updateInterval: number;
}

export function GameClock() {
  const [minuteRotation, setMinuteRotation] = useState(0);
  const [hourRotation, setHourRotation] = useState(0);

  // Fetch backend configuration to get the update interval
  const { data: config } = useQuery<BackendConfig>({
    queryKey: ["/api/config"],
    staleTime: Infinity, // Config doesn't change, fetch once
  });

  const tickInterval = config?.updateInterval ?? 1000; // Default to 1 second if not loaded

  const { data: gameTime } = useQuery<GameTime>({
    queryKey: ["/api/time"],
    refetchInterval: tickInterval,
  });

  // Animate minute hand to complete a full rotation over each tick interval
  useEffect(() => {
    if (!gameTime) return;

    // Get the current rotation value
    const startRotationValue = minuteRotation;

    // Target is to complete a full 360-degree rotation during this tick
    const delta = 360;

    // Calculate hour hand position (30 degrees per hour + 0.5 degrees per minute)
    const newHourRotation = (gameTime.hour % 12) * 30 + gameTime.minute * 0.5;
    setHourRotation(newHourRotation);

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / tickInterval, 1);

      // Linear progress for smooth constant rotation
      const rotation = startRotationValue + (delta * progress);

      setMinuteRotation(rotation);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [gameTime?.hour, gameTime?.minute, tickInterval]);

  if (!gameTime) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Loading time...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full" data-testid="card-game-clock">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Time Display */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {gameTime.is_day ? (
                  <Sun className="h-5 w-5 text-yellow-500" data-testid="icon-sun" />
                ) : (
                  <Moon className="h-5 w-5 text-blue-400" data-testid="icon-moon" />
                )}
                <span className="text-lg font-semibold" data-testid="text-time">
                  {String(gameTime.hour).padStart(2, "0")}:
                  {String(gameTime.minute).padStart(2, "0")}
                </span>
              </div>
              <div className="text-sm text-muted-foreground" data-testid="text-date">
                {gameTime.month_name} {gameTime.day}, Year {gameTime.year}
              </div>
              <div className="text-xs text-muted-foreground" data-testid="text-daylight-info">
                {gameTime.daylight_hours} hours of daylight
              </div>
            </div>

            {/* Analog Clock */}
            <div className="relative" data-testid="analog-clock">
              <svg
                width="80"
                height="80"
                viewBox="0 0 100 100"
                className="transform"
              >
                {/* Clock face */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted-foreground"
                />

                {/* Hour markers */}
                {[...Array(12)].map((_, i) => {
                  const angle = (i * 30 - 90) * (Math.PI / 180);
                  const x1 = 50 + 38 * Math.cos(angle);
                  const y1 = 50 + 38 * Math.sin(angle);
                  const x2 = 50 + 42 * Math.cos(angle);
                  const y2 = 50 + 42 * Math.sin(angle);
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-muted-foreground"
                    />
                  );
                })}

                {/* Hour hand */}
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="25"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="text-foreground"
                  style={{
                    transformOrigin: "50px 50px",
                    transform: `rotate(${hourRotation}deg)`,
                  }}
                  data-testid="clock-hour-hand"
                />

                {/* Minute hand (animated) */}
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="text-primary"
                  style={{
                    transformOrigin: "50px 50px",
                    transform: `rotate(${minuteRotation}deg)`,
                    transition: "none", // Handled by manual animation
                  }}
                  data-testid="clock-minute-hand"
                />

                {/* Center dot */}
                <circle
                  cx="50"
                  cy="50"
                  r="3"
                  fill="currentColor"
                  className="text-foreground"
                />
              </svg>
            </div>
          </div>

          {/* Day/Night Status */}
          <div className="flex items-center justify-center">
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium ${gameTime.is_day
                ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
                : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                }`}
              data-testid="badge-day-night-status"
            >
              {gameTime.is_day ? "Daytime" : "Nighttime"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
