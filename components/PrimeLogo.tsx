// SuperPrime's permanent badge, in SuperYou's own style: "super" in ink and "prime" in rose,
// with the little four-point spark the shop uses for its perks. No frame, no swoosh.
// tone "dark" = ink text (on light backgrounds); "light" = white text (on dark panels).
//   pill = the wordmark    seal = a rounded rose square with "P" and the spark (member mark, same shape as the SY mark)
const spark = (x: number, y: number, r: number, fill: string) => (
  <path d={`M${x} ${y - r}C${x + r * 0.12} ${y - r * 0.12} ${x + r * 0.12} ${y - r * 0.12} ${x + r} ${y}C${x + r * 0.12} ${y + r * 0.12} ${x + r * 0.12} ${y + r * 0.12} ${x} ${y + r}C${x - r * 0.12} ${y + r * 0.12} ${x - r * 0.12} ${y + r * 0.12} ${x - r} ${y}C${x - r * 0.12} ${y - r * 0.12} ${x - r * 0.12} ${y - r * 0.12} ${x} ${y - r}Z`} fill={fill} />
);

export function PrimeLogo({ variant = "pill", tone = "dark", className = "" }: { variant?: "pill" | "seal"; tone?: "dark" | "light"; animated?: boolean; className?: string }) {
  const ink = tone === "dark" ? "#2e2229" : "#fff";
  const rose = tone === "dark" ? "#c0587a" : "#e8a3ba";
  if (variant === "seal")
    return (
      <svg viewBox="0 0 100 100" className={className} role="img" aria-label="SuperPrime member">
        <rect width="100" height="100" rx="22" fill="#c0587a" />
        <text x="44" y="70" textAnchor="middle" fill="#fff" fontFamily="inherit" fontWeight="800" fontSize="58">P</text>
        {spark(74, 28, 11, "#fff")}
      </svg>
    );
  return (
    <svg viewBox="0 0 172 36" className={className} role="img" aria-label="SuperPrime">
      <text x="1" y="27" fontFamily="inherit" fontSize="26" textLength="150" lengthAdjust="spacingAndGlyphs"><tspan fill={ink} fontWeight="500">super</tspan><tspan fill={rose} fontWeight="800">prime</tspan></text>
      {spark(158, 8, 6.5, rose)}
    </svg>
  );
}
