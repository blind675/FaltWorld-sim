import { useQuery } from "@tanstack/react-query";
import { type GameTime } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

const TICK_INTERVAL = 500; // Match server tick interval (500ms for debug)

export function GameClock() {
  const [minuteRotation, setMinuteRotation] = useState(0);
  const [hourRotation, setHourRotation] = useState(0);

  const { data: gameTime } = useQuery<GameTime>({
    queryKey: ["/api/time"],
    refetchInterval: TICK_INTERVAL,
  });

  // Animate minute hand smoothly over the tick interval
  useEffect(() => {
    if (!gameTime) return;

    // Normalize current rotation to [0, 360)
    const normalizedStart = ((minuteRotation % 360) + 360) % 360;
    
    // Target is 6 degrees per minute (360/60), always in [0, 360)
    const targetRotation = gameTime.minute * 6;
    
    // Calculate hour hand position (30 degrees per hour + 0.5 degrees per minute)
    const newHourRotation = (gameTime.hour % 12) * 30 + gameTime.minute * 0.5;
    setHourRotation(newHourRotation);

    // Calculate the forward delta (always move clockwise)
    let delta = targetRotation - normalizedStart;
    
    // If the delta is negative, we need to go forward through 360
    // For example: from 354° to 6° should be +12° not -348°
    if (delta < 0) {
      delta += 360;
    }
    
    // Always move forward (clockwise) - never go backwards even for large jumps

    const startTime = Date.now();
    const startRotationValue = normalizedStart;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / TICK_INTERVAL, 1);

      // Smooth easing function
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Calculate new rotation by adding the eased delta
      let rotation = startRotationValue + (delta * easeProgress);
      
      // Normalize to [0, 360) to prevent unbounded growth
      rotation = ((rotation % 360) + 360) % 360;
      
      setMinuteRotation(rotation);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [gameTime?.hour, gameTime?.minute]);

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
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                gameTime.is_day
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
