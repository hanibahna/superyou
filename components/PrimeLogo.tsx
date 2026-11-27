import { SY_PATH, SY_TRANSFORM } from "@/lib/brand-mark";

// SuperPrime's permanent badge: the SY mark under a small crown, "SUPER" + "PRIME" in a slow
// rose-gold shine. tone "dark" = black badge (on light pages); "light" = white badge (on dark panels).
//   pill = inline badge (cart, checkout, account)    seal = round member seal (account, promos)
export function PrimeLogo({ variant = "pill", tone = "dark", animated = true, className = "" }: { variant?: "pill" | "seal"; tone?: "dark" | "light"; animated?: boolean; className?: string }) {
  const bg = tone === "dark" ? "#0b0b0d" : "#fff";
  const fg = tone === "dark" ? "#fff" : "#0b0b0d";
  const id = `spg-${tone}`;
  const grad = (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      {animated && <animate attributeName="x1" values="-1;0;-1" dur="6s" repeatCount="indefinite" />}
      <stop offset="0" stopColor="#c0587a" />
      <stop offset=".5" stopColor="#e9c46a" />
      <stop offset="1" stopColor="#c0587a" />
    </linearGradient>
  );
  const crown = (x: number, y: number, w: number) => (
    <path d={`M${x} ${y}L${x + w * 0.18} ${y - w * 0.42}L${x + w * 0.36} ${y - w * 0.12}L${x + w * 0.5} ${y - w * 0.55}L${x + w * 0.64} ${y - w * 0.12}L${x + w * 0.82} ${y - w * 0.42}L${x + w} ${y}Z`} fill={`url(#${id})`} />
  );
  const mark = (tr: string, rx: number) => (
    <g transform={tr}><rect width="1000" height="1000" rx={rx} fill={tone === "dark" ? "#1a1a1e" : "#0b0b0d"} /><g transform={SY_TRANSFORM}><path d={SY_PATH} fill="#fff" /></g><rect x="420" y="845" width="160" height="22" fill="#c0587a" /></g>
  );
  if (variant === "seal")
    return (
      <svg viewBox="0 0 200 200" className={className} role="img" aria-label="SuperPrime member">
        <defs>{grad}</defs>
        <circle cx="100" cy="100" r="96" fill={bg} stroke={`url(#${id})`} strokeWidth="6" />
        <circle cx="100" cy="100" r="84" fill="none" stroke={fg} strokeOpacity=".15" strokeWidth="1.5" strokeDasharray="3 5" />
        {crown(70, 62, 60)}
        {mark("translate(72 68) scale(0.056)", 220)}
        <text x="100" y="150" textAnchor="middle" fill={fg} fontFamily="inherit" fontWeight="900" fontSize="20" textLength="118" lengthAdjust="spacingAndGlyphs">SUPERPRIME</text>
        <text x="100" y="170" textAnchor="middle" fill={`url(#${id})`} fontFamily="inherit" fontWeight="800" fontSize="10" letterSpacing="3">MEMBER</text>
      </svg>
    );
  return (
    <svg viewBox="0 0 250 56" className={className} role="img" aria-label="SuperPrime">
      <defs>{grad}</defs>
      <rect x="1" y="1" width="248" height="54" rx="27" fill={bg} stroke={`url(#${id})`} strokeWidth="2" />
      {mark("translate(15 17) scale(0.028)", 220)}
      {crown(17, 17, 26)}
      <text x="56" y="36" fill={fg} fontFamily="inherit" fontWeight="900" fontSize="20" textLength="82" lengthAdjust="spacingAndGlyphs">SUPER</text>
      <text x="141" y="36" fill={`url(#${id})`} fontFamily="inherit" fontWeight="900" fontSize="20" textLength="94" lengthAdjust="spacingAndGlyphs">PRIME</text>
    </svg>
  );
}
