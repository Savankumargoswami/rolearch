import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { readShare } from "@/lib/share-card";

const size = { width: 1200, height: 630 };
const color = (s: number) => (s >= 80 ? "#0e1f2f" : s >= 65 ? "#d9a35b" : "#b4532a");

// The shared ATS score as an image: "Resume scored 54 → 87 for Data Engineer", with the Rolearch logo.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const card = readShare((await params).code);
  if (!card) return new Response("Not found", { status: 404 });
  const logo = await readFile(join(process.cwd(), "public/brand/logo.svg"));
  const logoSrc = `data:image/svg+xml;base64,${logo.toString("base64")}`;
  const lines = Array.from({ length: 13 }, (_, i) => i * 100);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f4f5f1", padding: 72, position: "relative" }}>
        {lines.map((x) => (
          <div key={x} style={{ position: "absolute", left: x, top: 0, width: 1, height: 630, background: "#d9ddd4" }} />
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders a plain img */}
        <img src={logoSrc} width={335} height={60} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 36, color: "#4b5a6e" }}>{card.before !== null ? "My resume, tailored with Rolearch, scored" : "My resume scored"}</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
            {card.before !== null && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ fontSize: 170, fontWeight: 700, color: "#9aa5b3", letterSpacing: -6, textDecoration: "line-through" }}>{String(card.before)}</div>
                <div style={{ fontSize: 110, color: "#4b5a6e", margin: "0 28px" }}>→</div>
              </div>
            )}
            <div style={{ fontSize: 190, fontWeight: 700, color: color(card.after), letterSpacing: -7, lineHeight: 1 }}>{String(card.after)}</div>
            <div style={{ fontSize: 56, color: "#4b5a6e", marginLeft: 16, marginTop: 70 }}>/100</div>
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#0e1f2f", maxWidth: 1050 }}>{`for ${card.title}`}</div>
          <div style={{ marginTop: 22, fontSize: 28, color: "#4b5a6e" }}>Free ATS check · rolearch.com/ats</div>
        </div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
