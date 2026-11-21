import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number | string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = 'w-10 h-10', size }) => {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl shadow-xs ${className}`} style={style}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
        <defs>
          <linearGradient id="brand-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>
          <linearGradient id="brand-sync" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#d4d4d8" />
          </linearGradient>
        </defs>

        {/* Squircle Base Tile in Obsidian Zinc */}
        <rect width="512" height="512" rx="116" fill="url(#brand-bg)" />
        <rect width="504" height="504" x="4" y="4" rx="112" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="6" />

        {/* SYNC LOOP */}
        {/* Outer Concentric Arc */}
        <path
          d="M 152,246 A 124,124 0 1,0 360,246"
          fill="none"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Inner Dynamic Sync Arcs */}
        <path
          d="M 180,310 A 78,78 0 0,1 324,260"
          fill="none"
          stroke="url(#brand-sync)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <polygon points="340,248 334,286 304,262" fill="#ffffff" />

        <path
          d="M 332,310 A 78,78 0 0,1 188,360"
          fill="none"
          stroke="url(#brand-sync)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <polygon points="172,372 178,334 208,358" fill="#ffffff" />

        {/* GRADUATION CAP */}
        <polygon points="256,132 414,195 256,258 98,195" fill="rgba(255, 255, 255, 0.08)" />
        <polygon points="256,132 414,195 256,258 98,195" fill="none" stroke="#ffffff" strokeWidth="18" strokeLinejoin="round" />
        <ellipse cx="256" cy="195" rx="8" ry="6" fill="#ffffff" />

        {/* Tassel in crisp silver */}
        <path d="M 414,195 Q 418,225 418,235" fill="none" stroke="#e4e4e7" strokeWidth="7" strokeLinecap="round" />
        <path d="M 418,235 C 413,235 408,245 408,258 C 408,272 414,278 418,278 C 422,278 428,272 428,258 C 428,245 423,235 418,235 Z" fill="#e4e4e7" />
      </svg>
    </div>
  );
};
