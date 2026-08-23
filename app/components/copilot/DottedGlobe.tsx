// app/components/copilot/DottedGlobe.tsx
'use client';
// Decorative rotating globe with continent shapes. Pure SVG/CSS, themed.
// The sphere is a gradient circle; continents are simplified landmass paths
// on a group that rotates horizontally, with a subtle grid for depth.

export default function DottedGlobe() {
  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden"
         style={{ backgroundColor: 'var(--panel)', backgroundImage: 'radial-gradient(700px 600px at 50% 45%, rgba(52,96,156,0.28), transparent 62%)' }}>
      <div className="globe-wrap">
        <svg viewBox="0 0 200 200" width="82%" style={{ maxWidth: 560 }}>
          <defs>
            <radialGradient id="sphere" cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#16324f" />
              <stop offset="55%" stopColor="#0e2338" />
              <stop offset="100%" stopColor="#081726" />
            </radialGradient>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="rgba(232,163,61,0)" />
              <stop offset="100%" stopColor="rgba(52,96,156,0.35)" />
            </radialGradient>
            <clipPath id="globeClip"><circle cx="100" cy="100" r="86" /></clipPath>
          </defs>

          {/* atmosphere glow */}
          <circle cx="100" cy="100" r="94" fill="url(#glow)" />
          {/* sphere */}
          <circle cx="100" cy="100" r="86" fill="url(#sphere)" stroke="rgba(120,170,220,0.25)" strokeWidth="0.6" />

          {/* rotating content: two copies of the land band, side by side, scrolling */}
          <g clipPath="url(#globeClip)">
            {/* latitude/longitude grid */}
            <g stroke="rgba(150,190,230,0.12)" strokeWidth="0.4" fill="none">
              <ellipse cx="100" cy="100" rx="86" ry="30" />
              <ellipse cx="100" cy="100" rx="86" ry="58" />
              <ellipse cx="100" cy="100" rx="30" ry="86" />
              <ellipse cx="100" cy="100" rx="58" ry="86" />
              <line x1="14" y1="100" x2="186" y2="100" />
            </g>

            {/* continents — simplified, on a scrolling group */}
            <g className="land-scroll" fill="rgba(120,200,180,0.55)">
              {/* copy 1 */}
              <g>
                {/* Africa */}
                <path d="M96 92 q6 -6 12 -3 q4 6 2 14 q-2 10 -8 16 q-6 4 -9 -2 q-4 -8 -2 -16 q1 -6 5 -9 z" />
                {/* Europe */}
                <path d="M92 74 q8 -3 14 1 q2 4 -3 6 q-8 2 -13 -1 q-2 -4 2 -6 z" />
                {/* Asia */}
                <path d="M110 72 q18 -4 30 3 q6 6 -2 12 q-14 6 -28 2 q-8 -4 -6 -11 q1 -4 6 -6 z" />
                {/* N. America */}
                <path d="M56 74 q12 -8 22 -3 q4 6 -2 12 q-3 8 -12 10 q-8 0 -11 -8 q-2 -8 3 -11 z" />
                {/* S. America */}
                <path d="M72 104 q7 -3 10 3 q3 10 -2 20 q-4 8 -9 5 q-4 -4 -3 -14 q0 -9 4 -14 z" />
                {/* Australia */}
                <path d="M138 120 q10 -3 16 2 q3 6 -4 9 q-9 3 -15 -2 q-2 -6 3 -9 z" />
              </g>
              {/* copy 2 (shifted right by full width for seamless scroll) */}
              <g transform="translate(172,0)">
                <path d="M96 92 q6 -6 12 -3 q4 6 2 14 q-2 10 -8 16 q-6 4 -9 -2 q-4 -8 -2 -16 q1 -6 5 -9 z" />
                <path d="M92 74 q8 -3 14 1 q2 4 -3 6 q-8 2 -13 -1 q-2 -4 2 -6 z" />
                <path d="M110 72 q18 -4 30 3 q6 6 -2 12 q-14 6 -28 2 q-8 -4 -6 -11 q1 -4 6 -6 z" />
                <path d="M56 74 q12 -8 22 -3 q4 6 -2 12 q-3 8 -12 10 q-8 0 -11 -8 q-2 -8 3 -11 z" />
                <path d="M72 104 q7 -3 10 3 q3 10 -2 20 q-4 8 -9 5 q-4 -4 -3 -14 q0 -9 4 -14 z" />
                <path d="M138 120 q10 -3 16 2 q3 6 -4 9 q-9 3 -15 -2 q-2 -6 3 -9 z" />
              </g>
            </g>

            {/* shading overlay for spherical depth */}
            <circle cx="100" cy="100" r="86" fill="url(#sphere)" opacity="0.35" style={{ mixBlendMode: 'multiply' }} />
            <circle cx="72" cy="70" r="40" fill="rgba(255,255,255,0.06)" />
          </g>
        </svg>
      </div>

      <style>{`
        .globe-wrap { display: flex; align-items: center; justify-content: center; }
        .land-scroll { animation: land-rotate 34s linear infinite; }
        @keyframes land-rotate {
          from { transform: translateX(0); }
          to   { transform: translateX(-172px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .land-scroll { animation: none; }
        }
      `}</style>
    </div>
  );
}