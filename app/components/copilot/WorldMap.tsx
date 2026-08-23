// app/components/copilot/WorldMap.tsx
'use client';
// A stylized dotted world map. Destinations passed in light up (amber) with a
// route arc between them. Coordinates are approximate lon/lat -> SVG mapped with
// an equirectangular projection. Themeable via tokens.

export interface MapPoint {
  label: string;
  lon: number; // -180..180
  lat: number; //  -90..90
}

// Equirectangular projection into a 360x180 viewBox (lon+180, 90-lat).
const W = 360, H = 180;
function project(lon: number, lat: number): { x: number; y: number } {
  return { x: (lon + 180) / 360 * W, y: (90 - lat) / 180 * H };
}

// A sparse dot grid over land-ish regions — stylized, not geographically exact.
// Each entry is [lon, lat]. Kept small; enough to read as continents.
const LAND: [number, number][] = [
  // North America
  [-120,55],[-110,50],[-100,45],[-90,40],[-80,35],[-100,55],[-115,40],[-95,30],[-105,35],[-90,50],[-75,45],
  // South America
  [-70,-10],[-60,-20],[-55,-30],[-65,0],[-50,-15],[-70,-40],[-60,-5],
  // Europe
  [0,50],[10,52],[20,50],[-5,40],[15,45],[25,55],[5,45],[30,50],[10,60],[20,40],
  // Africa
  [10,10],[20,0],[30,-10],[25,-20],[15,-25],[35,5],[20,15],[10,-5],[30,15],[25,-30],
  // Asia
  [60,50],[80,45],[100,40],[120,45],[90,30],[110,30],[130,35],[75,25],[100,20],[115,20],[140,40],[70,40],[95,55],[125,55],
  // SE Asia / Oceania
  [105,10],[115,0],[130,-5],[135,-25],[145,-30],[120,-10],[150,-35],[100,5],
];

export default function WorldMap({ points = [] }: { points?: MapPoint[] }) {
  const projected = points.map((p) => ({ ...p, ...project(p.lon, p.lat) }));

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden"
         style={{ backgroundColor: 'var(--panel)', backgroundImage: 'radial-gradient(600px 500px at 50% 45%, rgba(52,96,156,0.28), transparent 62%)' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-[92%] h-auto" style={{ maxHeight: '80%' }}>
        {/* land dots */}
        {LAND.map(([lon, lat], i) => {
          const { x, y } = project(lon, lat);
          return <circle key={i} cx={x} cy={y} r={0.9} fill="rgba(245,242,237,0.22)" />;
        })}

        {/* route arcs between consecutive destinations */}
        {projected.length > 1 && projected.slice(1).map((p, i) => {
          const a = projected[i], b = p;
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.abs(b.x - a.x) * 0.25;
          return (
            <path key={`arc-${i}`} d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                  fill="none" stroke="var(--accent)" strokeWidth={0.7} strokeLinecap="round" opacity={0.85}>
              <animate attributeName="stroke-dasharray" from="0 200" to="200 0" dur="1.2s" fill="freeze" />
            </path>
          );
        })}

        {/* destination points */}
        {projected.map((p, i) => (
          <g key={`pt-${i}`}>
            <circle cx={p.x} cy={p.y} r={3.4} fill="var(--accent)" opacity={0.25}>
              <animate attributeName="r" values="3;5;3" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <circle cx={p.x} cy={p.y} r={1.6} fill="var(--accent)" />
            <text x={p.x} y={p.y - 4} fontSize={4} fill="var(--panel-ink)" textAnchor="middle" fontWeight="600">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}