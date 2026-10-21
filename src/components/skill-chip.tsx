import { ChartColumn, Cloud, Code, Database, MessageSquare, Palette, Sheet } from "lucide-react";
import { skillIcon, type Generic } from "@/lib/skill-icons";

const GENERIC: Record<Generic, typeof Cloud> = { cloud: Cloud, sheet: Sheet, database: Database, design: Palette, chat: MessageSquare, code: Code, chart: ChartColumn };

/** A skill's icon: the tool's own logo, a neutral icon for its kind, or nothing. Decorative (the name is always shown). */
export function SkillGlyph({ skill, size = 16 }: { skill: string; size?: number }) {
  const icon = skillIcon(skill);
  if (!icon) return null;
  if (icon.kind === "generic") {
    const Icon = GENERIC[icon.icon];
    return <Icon aria-hidden="true" className="shrink-0 text-muted" style={{ width: size, height: size }} strokeWidth={1.75} />;
  }
  return (
    <svg aria-hidden="true" role="img" viewBox="0 0 24 24" width={size} height={size} className="shrink-0" fill={icon.color}>
      <path d={icon.path} />
    </svg>
  );
}

/** A skill pill with its icon. */
export function SkillChip({ skill, className = "" }: { skill: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm ${className}`}>
      <SkillGlyph skill={skill} />
      {skill}
    </span>
  );
}
