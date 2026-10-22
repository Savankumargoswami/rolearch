import type { Scene } from "@/lib/occupation-scene";

/**
 * The profile header's backdrop: a quiet line drawing of the person's work, with one slow movement.
 * Pure SVG + CSS (keyframes in globals.css, `pb-*`), anchored to the right so the text side stays calm.
 * Motion stops for people who ask for reduced motion.
 */
export function ProfileBackdrop({ scene }: { scene: Scene }) {
  const { accent, Art } = SCENE_ART[scene];
  return (
    <div aria-hidden="true" className="pb pointer-events-none absolute inset-0" style={{ "--pb": accent } as React.CSSProperties}>
      {/* the room light: accent glow behind the drawing, a cool one at the opposite corner */}
      <div className="absolute -end-24 -top-28 size-[28rem] rounded-full opacity-25 blur-3xl" style={{ background: accent }} />
      <div className="absolute -bottom-36 -start-24 size-80 rounded-full bg-[#3b6ea5]/25 blur-3xl" />
      {/* fades in from the right, clear of the name; the summary strip below sits on its own frosted base */}
      <div className="absolute inset-0 [mask-image:linear-gradient(to_right,transparent_40%,black_75%)] max-md:[mask-image:none] max-md:opacity-50">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1200 520"
          preserveAspectRatio="xMaxYMid slice"
          fill="none"
          stroke="currentColor"
        >
          <Art />
        </svg>
      </div>
    </div>
  );
}

const line = "text-white/[0.14]";
const strong = "text-[var(--pb)]";

function Pipeline() {
  // sources -> transforms -> destinations, with records flowing along each link
  const left = [110, 210, 310, 410];
  const mid = [160, 300, 440].map((y) => y - 30);
  const right = [190, 330];
  const links: string[] = [];
  left.forEach((y, i) => links.push(`M760 ${y} C 840 ${y}, 860 ${mid[i % 3]}, 940 ${mid[i % 3]}`));
  mid.forEach((y, i) => links.push(`M960 ${y} C 1040 ${y}, 1060 ${right[i % 2]}, 1120 ${right[i % 2]}`));
  return (
    // drawn a little smaller and pulled to the right edge, clear of long names
    <g strokeWidth="1.5" transform="translate(1200 40) scale(0.86) translate(-1200 0)">
      {links.map((d) => (
        <g key={d}>
          <path d={d} className={line} />
          <path d={d} className={`${strong} pb-flow`} strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray="1 24" />
        </g>
      ))}
      {left.map((y) => <rect key={y} x="728" y={y - 14} width="32" height="28" rx="6" className={line} />)}
      {mid.map((y) => <rect key={y} x="940" y={y - 22} width="20" height="44" rx="4" className={strong} strokeOpacity=".7" />)}
      {right.map((y) => <circle key={y} cx="1136" cy={y} r="16" className={line} />)}
    </g>
  );
}

function Code() {
  // a code minimap: indented lines, one being typed, a blinking cursor
  const rows = [
    [0, 180], [1, 240], [1, 120], [2, 300], [2, 210], [1, 90], [0, 60], [0, 200], [1, 260], [2, 150], [1, 110], [0, 70],
  ];
  return (
    <g strokeLinecap="round" strokeWidth="9">
      {rows.map(([indent, w], i) => (
        <line key={i} x1={720 + indent * 36} x2={720 + indent * 36 + w} y1={70 + i * 32} y2={70 + i * 32} className={i % 4 === 1 ? strong : line} strokeOpacity={i % 4 === 1 ? 0.55 : 1} />
      ))}
      <line x1={756} x2={1036} y1={70 + 12 * 32} y2={70 + 12 * 32} className={`${strong} pb-type`} />
      <rect x="1046" y={70 + 12 * 32 - 12} width="4" height="24" className={`${strong} pb-blink`} fill="currentColor" stroke="none" />
    </g>
  );
}

function Pulse() {
  const ecg = "M560 280 H760 l18 -10 l14 10 h40 l14 -110 l20 220 l16 -150 l12 40 h60 l18 -24 l22 24 H1200";
  return (
    <g strokeWidth="2" strokeLinejoin="round">
      {[150, 220, 290, 360, 430].map((y) => <line key={y} x1="560" x2="1200" y1={y} y2={y} className={line} strokeOpacity=".5" />)}
      <path d={ecg} className={line} />
      <path d={ecg} className={`${strong} pb-trace`} strokeWidth="3" pathLength={100} strokeDasharray="18 82" />
    </g>
  );
}

