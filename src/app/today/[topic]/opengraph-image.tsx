import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { todayDigest, TOPICS } from "@/lib/daily-post";

export const alt = "Rolearch daily jobs list";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const nf = new Intl.NumberFormat("en-US");

// The share card for a daily list: the topic, today's count and the top picks, in the site's share-card style.
export default async function Image({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: key } = await params;
  const topic = TOPICS.find((t) => t.key === key) ?? TOPICS[0];
  const d = await todayDigest(topic.key).catch(() => null);
  const logo = await readFile(join(process.cwd(), "public/brand/logo.svg"));
  const logoSrc = `data:image/svg+xml;base64,${logo.toString("base64")}`;
  const count = d ? (d.total >= 20000 ? "20,000+" : nf.format(d.total)) : "";
  const picks = (d?.jobs ?? []).slice(0, 3);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f4f5f1", padding: 70 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders a plain img */}
          <img src={logoSrc} width={280} height={50} alt="" />
          <div style={{ fontSize: 26, color: "#8a5a1c", letterSpacing: 2 }}>DAILY</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 700, color: "#0e1f2f", lineHeight: 1.04, letterSpacing: -2 }}>{topic.title}</div>
          {count && <div style={{ marginTop: 18, fontSize: 36, color: "#0e1f2f" }}>{`${count} ${topic.noun} in the last 24 hours`}</div>}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
            {picks.map((j) => (
              <div key={j.id} style={{ fontSize: 26, color: "#4b5a6e", marginTop: 6 }}>{`${j.title.slice(0, 60)} · ${j.company.slice(0, 30)}`}</div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 24, color: "#4b5a6e" }}>Straight from employers. No staffing agencies, no reposts. rolearch.com</div>
      </div>
    ),
    size,
  );
}
