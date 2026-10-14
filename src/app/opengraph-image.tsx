import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Rolearch: One network, endless opportunity";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Share card: the logo and tagline on paper, over faint meridian lines.
export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/brand/logo.svg"));
  const logoSrc = `data:image/svg+xml;base64,${logo.toString("base64")}`;
  const lines = Array.from({ length: 13 }, (_, i) => i * 100);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f4f5f1", padding: 80, position: "relative" }}>
        {lines.map((x) => (
          <div key={x} style={{ position: "absolute", left: x, top: 0, width: 1, height: 630, background: "#d9ddd4" }} />
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders a plain img */}
        <img src={logoSrc} width={391} height={70} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 700, color: "#0e1f2f", lineHeight: 1.02, letterSpacing: -3, maxWidth: 1000 }}>
            One network, endless opportunity.
          </div>
          <div style={{ marginTop: 28, fontSize: 32, color: "#4b5a6e" }}>Verified jobs worldwide. Your match shown before you apply.</div>
        </div>
      </div>
    ),
    size,
  );
}
