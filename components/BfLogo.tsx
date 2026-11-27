import { SY_PATH, SY_TRANSFORM } from "@/lib/brand-mark";

// SuperYou Black Friday logo: the SY mark with a spark, "BLACK" in white and "FRIDAY" in a moving
// rose-to-gold shine. Drawn in code so it stays sharp everywhere and can animate.
//   full  = mark + two-line wordmark (hero, doors)     pill = compact one-line badge (strip, stickers, cart)
export function BfLogo({ variant = "full", animated = true, className = "", year = "2026" }: { variant?: "full" | "pill"; animated?: boolean; className?: string; year?: string }) {
  const id = `bfg-${variant}`;
  const shine = animated ? <animate attributeName="x1" values="-1;0;-1" dur="4s" repeatCount="indefinite" /> : null;
  const grad = (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      {shine}
      <stop offset="0" stopColor="#f9a8c0" />
      <stop offset=".35" stopColor="#c0587a" />
      <stop offset=".65" stopColor="#fde68a" />
      <stop offset="1" stopColor="#f9a8c0" />
    </linearGradient>
  );
  const spark = (x: number, y: number, r: number) => (
    <path d={`M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`} fill="#fde68a">
      {animated && <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur="6s" repeatCount="indefinite" />}
      {animated && <animate attributeName="opacity" values="1;.4;1" dur="1.6s" repeatCount="indefinite" />}
    </path>
  );
  if (variant === "pill")
    return (
      <svg viewBox="0 0 360 64" className={className} role="img" aria-label="SuperYou Black Friday">
        <defs>{grad}</defs>
        <rect x="1" y="1" width="358" height="62" rx="31" fill="#000" stroke={`url(#${id})`} strokeWidth="2" />
        <g transform="translate(14 8) scale(0.048)"><rect width="1000" height="1000" rx="200" fill="#111" /><g transform={SY_TRANSFORM}><path d={SY_PATH} fill="#fff" /></g><rect x="420" y="845" width="160" height="22" fill="#c0587a" /></g>
        {spark(66, 14, 7)}
        <text x="84" y="41" fill="#fff" fontFamily="inherit" fontWeight="900" fontSize="23" textLength="104" lengthAdjust="spacingAndGlyphs">BLACK</text>
        <text x="198" y="41" fill={`url(#${id})`} fontFamily="inherit" fontWeight="900" fontSize="23" textLength="138" lengthAdjust="spacingAndGlyphs">FRIDAY</text>
      </svg>
    );
  return (
    <svg viewBox="0 0 520 170" className={className} role="img" aria-label={`SuperYou Black Friday ${year}`}>
      <defs>{grad}</defs>
      <g transform="translate(0 15) scale(0.14)"><rect width="1000" height="1000" rx="180" fill="#000" stroke="#fff" strokeOpacity=".25" strokeWidth="14" /><g transform={SY_TRANSFORM}><path d={SY_PATH} fill="#fff" /></g><rect x="420" y="845" width="160" height="22" fill="#c0587a" /></g>
      {spark(140, 20, 14)}
      {spark(22, 160, 7)}
      <text x="168" y="78" fill="currentColor" fontFamily="inherit" fontWeight="900" fontSize="66" textLength="270" lengthAdjust="spacingAndGlyphs">BLACK</text>
      <text x="168" y="140" fill={`url(#${id})`} fontFamily="inherit" fontWeight="900" fontSize="66" textLength="330" lengthAdjust="spacingAndGlyphs">FRIDAY</text>
      <text x="170" y="164" fill="currentColor" fillOpacity=".6" fontFamily="inherit" fontWeight="700" fontSize="15" textLength="326" lengthAdjust="spacing">SUPERYOU · {year}</text>
    </svg>
  );
}
