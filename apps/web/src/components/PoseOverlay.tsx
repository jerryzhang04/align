import { LANDMARK } from "@align/metrics";
import type { PoseFrame } from "@align/metrics";

const CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [7, 0],
  [8, 0],
];

type Props = {
  frame: PoseFrame | null;
  width: number;
  height: number;
};

export function PoseOverlay({ frame, width, height }: Props) {
  if (!frame || !width || !height) return null;
  const points = frame.landmarks.map((landmark) => ({
    x: landmark.x * width,
    y: landmark.y * height,
    v: landmark.visibility ?? 1,
  }));
  return (
    <svg className="overlay" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <ellipse cx={width / 2} cy={height * 0.52} rx={width * 0.18} ry={height * 0.38} fill="none" stroke="rgba(94,234,212,0.35)" strokeDasharray="8 8" />
      {CONNECTIONS.map(([a, b]) => {
        const pa = points[a];
        const pb = points[b];
        if (!pa || !pb || pa.v < 0.4 || pb.v < 0.4) return null;
        return <line key={`${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#5eead4" strokeWidth="4" />;
      })}
      {points.map((point, index) =>
        point.v < 0.45 ? null : (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={index === LANDMARK.nose ? 6 : 4}
            fill={index === LANDMARK.leftShoulder || index === LANDMARK.rightShoulder ? "#fbbf24" : "white"}
          />
        ),
      )}
    </svg>
  );
}
