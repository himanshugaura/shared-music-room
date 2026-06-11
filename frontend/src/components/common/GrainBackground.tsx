"use client";

export default function GrainBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">

      <svg className="absolute inset-0 w-0 h-0">
        <defs>
          <filter id="grain-noise" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGBLinear">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.68 0.68"
              numOctaves="4"
              seed="2"
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" result="blended" />
            <feComposite in="blended" in2="SourceGraphic" operator="in" />
          </filter>
        </defs>
      </svg>

      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 55% 65% at 72% 38%, rgba(200,200,200,0.055) 0%, transparent 100%)",
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.68' numOctaves='4' seed='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "200px 200px",
        }}
      />

    </div>
  );
}
