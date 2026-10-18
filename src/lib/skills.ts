// Keyword dictionaries for matching resumes to jobs: hard skills (with synonyms), soft skills,
// degree levels and action verbs. Shared by the role match and the ATS check.

/** Canonical skill name -> pattern. Patterns are case-insensitive and match whole words. */
const HARD: Record<string, string> = {
  // Languages
  Python: String.raw`\bpython\b`,
  SQL: String.raw`\bsql\b`,
  R: String.raw`(?-i:\bR\b)(?![&/-])`,
  Java: String.raw`\bjava\b(?!\s*script)`,
  Scala: String.raw`\bscala\b`,
  Go: String.raw`\bgolang\b`,
  Rust: String.raw`\brust\b`,
  "C++": String.raw`\bc\+\+`,
  "C#": String.raw`\bc#`,
  JavaScript: String.raw`\bjavascript\b|\bnode\.?js\b`,
  TypeScript: String.raw`\btypescript\b`,
  Bash: String.raw`\bbash\b|\bshell scripting\b`,
  SAS: String.raw`(?-i:\bSAS\b)`,
  MATLAB: String.raw`\bmatlab\b`,
  // Data engineering
  Spark: String.raw`\b(apache )?spark\b|\bpyspark\b|\bspark sql\b`,
  Kafka: String.raw`\bkafka\b`,
  Flink: String.raw`\bflink\b`,
  Airflow: String.raw`\bairflow\b`,
  Dagster: String.raw`\bdagster\b`,
  Prefect: String.raw`\bprefect\b`,
  dbt: String.raw`\bdbt\b`,
  Hadoop: String.raw`\bhadoop\b|\bhdfs\b`,
  Hive: String.raw`\bhive\b`,
  "ETL/ELT": String.raw`\betl\b|\belt\b|extract,? transform,? (and )?load`,
  "Data pipelines": String.raw`\bdata pipelines?\b|\bpipelines?\b`,
  "Data modeling": String.raw`\bdata model(l)?ing\b|\bdimensional model(l)?ing\b|\bstar schema\b|\bdata models?\b`,
  "Data warehousing": String.raw`\bdata warehous(e|es|ing)\b|\bdwh\b`,
  "Data lake": String.raw`\bdata lakes?\b|\blakehouse\b`,
  "Data quality": String.raw`\bdata quality\b|\bdata validation\b`,
  "Data governance": String.raw`\bdata governance\b`,
  "Streaming": String.raw`\bstreaming\b|\breal[- ]time data\b`,
  "Batch processing": String.raw`\bbatch processing\b|\bbatch jobs?\b`,
  // Warehouses & databases
  Snowflake: String.raw`\bsnowflake\b`,
  BigQuery: String.raw`\bbig ?query\b`,
  Redshift: String.raw`\bredshift\b`,
  Databricks: String.raw`\bdatabricks\b`,
  PostgreSQL: String.raw`\bpostgres(ql)?\b`,
  MySQL: String.raw`\bmysql\b`,
  "SQL Server": String.raw`\bsql server\b|\bmssql\b|\bt-sql\b`,
  Oracle: String.raw`\boracle\b`,
  MongoDB: String.raw`\bmongo(db)?\b`,
  Cassandra: String.raw`\bcassandra\b`,
  Redis: String.raw`\bredis\b`,
  Elasticsearch: String.raw`\belastic ?search\b`,
  NoSQL: String.raw`\bnosql\b`,
  "Delta Lake": String.raw`\bdelta lake\b`,
  Iceberg: String.raw`\b(apache )?iceberg\b`,
  // Cloud & DevOps
  AWS: String.raw`\baws\b|\bamazon web services\b`,
  GCP: String.raw`\bgcp\b|\bgoogle cloud\b`,
  Azure: String.raw`\bazure\b`,
  S3: String.raw`\bs3\b`,
  Lambda: String.raw`\baws lambda\b|\blambda functions?\b`,
  Glue: String.raw`\baws glue\b`,
  EMR: String.raw`\bemr\b`,
  Docker: String.raw`\bdocker\b|\bcontaineri[sz]ation\b`,
  Kubernetes: String.raw`\bkubernetes\b|\bk8s\b`,
  Terraform: String.raw`\bterraform\b`,
  "CI/CD": String.raw`\bci ?/ ?cd\b|\bcontinuous (integration|delivery|deployment)\b|\bgithub actions\b|\bjenkins\b`,
  Git: String.raw`\bgit\b|\bgithub\b|\bgitlab\b|\bversion control\b`,
  Linux: String.raw`\blinux\b|\bunix\b`,
  "REST APIs": String.raw`\brest(ful)? apis?\b|\bapis?\b`,
  FastAPI: String.raw`\bfastapi\b`,
  Flask: String.raw`\bflask\b`,
  Django: String.raw`\bdjango\b`,
  // ML & AI
  "Machine learning": String.raw`\bmachine learning\b|\bml models?\b`,
  "Deep learning": String.raw`\bdeep learning\b|\bneural networks?\b`,
  PyTorch: String.raw`\bpytorch\b`,
  TensorFlow: String.raw`\btensorflow\b|\bkeras\b`,
  "scikit-learn": String.raw`\bscikit-learn\b|\bsklearn\b`,
  XGBoost: String.raw`\bxgboost\b|\blightgbm\b|\bgradient boosting\b`,
  LLMs: String.raw`\bllms?\b|\blarge language models?\b|\bgenai\b|\bgenerative ai\b`,
  NLP: String.raw`\bnlp\b|\bnatural language processing\b`,
  "Computer vision": String.raw`\bcomputer vision\b`,
  RAG: String.raw`\brag\b|\bretrieval[- ]augmented\b`,
  MLOps: String.raw`\bmlops\b|\bmodel deployment\b`,
  MLflow: String.raw`\bmlflow\b`,
  "Feature engineering": String.raw`\bfeature engineering\b`,
  Statistics: String.raw`\bstatistic(s|al)\b|\bhypothesis testing\b|\bregression\b`,
  "A/B testing": String.raw`\ba/?b test(s|ing)?\b|\bexperimentation\b`,
  Forecasting: String.raw`\bforecasting\b|\btime[- ]series\b`,
  // Analysis & BI
  Pandas: String.raw`\bpandas\b`,
  NumPy: String.raw`\bnumpy\b`,
  Jupyter: String.raw`\bjupyter\b`,
  Excel: String.raw`(?-i:\bExcel\b)(?! (at|in)\b)|\bspreadsheets?\b`,
  Tableau: String.raw`\btableau\b`,
  "Power BI": String.raw`\bpower ?bi\b`,
  Looker: String.raw`\blooker\b`,
  "Data visualization": String.raw`\bdata visuali[sz]ation\b|\bdashboards?\b`,
  KPIs: String.raw`\bkpis?\b|\bmetrics\b`,
  "Business intelligence": String.raw`\bbusiness intelligence\b|\bbi\b`,
  Analytics: String.raw`\banalytics\b`,
};

