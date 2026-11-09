import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { TESTED } from "@/lib/skill-graph";

/** Links to the free skill tests that cover skills on this page. */
export function SkillTestLinks({ skills }: { skills: string[] }) {
  const tests = [...new Set(skills.map((s) => TESTED[s]).filter(Boolean))];
  if (!tests.length) return null;
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <BadgeCheck aria-hidden="true" className="size-4 text-signal-ink" />
      Prove it with a free skill badge:
      {tests.map((x, i) => (
        <span key={x}>
          <Link href="/skills" className="font-medium underline underline-offset-4">
            {x}
          </Link>
          {i < tests.length - 1 ? "," : ""}
        </span>
      ))}
    </p>
  );
}
