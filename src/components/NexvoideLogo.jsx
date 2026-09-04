import React, { useState } from "react";

export default function NexvoideLogo({ size = 44, className = "" }) {
  const [src, setSrc] = useState("/logo.svg"); // Start with SVG

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={src}
        alt="Nexvoide"
        width={size}
        height={size}
        className="flex-shrink-0 object-contain"
        style={{ width: size, height: size }}
        onError={() => {
          // If SVG fails, fall back to PNG (and prevent infinite loop)
          if (src !== "/logo.png") setSrc("/logo.png");
        }}
      />
      <span className="text-white font-bold text-lg tracking-tight">
        Nexvoide
      </span>
    </div>
  );
}


