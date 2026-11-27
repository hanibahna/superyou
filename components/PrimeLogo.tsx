// SuperPrime's permanent badge: a plain lowercase wordmark, "super" in ink and "prime" in rose,
// with a single curved stroke under "prime". No frame, no icon.
// tone "dark" = ink text (on light backgrounds); "light" = white text (on dark panels).
//   pill = the wordmark    seal = a round rose mark with "prime" (member seal)
export function PrimeLogo({ variant = "pill", tone = "dark", className = "" }: { variant?: "pill" | "seal"; tone?: "dark" | "light"; animated?: boolean; className?: string }) {
  const ink = tone === "dark" ? "#2e2229" : "#fff";
  const rose = tone === "dark" ? "#c0587a" : "#e8a3ba";
  if (variant === "seal")
    return (
      <svg viewBox="0 0 120 120" className={className} role="img" aria-label="SuperPrime member">
        <circle cx="60" cy="60" r="58" fill="#c0587a" />
        <text x="60" y="64" textAnchor="middle" fill="#fff" fontFamily="inherit" fontWeight="700" fontSize="30" letterSpacing="-1">prime</text>
        <path d="M38 74 Q60 88 84 72" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 168 40" className={className} role="img" aria-label="SuperPrime">
      <text x="1" y="26" fontFamily="inherit" fontSize="26" textLength="150" lengthAdjust="spacingAndGlyphs"><tspan fill={ink} fontWeight="500">super</tspan><tspan fill={rose} fontWeight="800">prime</tspan></text>
      <path d="M78 33 Q112 42 148 31" fill="none" stroke={rose} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
