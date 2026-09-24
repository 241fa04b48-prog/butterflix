// Animated butterflies — floating, wing-flapping SVG butterflies for splash/auth surfaces.
const WING_LEFT = "M12 2C7 2 2 7 2 13c0 3 2 5 5 5 3 0 5-3 5-7 0-5 0-9 0-9z";
const WING_RIGHT = "M14 2c5 0 10 5 10 11 0 3-2 5-5 5-3 0-5-3-5-7 0-5 0-9 0-9z";

const COLORS = [
  ["#f3d9a4", "#e8c07a"],
  ["#ef4d4a", "#b42c38"],
  ["#ffd98e", "#c48a3a"],
  ["#ffb0a6", "#8a3d6a"],
  ["#e8c07a", "#3d6f94"]
];

const random = (min, max) => min + Math.random() * (max - min);

function butterflySvg(colors, size, glowId) {
  return `
  <svg class="butterfly-svg" width="${size}" height="${size * 0.85}" viewBox="0 0 26 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="${glowId}" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="1.1" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g class="butterfly-left-wing" filter="url(#${glowId})"><path d="${WING_LEFT}" fill="${colors[0]}" opacity="0.95"/></g>
    <g class="butterfly-right-wing" filter="url(#${glowId})"><path d="${WING_RIGHT}" fill="${colors[1]}" opacity="0.95"/></g>
    <ellipse cx="13" cy="11" rx="1.3" ry="4.6" fill="rgba(24,18,12,0.9)"/>
  </svg>`;
}

// depth: "far" = small, blurred, dim · "mid" = normal · "near" = large, bright, fast flap
const DEPTHS = {
  far: { scale: [0.5, 0.75], blur: 1.6, opacity: 0.4, rise: [55, 85], speed: [14, 20], flap: [0.45, 0.75] },
  mid: { scale: [0.85, 1.25], blur: 0, opacity: 0.9, rise: [75, 110], speed: [10, 16], flap: [0.32, 0.55] },
  near: { scale: [1.4, 2.1], blur: 0, opacity: 1, rise: [90, 130], speed: [8, 13], flap: [0.24, 0.42] }
};

export function releaseButterflies(container, count = 16, options = {}) {
  if (!container) return;
  const { maxDelay = 9, speedScale = 1 } = options;
  const layer = document.createElement("div");
  layer.className = "butterfly-layer";
  container.appendChild(layer);

  for (let i = 0; i < count; i++) {
    // ~30% far, ~45% mid, ~25% near for a layered swarm
    const roll = Math.random();
    const depth = roll < 0.3 ? DEPTHS.far : roll < 0.75 ? DEPTHS.mid : DEPTHS.near;
    const [a, b] = COLORS[i % COLORS.length];
    const el = document.createElement("div");
    el.className = "butterfly";
    const size = 26 * random(depth.scale[0], depth.scale[1]);
    el.innerHTML = butterflySvg([a, b], size, `bf-glow-${i}`);
    el.style.left = `${random(2, 94)}%`;
    el.style.opacity = depth.opacity;
    if (depth.blur) el.style.filter = `blur(${depth.blur}px)`;
    el.style.setProperty("--drift", `${random(-18, 18)}vw`);
    el.style.setProperty("--sway", `${random(2, 5)}vw`);
    el.style.setProperty("--duration", `${random(depth.speed[0], depth.speed[1]) * speedScale}s`);
    el.style.setProperty("--delay", `${random(0, maxDelay)}s`);
    el.style.setProperty("--flap-speed", `${random(depth.flap[0], depth.flap[1])}s`);
    el.style.setProperty("--rise", `${random(depth.rise[0], depth.rise[1])}vh`);
    layer.appendChild(el);
  }
  return layer;
}