const SOFT: Record<string, string> = {
  Communication: String.raw`\bcommunicat(e|ion|ing)\b`,
  Collaboration: String.raw`\bcollaborat(e|ion|ive|ing)\b|\bteamwork\b`,
  "Cross-functional": String.raw`\bcross[- ]functional\b`,
  Leadership: String.raw`\blead(ership)?\b|\bled\b`,
  Mentoring: String.raw`\bmentor(ing|ed)?\b|\bcoach(ing|ed)?\b`,
  "Stakeholder management": String.raw`\bstakeholders?\b`,
  "Problem solving": String.raw`\bproblem[- ]solving\b|\bsolve (complex )?problems\b`,
  Ownership: String.raw`\bownership\b|\bowned\b|\bend[- ]to[- ]end\b`,
  "Attention to detail": String.raw`\battention to detail\b|\bdetail[- ]oriented\b`,
  "Time management": String.raw`\btime management\b|\bprioriti[sz](e|ation)\b`,
  Presentation: String.raw`\bpresent(ed|ing|ation)s?\b`,
  Documentation: String.raw`\bdocument(ation|ed|ing)\b`,
  Adaptability: String.raw`\badaptab(le|ility)\b|\bfast[- ]paced\b`,
};

/** Splits a pattern at its top-level "|" and runs (?-i:...) alternatives case-sensitively (JS regex has no inline flags). */
function compile(source: string): (text: string) => number {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "\\") i++;
    else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "|" && depth === 0) {
      parts.push(source.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(source.slice(start));
  const sensitive: RegExp[] = [];
  const insensitive: string[] = [];
  for (const p of parts) {
    if (!p.startsWith("(?-i:")) {
      insensitive.push(p);
      continue;
    }
    // Find the group's own closing parenthesis, then keep whatever follows it (e.g. a lookahead).
    let d = 1;
    let j = 5;
    for (; j < p.length && d > 0; j++) {
      if (p[j] === "\\") j++;
      else if (p[j] === "(") d++;
      else if (p[j] === ")") d--;
    }
    sensitive.push(new RegExp(p.slice(5, j - 1) + p.slice(j), "g"));
  }
  const ci = insensitive.length ? new RegExp(insensitive.join("|"), "gi") : null;
  return (text) => (ci ? (text.match(ci)?.length ?? 0) : 0) + sensitive.reduce((n, r) => n + (text.match(r)?.length ?? 0), 0);
}

const hardCounters = Object.entries(HARD).map(([name, src]) => [name, compile(src)] as const);
const softCounters = Object.entries(SOFT).map(([name, src]) => [name, compile(src)] as const);

/** Generic terms that only count when the job itself stresses them. */
const BROAD = new Set(["Data pipelines", "REST APIs", "Analytics", "KPIs", "Business intelligence", "Data visualization", "Streaming"]);

export type Keyword = { name: string; count: number; kind: "hard" | "soft" };

/** Keywords in a job description with how often they appear (more mentions = more important). */
export function jobKeywords(text: string): Keyword[] {
  const out: Keyword[] = [];
  for (const [name, count] of hardCounters) {
    const n = count(text);
    if (n > 0 && (!BROAD.has(name) || n >= 2)) out.push({ name, count: n, kind: "hard" });
  }
  for (const [name, count] of softCounters) {
    const n = count(text);
    if (n > 0) out.push({ name, count: n, kind: "soft" });
  }
  return out.sort((a, b) => b.count - a.count);
}

const hardByName = new Map(hardCounters);
const softByName = new Map(softCounters);

/** How many times a named skill appears in some text (uses the same synonyms as job matching). */
export function mentions(name: string, text: string): number {
  const counter = hardByName.get(name) ?? softByName.get(name);
  if (counter) return counter(text);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`(^|[^a-z0-9])${escaped}(?![a-z0-9])`, "gi"))?.length ?? 0;
}

