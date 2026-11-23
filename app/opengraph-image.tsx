import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The picture shown when any SuperYou page is shared, unless the page has its own (product pages do).
export const alt = "SuperYou: original beauty and parapharmacy in Lebanon";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/brand/superyou-logo-white.svg"));
  const src = `data:image/svg+xml;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#1d171a", color: "#faf6f8", padding: 72, position: "relative" }}>
        <div style={{ position: "absolute", right: -160, top: -160, width: 620, height: 620, borderRadius: 620, background: "radial-gradient(circle at 35% 40%, #d97a9b 0%, #c0587a 40%, #8e3a5a 75%, #1d171a 100%)" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={420} height={46} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 820 }}>Reveal the super in you.</div>
          <div style={{ fontSize: 32, marginTop: 24, color: "#e9c3d1" }}>Originals only · Advice included · Paid on delivery</div>
        </div>
        <div style={{ fontSize: 26, color: "#a9a2a6" }}>shopsuperyou.com · Lebanon</div>
      </div>
    ),
    size,
  );
}
