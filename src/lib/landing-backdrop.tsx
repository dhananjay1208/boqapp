/**
 * Shared backdrop for /login and / (module landing).
 *
 * Z-stack (bottom → top):
 *   1. Blue gradient base       — always visible
 *   2. SVG construction scene   — blueprint grid + city skyline + tower crane
 *   3. Photo from /landing-bg.jpg, if present (404s gracefully on top of #2)
 *   4. White wash (70%)         — washes saturation of the photo
 *   5. Subtle vertical gradient — adds depth without darkening
 *
 * Drop a JPG at app/public/landing-bg.jpg to override the SVG with a real photo;
 * remove it to fall back to the SVG. No code change needed in either case.
 */
export function LandingBackdrop() {
  return (
    <>
      {/* 1. Blue gradient base */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50"
        aria-hidden
      />

      {/* 2. SVG construction scene */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden
      >
        <defs>
          <pattern id="blueprint-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e40af" strokeWidth="0.6" opacity="0.07" />
          </pattern>
        </defs>

        {/* Blueprint grid covers the whole canvas */}
        <rect width="100%" height="100%" fill="url(#blueprint-grid)" />

        {/* Construction skyline + crane silhouette anchored to the bottom */}
        <g fill="#1e40af" opacity="0.10">
          {/* Ground baseline */}
          <rect x="0" y="820" width="1600" height="80" />

          {/* Buildings, varying heights */}
          <rect x="80"   y="640" width="120" height="180" />
          <rect x="220"  y="560" width="100" height="260" />
          <rect x="340"  y="670" width="140" height="150" />
          <rect x="500"  y="600" width="110" height="220" />
          <rect x="630"  y="660" width="90"  height="160" />
          <rect x="740"  y="540" width="140" height="280" />
          <rect x="900"  y="660" width="100" height="160" />
          <rect x="1020" y="600" width="160" height="220" />
          <rect x="1200" y="680" width="110" height="140" />
          <rect x="1330" y="580" width="130" height="240" />
          <rect x="1480" y="650" width="100" height="170" />

          {/* Window strips on the tallest building (#9) for character */}
        </g>

        {/* Window grids on some buildings (a touch more detail, very faint) */}
        <g fill="#1e3a8a" opacity="0.06">
          <rect x="246"  y="590" width="14" height="10" />
          <rect x="270"  y="590" width="14" height="10" />
          <rect x="294"  y="590" width="14" height="10" />
          <rect x="246"  y="612" width="14" height="10" />
          <rect x="270"  y="612" width="14" height="10" />
          <rect x="294"  y="612" width="14" height="10" />
          <rect x="246"  y="634" width="14" height="10" />
          <rect x="270"  y="634" width="14" height="10" />
          <rect x="294"  y="634" width="14" height="10" />

          <rect x="760"  y="570" width="14" height="10" />
          <rect x="784"  y="570" width="14" height="10" />
          <rect x="808"  y="570" width="14" height="10" />
          <rect x="832"  y="570" width="14" height="10" />
          <rect x="856"  y="570" width="14" height="10" />
          <rect x="760"  y="592" width="14" height="10" />
          <rect x="784"  y="592" width="14" height="10" />
          <rect x="808"  y="592" width="14" height="10" />
          <rect x="832"  y="592" width="14" height="10" />
          <rect x="856"  y="592" width="14" height="10" />

          <rect x="1040" y="630" width="14" height="10" />
          <rect x="1064" y="630" width="14" height="10" />
          <rect x="1088" y="630" width="14" height="10" />
          <rect x="1112" y="630" width="14" height="10" />
          <rect x="1136" y="630" width="14" height="10" />
          <rect x="1160" y="630" width="14" height="10" />
        </g>

        {/* Tower crane — front-and-centre */}
        <g stroke="#1e40af" strokeWidth="2.5" fill="#1e40af" opacity="0.14">
          {/* Vertical mast */}
          <rect x="447" y="340" width="6" height="490" />
          {/* Top cab */}
          <rect x="441" y="330" width="18" height="14" />
          {/* Counter-jib (short arm, left) */}
          <rect x="365" y="330" width="76"  height="6" />
          {/* Main jib (long arm, right) */}
          <rect x="459" y="330" width="280" height="6" />
          {/* Apex tower (pyramid on top) */}
          <path d="M 441 330 L 450 295 L 459 330 Z" />
          {/* Diagonal cables from apex to main jib */}
          <line x1="450" y1="298" x2="735" y2="335" strokeWidth="1.2" />
          <line x1="450" y1="298" x2="370" y2="335" strokeWidth="1.2" />
          {/* Trolley + hook line */}
          <rect x="650" y="334" width="14" height="6" />
          <line x1="657" y1="340" x2="657" y2="430" strokeWidth="1.4" />
          {/* Hook block */}
          <rect x="652" y="430" width="10" height="10" />
        </g>

        {/* Faint scaffolding / blueprint guide lines rising from the buildings */}
        <g stroke="#1e40af" strokeWidth="0.6" opacity="0.10" fill="none">
          <line x1="270"  y1="560" x2="270"  y2="380" />
          <line x1="810"  y1="540" x2="810"  y2="360" />
          <line x1="1100" y1="600" x2="1100" y2="420" />
          {/* horizontal hash marks */}
          <line x1="265"  y1="400" x2="275"  y2="400" />
          <line x1="805"  y1="380" x2="815"  y2="380" />
          <line x1="1095" y1="450" x2="1105" y2="450" />
        </g>
      </svg>

      {/* 3. Photo backdrop (optional override). Tries PNG first, then JPG. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/landing-bg.png'), url('/landing-bg.jpg')" }}
        aria-hidden
      />

      {/* 4. White wash to soften saturation */}
      <div className="absolute inset-0 bg-white/70" aria-hidden />

      {/* 5. Subtle vertical gradient for depth */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/15 to-white/55"
        aria-hidden
      />
    </>
  )
}
