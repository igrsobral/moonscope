'use client';

import { useMemo } from 'react';

interface SentimentGaugeProps {
  value: number; // -1 to 1
  size?: number;
  showLabels?: boolean;
}

export function SentimentGauge({ value, size = 200, showLabels = true }: SentimentGaugeProps) {
  const { angle, color, label } = useMemo(() => {
    // Clamp value between -1 and 1
    const clampedValue = Math.max(-1, Math.min(1, value));

    // Convert to angle (180 degrees total, from -90 to +90)
    const angle = clampedValue * 90;

    // Determine color based on value
    let color: string;
    if (clampedValue > 0.3) {
      color = '#10b981'; // Green for bullish
    } else if (clampedValue < -0.3) {
      color = '#ef4444'; // Red for bearish
    } else {
      color = '#6b7280'; // Gray for neutral
    }

    // Determine label
    let label: string;
    if (clampedValue > 0.6) {
      label = 'Very Bullish';
    } else if (clampedValue > 0.3) {
      label = 'Bullish';
    } else if (clampedValue > 0.1) {
      label = 'Slightly Bullish';
    } else if (clampedValue > -0.1) {
      label = 'Neutral';
    } else if (clampedValue > -0.3) {
      label = 'Slightly Bearish';
    } else if (clampedValue > -0.6) {
      label = 'Bearish';
    } else {
      label = 'Very Bearish';
    }

    return { angle, color, label };
  }, [value]);

  const radius = size / 2 - 20;
  const centerX = size / 2;
  const centerY = size / 2;

  // Calculate needle position
  const needleLength = radius - 10;
  const needleAngle = (angle * Math.PI) / 180;
  const needleX = centerX + needleLength * Math.cos(needleAngle - Math.PI / 2);
  const needleY = centerY + needleLength * Math.sin(needleAngle - Math.PI / 2);

  // Create arc path for the gauge background
  const createArcPath = (startAngle: number, endAngle: number, radius: number) => {
    const start = {
      x: centerX + radius * Math.cos((startAngle * Math.PI) / 180 - Math.PI / 2),
      y: centerY + radius * Math.sin((startAngle * Math.PI) / 180 - Math.PI / 2),
    };
    const end = {
      x: centerX + radius * Math.cos((endAngle * Math.PI) / 180 - Math.PI / 2),
      y: centerY + radius * Math.sin((endAngle * Math.PI) / 180 - Math.PI / 2),
    };

    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <svg width={size} height={size} className="overflow-visible">
        {/* Gauge background arc */}
        <path
          d={createArcPath(-90, 90, radius)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Colored segments */}
        {/* Very Bearish */}
        <path
          d={createArcPath(-90, -54, radius)}
          fill="none"
          stroke="#dc2626"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Bearish */}
        <path
          d={createArcPath(-54, -18, radius)}
          fill="none"
          stroke="#ef4444"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Neutral */}
        <path
          d={createArcPath(-18, 18, radius)}
          fill="none"
          stroke="#6b7280"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* Bullish */}
        <path
          d={createArcPath(18, 54, radius)}
          fill="none"
          stroke="#10b981"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Very Bullish */}
        <path
          d={createArcPath(54, 90, radius)}
          fill="none"
          stroke="#059669"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Tick marks */}
        {[-90, -45, 0, 45, 90].map(tickAngle => {
          const tickRadius = radius + 5;
          const tickX1 =
            centerX + (radius - 5) * Math.cos((tickAngle * Math.PI) / 180 - Math.PI / 2);
          const tickY1 =
            centerY + (radius - 5) * Math.sin((tickAngle * Math.PI) / 180 - Math.PI / 2);
          const tickX2 = centerX + tickRadius * Math.cos((tickAngle * Math.PI) / 180 - Math.PI / 2);
          const tickY2 = centerY + tickRadius * Math.sin((tickAngle * Math.PI) / 180 - Math.PI / 2);

          return (
            <line
              key={tickAngle}
              x1={tickX1}
              y1={tickY1}
              x2={tickX2}
              y2={tickY2}
              stroke="#374151"
              strokeWidth="2"
            />
          );
        })}

        {/* Needle */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleX}
          y2={needleY}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx={centerX} cy={centerY} r="6" fill={color} />
      </svg>

      {showLabels && (
        <div className="space-y-2 text-center">
          <div className="text-2xl font-bold" style={{ color }}>
            {value.toFixed(3)}
          </div>
          <div className="text-sm font-medium" style={{ color }}>
            {label}
          </div>
          <div className="text-xs text-muted-foreground">Market Sentiment Score</div>
        </div>
      )}

      {showLabels && (
        <div className="flex w-full justify-between text-xs text-muted-foreground">
          <span>Very Bearish</span>
          <span>Neutral</span>
          <span>Very Bullish</span>
        </div>
      )}
    </div>
  );
}
