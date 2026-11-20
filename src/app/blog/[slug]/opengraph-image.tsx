import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPost, industry } from "@/lib/blog";

export const alt = "Rolearch blog article";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The share card for an article (LinkedIn, X, Slack previews showed none): its title and industry, in the site's
// share-card style.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getPost((await params).slug).catch(() => null);
  const logo = await readFile(join(process.cwd(), "public/brand/logo.svg"));
  const logoSrc = `data:image/svg+xml;base64,${logo.toString("base64")}`;
  const title = p?.title ?? "Rolearch blog";
  const label = p ? (industry(p.industry)?.name ?? "Careers") : "Careers";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f4f5f1", padding: 70 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders a plain img */}
          <img src={logoSrc} width={280} height={50} alt="" />
          <div style={{ fontSize: 26, color: "#8a5a1c", letterSpacing: 2 }}>{label.toUpperCase()}</div>
        </div>
        <div style={{ fontSize: title.length > 70 ? 58 : 68, fontWeight: 700, color: "#0e1f2f", lineHeight: 1.06, letterSpacing: -2 }}>{title}</div>
        <div style={{ fontSize: 24, color: "#4b5a6e" }}>Measured from live job postings · rolearch.com/blog</div>
      </div>
    ),
    size,
  );
}