/** Canonical name for a skill if the dictionary knows it ("pyspark" -> "Spark"), else the input. */
export function canonical(skill: string): string {
  for (const [name, count] of hardCounters) if (name.toLowerCase() === skill.toLowerCase() || count(skill) > 0) return name;
  return skill;
}

/** 0 none · 1 associate/diploma · 2 bachelor's · 3 master's · 4 doctorate. */
export function degreeLevel(text: string): number {
  if (/\b(ph\.?\s?d|doctorate|doctoral)\b/i.test(text)) return 4;
  if (/\b(master'?s?|m\.?s\.?c?|m\.?eng|mba|m\.?a\.?)(\b|\s)/i.test(text)) return 3;
  if (/\b(bachelor'?s?|b\.?s\.?c?|b\.?a\.?|b\.?eng|b\.?tech|undergraduate degree|bs\/ms)\b/i.test(text)) return 2;
  if (/\b(associate'?s? degree|diploma)\b/i.test(text)) return 1;
  return 0;
}

/** Minimum degree a job asks for, if it states one. */
export function requiredDegree(jd: string): number {
  const m = jd.match(/[^.\n]*\b(degree|bachelor|master|ph\.?\s?d|bs\/ms|b\.?s\.?|m\.?s\.?)\b[^.\n]*/gi);
  if (!m) return 0;
  return Math.min(...m.map(degreeLevel).filter((n) => n > 0), 9) % 9;
}

const VERBS =
  "accelerated achieved analyzed architected automated built championed collaborated consolidated created cut decreased defined delivered deployed designed developed drove eliminated enabled engineered established evaluated expanded generated grew identified implemented improved increased integrated introduced launched led maintained managed migrated modeled monitored optimized orchestrated owned partnered piloted produced reduced refactored replaced resolved restructured saved scaled shipped simplified spearheaded standardized streamlined supported tested trained transformed tuned unified upgraded validated wrote applied operated processed recovered tracked transferred visualized";
const ACTION = new Set(VERBS.split(" "));

/** True when a bullet opens with a strong action verb (not "Responsible for…"). */
export function startsWithAction(bullet: string) {
  const first = bullet.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  return ACTION.has(first);
}
