/** Small circular team flags — simplified dot-stars read cleanly at icon size. */

function dotRing(cx: number, cy: number, r: number, count: number, dotR: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    return { cx: cx + r * Math.cos(angle), cy: cy + r * Math.sin(angle), key: i, dotR };
  });
}

export function EuropeFlag({ size = 32, className }: { size?: number; className?: string }) {
  const stars = dotRing(50, 50, 30, 12, 3.2);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="Europe" className={className}>
      <clipPath id="eu-flag-circle">
        <circle cx="50" cy="50" r="48" />
      </clipPath>
      <g clipPath="url(#eu-flag-circle)">
        <rect width="100" height="100" fill="#003399" />
        {stars.map((s) => (
          <circle key={s.key} cx={s.cx} cy={s.cy} r={s.dotR} fill="#FFCC00" />
        ))}
      </g>
      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(14,26,26,0.15)" strokeWidth="2" />
    </svg>
  );
}

export function UsaFlag({ size = 32, className }: { size?: number; className?: string }) {
  const stripeH = 100 / 13;
  const cantonW = 54;
  const cantonH = stripeH * 7;
  const stars = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      stars.push({
        cx: 6 + col * (cantonW - 12) / 4,
        cy: 6 + row * (cantonH - 12) / 3,
        key: `${row}-${col}`,
      });
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="USA" className={className}>
      <clipPath id="usa-flag-circle">
        <circle cx="50" cy="50" r="48" />
      </clipPath>
      <g clipPath="url(#usa-flag-circle)">
        {Array.from({ length: 13 }, (_, i) => (
          <rect key={i} x="0" y={i * stripeH} width="100" height={stripeH + 0.5}
                fill={i % 2 === 0 ? "#B31942" : "#FFFFFF"} />
        ))}
        <rect x="0" y="0" width={cantonW} height={cantonH} fill="#0A3161" />
        {stars.map((s) => (
          <circle key={s.key} cx={s.cx} cy={s.cy} r={1.6} fill="#FFFFFF" />
        ))}
      </g>
      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(14,26,26,0.15)" strokeWidth="2" />
    </svg>
  );
}
