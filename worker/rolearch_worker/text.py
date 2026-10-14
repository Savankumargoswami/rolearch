"""Text helpers: HTML -> plain text, summaries, skills, level, field, visa, years."""

from __future__ import annotations

import html
import re
from html.parser import HTMLParser


class _Text(HTMLParser):
    BLOCK = {"p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "ul", "ol", "section"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        elif tag in self.BLOCK:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        elif tag in self.BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.out.append(data)


def html_to_text(raw: str | None) -> str:
    """Handles plain HTML and Greenhouse's entity-escaped HTML."""
    if not raw:
        return ""
    if "&lt;" in raw and "<" not in raw:
        raw = html.unescape(raw)
    p = _Text()
    p.feed(raw)
    text = "".join(p.out).replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


_role_first = re.compile(
    r"\b(we('|’)re looking for|we are looking for|we('|’)re seeking|we are seeking|we('|’)re hiring|you('|’)ll|you will|"
    r"in this role|this role|the role|as (a|an|the) [\w/ -]{3,40}(,| you)|your (main |key )?responsibilit)",
    re.I,
)
_fluff = re.compile(
    r"\b(best work of your life|brightest minds|status quo|change the world|join (our|the) (team|table|journey|mission)|"
    r"equal opportunity|we('|’)re (proud|committed)|our (mission|vision|values|culture))\b",
    re.I,
)


def summarize(text: str, limit: int = 280) -> str:
    """One sentence about the role itself. Empty when only company boilerplate is found."""
    sentences = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", text))
    ok = [s for s in sentences if 50 <= len(s) <= 360 and not _fluff.search(s)]
    pick = next((s for s in ok if _role_first.search(s)), "")
    if len(pick) > limit:
        pick = pick[: limit - 1].rsplit(" ", 1)[0] + "…"
    return pick


# Canonical skill name -> regex. Order is irrelevant; ranking is by mention count.
SKILLS: dict[str, str] = {
    "Python": r"\bpython\b", "SQL": r"\bsql\b", "Spark": r"\b(apache )?spark\b|\bpyspark\b", "Kafka": r"\bkafka\b",
    "Airflow": r"\bairflow\b", "dbt": r"\bdbt\b", "Snowflake": r"\bsnowflake\b", "BigQuery": r"\bbigquery\b",
    "Redshift": r"\bredshift\b", "Databricks": r"\bdatabricks\b", "AWS": r"\baws\b|amazon web services",
    "GCP": r"\bgcp\b|google cloud", "Azure": r"\bazure\b", "Kubernetes": r"\bkubernetes\b|\bk8s\b", "Docker": r"\bdocker\b",
    "Terraform": r"\bterraform\b", "Go": r"\bgolang\b|\bgo(?= ?(,|/|and\b|or\b|\)))", "Java": r"\bjava\b(?!script)",
    "Scala": r"\bscala\b", "Rust": r"\brust\b", "TypeScript": r"\btypescript\b", "React": r"\breact\b",
    "PyTorch": r"\bpytorch\b", "TensorFlow": r"\btensorflow\b", "scikit-learn": r"scikit-learn|\bsklearn\b",
    "Pandas": r"\bpandas\b", "Tableau": r"\btableau\b", "Looker": r"\blooker\b", "Power BI": r"\bpower ?bi\b",
    "Statistics": r"\bstatistic(s|al)\b", "Machine learning": r"\bmachine learning\b", "Deep learning": r"\bdeep learning\b",
    "LLMs": r"\bllms?\b|large language models?", "NLP": r"\bnlp\b|natural language processing",
    "Computer vision": r"\bcomputer vision\b", "MLOps": r"\bmlops\b", "Flink": r"\bflink\b", "Postgres": r"\bpostgres(ql)?\b",
    "MongoDB": r"\bmongo(db)?\b", "Elasticsearch": r"\belasticsearch\b", "Delta Lake": r"\bdelta lake\b",
    "Iceberg": r"\b(apache )?iceberg\b", "Dagster": r"\bdagster\b", "MLflow": r"\bmlflow\b", "A/B testing": r"\ba/b test",
    "Excel": r"(?-i:\bExcel\b)(?! (at|in)\b)",
}
_skill_re = {k: re.compile(v, re.I) for k, v in SKILLS.items()}


def extract_skills(text: str, limit: int = 6) -> list[str]:
    counts = {k: len(r.findall(text)) for k, r in _skill_re.items()}
    found = [k for k, n in sorted(counts.items(), key=lambda kv: -kv[1]) if n]
    return found[:limit]


def level_of(title: str) -> str:
    t = title.lower()
    if re.search(r"\b(intern|internship|graduate|junior|jr\.?|entry|associate|apprentice|trainee)\b", t):
        return "entry"
    if re.search(r"\b(staff|principal|lead|head|director|manager|vp|chief|distinguished)\b", t):
        return "lead"
    if re.search(r"\b(senior|sr\.?|iii|iv)\b", t):
        return "senior"
    return "mid"


_years = re.compile(r"(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years?|yrs?)\b(?:\s+of)?(?:\s+\w+){0,4}\s+experience", re.I)


def years_required(text: str) -> int:
    m = _years.search(text)
    return min(int(m.group(1)), 15) if m else 0


_no_visa = re.compile(r"(not|unable to|cannot|can't|won't|will not|do not|don't)\s+(be able to\s+)?(offer|provide|sponsor|support)\w*\s+(\w+\s+){0,3}(visa|sponsorship)|no (visa )?sponsorship|without (the need for )?sponsorship", re.I)
_visa = re.compile(r"visa sponsorship|sponsor (your |a )?(work )?visa|relocation (and|&) visa|visa support", re.I)


def visa_offered(text: str) -> bool:
    return bool(_visa.search(text)) and not _no_visa.search(text)


# The launch field: data, ML and analytics roles. A role noun must come with a data/ML qualifier.
_field = re.compile(
    r"\bdata (engineer|engineering|scientist|science|analyst|analytics|architect|platform|infrastructure|warehouse|modeler|steward)"
    r"|\b(machine learning|ml|ai|applied ai|deep learning|llm|nlp|computer vision|mlops|genai|generative ai|inference|"
    r"research|applied|decision|quantitative|perception|ranking|recommendation|search relevance) "
    r"(engineer|scientist|researcher|architect|developer)"
    r"|\b(analytics|bi|business intelligence|insights|product analytics|data visualization) "
    r"(engineer|analyst|developer|lead|manager|specialist)"
    r"|\b(data|analytics|ml|machine learning) (intern|internship|engineering manager)\b"
    r"|\bdata analytics\b|\bstatistician\b|\bmachine learning\b|\bml engineer\b|\bmlops\b|\bdata scientist\b"
    r"|\b(fraud|risk|product|marketing|growth|business) data analyst\b",
    re.I,
)
_not_field = re.compile(
    r"\b(data ?cent(er|re)|datacenter|sales|account executive|recruit\w*|legal|counsel|talent|employer branding|"
    r"compliance|payroll|tax|treasury|procurement|facilities|data protection officer)\b",
    re.I,
)


def in_launch_field(title: str) -> bool:
    return bool(_field.search(title)) and not _not_field.search(title)


def clean_title(title: str, company: str) -> str:
    """'Grupo QuintoAndar | Staff Data Engineer' -> 'Staff Data Engineer'."""
    t = re.sub(r"\s+", " ", title).strip()
    parts = re.split(r"\s+[|]\s+", t)
    if len(parts) == 2 and company.lower().split()[0] in parts[0].lower():
        t = parts[1]
    return t
