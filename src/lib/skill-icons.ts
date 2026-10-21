// Icons for skills and tools: the real brand mark from Simple Icons (CC0, simpleicons.org) when there is one,
// otherwise a neutral icon for the kind of tool (cloud, spreadsheet, database, ...), otherwise nothing.
// Some brands (Microsoft, Amazon, Adobe, Salesforce, Slack) have asked Simple Icons not to carry their marks,
// so those get the neutral icon.
import "server-only";
import * as simpleIcons from "simple-icons";

export type Generic = "cloud" | "sheet" | "database" | "design" | "chat" | "code" | "chart";
export type SkillIcon = { kind: "brand"; title: string; path: string; color: string } | { kind: "generic"; icon: Generic } | null;

type Simple = { title: string; slug: string; hex: string; path: string };

let bySlug: Map<string, Simple> | null = null;
function slugs(): Map<string, Simple> {
  if (!bySlug) {
    bySlug = new Map();
    for (const v of Object.values(simpleIcons as unknown as Record<string, Simple>)) {
      if (v && typeof v === "object" && "slug" in v && "path" in v) bySlug.set(v.slug, v);
    }
  }
  return bySlug;
}

// What people write -> Simple Icons slug.
const ALIAS: Record<string, string> = {
  airflow: "apacheairflow", "apache airflow": "apacheairflow", spark: "apachespark", pyspark: "apachespark", "apache spark": "apachespark",
  kafka: "apachekafka", "apache kafka": "apachekafka", hadoop: "apachehadoop", java: "openjdk", "c#": "dotnet", ".net": "dotnet", "asp.net": "dotnet",
  html: "html5", css3: "css", "next.js": "nextdotjs", nextjs: "nextdotjs", vue: "vuedotjs", "vue.js": "vuedotjs", node: "nodedotjs", nodejs: "nodedotjs",
  "node.js": "nodedotjs", gcp: "googlecloud", "google cloud platform": "googlecloud", bigquery: "googlebigquery", "google bigquery": "googlebigquery",
  sklearn: "scikitlearn", "scikit-learn": "scikitlearn", k8s: "kubernetes", postgres: "postgresql", golang: "go", js: "javascript", ts: "typescript",
  "google sheets": "googlesheets", rails: "rubyonrails", "ruby on rails": "rubyonrails", spring: "springboot", "spring boot": "springboot", mongo: "mongodb",
  elastic: "elasticsearch", "github actions": "githubactions", "hugging face": "huggingface", claude: "anthropic", "sap s/4hana": "sap", "s/4hana": "sap",
  "google analytics": "googleanalytics", "google ads": "googleads", "react native": "react", reactjs: "react", "react.js": "react", "vue 3": "vuedotjs",
  "tailwind": "tailwindcss", "tailwind css": "tailwindcss", "unreal": "unrealengine", "unreal engine": "unrealengine", "jupyter notebook": "jupyter",
};

// Brands without a usable mark, and generic skills, by kind.
const GENERIC: [RegExp, Generic][] = [
  [/^(aws|amazon web services|azure|microsoft azure|ec2|s3|lambda|aws lambda|cloud computing|oracle cloud|ibm cloud|heroku)$/i, "cloud"],
  [/^(excel|microsoft excel|ms excel|spreadsheets?|google workspace|microsoft office|ms office|office 365|microsoft 365)$/i, "sheet"],
  [/^(power ?bi|tableau|qlik|qlik ?sense|looker studio|data visualization|dashboards?|reporting|analytics)$/i, "chart"],
  [/^(sql|t-?sql|pl\/sql|nosql|sql server|microsoft sql server|oracle|oracle database|databases?|data modeling|dbt|etl|data warehousing)$/i, "database"],
  [/^(photoshop|adobe photoshop|illustrator|adobe illustrator|indesign|adobe xd|after effects|premiere( pro)?|adobe creative (suite|cloud)|canva|ui design|ux design|ui\/ux)$/i, "design"],
  [/^(slack|microsoft teams|teams|zoom|outlook|microsoft outlook)$/i, "chat"],
  [/^(salesforce|crm|sales ?force|dynamics 365|microsoft dynamics|servicenow|workday|sap successfactors)$/i, "chart"],
  [/^(c|vba|bash|shell|shell scripting|powershell|matlab|sas|stata|solidworks|labview|fortran|cobol|assembly|perl)$/i, "code"],
];

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
const toSlug = (s: string) => s.toLowerCase().replace(/\+/g, "plus").replace(/#/g, "sharp").replace(/\./g, "dot").replace(/[^a-z0-9]/g, "");

/** Colour that stays readable on a light card: very light brand colours fall back to ink. */
function readable(hex: string): string {
  const n = Number.parseInt(hex, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.82 ? "#0e1f2f" : `#${hex}`;
}

const cache = new Map<string, SkillIcon>();

export function skillIcon(skill: string): SkillIcon {
  const key = norm(skill);
  if (cache.has(key)) return cache.get(key)!;
  let out: SkillIcon = null;
  const icon = slugs().get(ALIAS[key] ?? toSlug(key));
  if (icon) out = { kind: "brand", title: icon.title, path: icon.path, color: readable(icon.hex) };
  else {
    const g = GENERIC.find(([re]) => re.test(key));
    if (g) out = { kind: "generic", icon: g[1] };
  }
  cache.set(key, out);
  return out;
}