function Route() {
  const road = "M600 460 C 700 440, 720 340, 820 330 S 960 380, 1010 280 S 1080 120, 1150 110";
  return (
    <g>
      {[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4, 5].map((c) => (
        <rect key={`${r}-${c}`} x={640 + c * 92} y={30 + r * 96} width="74" height="78" rx="6" className={line} strokeOpacity=".55" />
      )))}
      <path d={road} className="text-[#0e1f2f]" strokeWidth="22" strokeLinecap="round" />
      <path d={road} className={line} strokeWidth="22" strokeLinecap="round" strokeOpacity=".9" />
      <path d={road} className={`${strong} pb-flow`} strokeWidth="2.5" pathLength={100} strokeDasharray="2.5 3" />
      <g className={strong} transform="translate(1150 110)">
        <circle r="26" strokeOpacity=".35" className="pb-ping" />
        <path d="M0 -4 c-8 0 -14 6 -14 13 c0 10 14 22 14 22 s14 -12 14 -22 c0 -7 -6 -13 -14 -13z" transform="translate(0 -18)" fill="currentColor" stroke="none" />
      </g>
    </g>
  );
}

function Blueprint() {
  const part = "M820 360 L820 200 L920 140 L1040 200 L1040 360 L920 420 Z M820 200 L920 260 L1040 200 M920 260 L920 420";
  return (
    <g strokeWidth="1">
      {Array.from({ length: 15 }, (_, i) => <line key={`v${i}`} x1={620 + i * 40} x2={620 + i * 40} y1="0" y2="520" className={line} strokeOpacity={i % 5 ? 0.35 : 0.8} />)}
      {Array.from({ length: 13 }, (_, i) => <line key={`h${i}`} x1="620" x2="1200" y1={i * 40} y2={i * 40} className={line} strokeOpacity={i % 5 ? 0.35 : 0.8} />)}
      <path d={part} className={`${strong} pb-draft`} strokeWidth="2" pathLength={100} strokeDasharray="100" />
      <line x1="800" x2="800" y1="200" y2="360" className={line} strokeDasharray="4 4" />
      <g className={`${strong} pb-spin`} strokeOpacity=".6" strokeWidth="2">
        <circle cx="1110" cy="430" r="34" />
        <circle cx="1110" cy="430" r="12" />
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return <line key={i} x1={1110 + Math.cos(a) * 34} y1={430 + Math.sin(a) * 34} x2={1110 + Math.cos(a) * 46} y2={430 + Math.sin(a) * 46} strokeWidth="7" />;
        })}
      </g>
    </g>
  );
}

function Curves() {
  const pen = "M640 380 C 760 120, 880 120, 940 260 S 1100 420, 1170 160";
  return (
    <g strokeWidth="1.5">
      <circle cx="930" cy="250" r="150" className={line} />
      <circle cx="1030" cy="300" r="110" className={line} />
      <path d={pen} className={line} />
      <path d={pen} className={`${strong} pb-draft`} strokeWidth="3" pathLength={100} strokeDasharray="100" />
      {[[640, 380, 760, 120], [940, 260, 880, 120], [940, 260, 1000, 400], [1170, 160, 1100, 420]].map(([x, y, hx, hy], i) => (
        <g key={i} className={strong}>
          <line x1={x} y1={y} x2={hx} y2={hy} strokeOpacity=".45" />
          <rect x={x - 6} y={y - 6} width="12" height="12" fill="#0e1f2f" />
          <circle cx={hx} cy={hy} r="5" fill="currentColor" stroke="none" />
        </g>
      ))}
    </g>
  );
}

