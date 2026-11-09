import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { loadBadge } from "@/lib/badge";

// The badge as a share image: skill, level, score, with the Rolearch logo.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const b = await loadBadge((await params).code);
  if (!b) return new Response("Not found", { status: 404 });
  const logo = await readFile(join(process.cwd(), "public/brand/logo.svg"));
  const logoSrc = `data:image/svg+xml;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f4f5f1", padding: 72 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders a plain img */}
        <img src={logoSrc} width={335} height={60} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 34, color: "#2f6b3a", fontWeight: 700 }}>✓ Verified skill badge</div>
          <div style={{ fontSize: 96, fontWeight: 700, color: "#0e1f2f", letterSpacing: -3, lineHeight: 1.05, marginTop: 12, maxWidth: 1050 }}>{b.skill}</div>
          <div style={{ display: "flex", fontSize: 44, color: "#4b5a6e", marginTop: 12 }}>
            {`${b.level} level · ${Math.round(b.score)}%`}
          </div>
          <div style={{ marginTop: 28, fontSize: 28, color: "#9a6a2a" }}>Proctored test · rolearch.com/skills</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