function Chart() {
  const candles = [380, 340, 360, 300, 320, 270, 290, 230, 250, 190, 210, 160];
  const trend = candles.map((y, i) => `${i ? "L" : "M"}${700 + i * 40} ${y}`).join(" ");
  return (
    <g strokeWidth="1.5">
      {[120, 220, 320, 420].map((y) => <line key={y} x1="660" x2="1200" y1={y} y2={y} className={line} strokeOpacity=".5" strokeDasharray="3 6" />)}
      {candles.map((y, i) => (
        <g key={i} className={`${i % 3 === 2 ? line : strong} pb-bob`} style={{ animationDelay: `${i * -0.4}s` }}>
          <line x1={700 + i * 40} x2={700 + i * 40} y1={y - 34} y2={y + 46} strokeOpacity=".7" />
          <rect x={692 + i * 40} y={y - 14} width="16" height="40" rx="2" fill="currentColor" fillOpacity=".25" />
        </g>
      ))}
      <path d={trend} className={line} strokeWidth="2" />
      <path d={trend} className={`${strong} pb-draft`} strokeWidth="2.5" pathLength={100} strokeDasharray="100" />
    </g>
  );
}

function Orbits() {
  return (
    <g strokeWidth="1.5" transform="translate(950 260)">
      {[0, 60, 120].map((r) => (
        <g key={r} transform={`rotate(${r})`}>
          {/* ring and electron turn together, so the electron stays on its orbit */}
          <g className="pb-spin-slow" style={{ animationDelay: `${r * -0.1}s` }}>
            <ellipse rx="210" ry="74" className={line} />
            <circle cx="210" cy="0" r="7" className={strong} fill="currentColor" stroke="none" />
            <circle cx="-210" cy="0" r="0.01" stroke="none" />
          </g>
        </g>
      ))}
      <circle r="26" className={strong} strokeOpacity=".7" />
      <circle r="8" className={strong} fill="currentColor" stroke="none" />
    </g>
  );
}

function Radar() {
  return (
    <g strokeWidth="1.5" transform="translate(960 260)">
      {[70, 140, 210].map((r) => <circle key={r} r={r} className={line} />)}
      <line x1="-230" x2="230" className={line} />
      <line y1="-230" y2="230" className={line} />
      <g className="pb-spin">
        <path d="M0 0 L210 0 A210 210 0 0 0 148 -148 Z" className={strong} fill="currentColor" fillOpacity=".18" stroke="none" />
        <line x2="210" className={strong} strokeWidth="2" />
      </g>
      {[[120, -60], [-90, 110], [60, 150]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="5" className={`${strong} pb-blink`} fill="currentColor" stroke="none" />)}
    </g>
  );
}

function Warmth() {
  const lights = [[700, 18, 0], [780, 10, -3], [860, 24, -6], [940, 14, -1.5], [1010, 20, -4.5], [1090, 12, -7], [1150, 22, -2.5], [820, 8, -5], [990, 9, -8]];
  return (
    <g stroke="none">
      {lights.map(([x, r, d], i) => (
        <circle key={i} cx={x} cy={500} r={r} className={`${strong} pb-rise`} fill="currentColor" fillOpacity=".35" style={{ animationDelay: `${d}s` }} />
      ))}
      <path d="M660 470 H1200" className={line} stroke="currentColor" strokeWidth="1.5" />
    </g>
  );
}

function Contours() {
  return (
    <g strokeWidth="1.2" className="pb-drift">
      {Array.from({ length: 9 }, (_, i) => (
        <ellipse key={i} cx={980 + i * 6} cy={250 - i * 4} rx={60 + i * 34} ry={36 + i * 22} transform={`rotate(-14 ${980 + i * 6} ${250 - i * 4})`} className={i === 4 ? strong : line} strokeOpacity={i === 4 ? 0.6 : 1} />
      ))}
    </g>
  );
}

const SCENE_ART: Record<Scene, { accent: string; Art: () => React.ReactElement }> = {
  pipeline: { accent: "#5fd1c9", Art: Pipeline },
  code: { accent: "#8fb8ff", Art: Code },
  pulse: { accent: "#ff8b94", Art: Pulse },
  route: { accent: "#e0a35b", Art: Route },
  blueprint: { accent: "#7fb2e5", Art: Blueprint },
  curves: { accent: "#c9a7ff", Art: Curves },
  chart: { accent: "#6fdc9b", Art: Chart },
  orbits: { accent: "#a5b4fc", Art: Orbits },
  radar: { accent: "#7ee0a8", Art: Radar },
  warmth: { accent: "#f2b880", Art: Warmth },
  contours: { accent: "#9fb3c8", Art: Contours },
};
