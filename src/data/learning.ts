// Free learning resources per skill. Curated; a weekly job checks links in production.
export type Resource = { course: { name: string; by: string; url: string }; book?: string };

export const learning: Record<string, Resource> = {
  dbt: { course: { name: "dbt Fundamentals", by: "dbt Labs", url: "https://learn.getdbt.com" }, book: "Analytics Engineering with SQL and dbt (Machado, Russa)" },
  Snowflake: { course: { name: "Hands-On Essentials", by: "Snowflake", url: "https://learn.snowflake.com" }, book: "Snowflake: The Definitive Guide (Avila)" },
  Tableau: { course: { name: "Free training videos", by: "Tableau", url: "https://www.tableau.com/learn/training" }, book: "Storytelling with Data (Knaflic)" },
  Airflow: { course: { name: "Airflow courses", by: "Astronomer Academy", url: "https://academy.astronomer.io" }, book: "Data Pipelines with Apache Airflow (Harenslak, de Ruiter)" },
  PyTorch: { course: { name: "Practical Deep Learning for Coders", by: "fast.ai", url: "https://course.fast.ai" }, book: "Deep Learning with PyTorch (Stevens, Antiga, Viehmann)" },
  Kubernetes: { course: { name: "Kubernetes Basics", by: "kubernetes.io", url: "https://kubernetes.io/docs/tutorials/kubernetes-basics/" }, book: "Kubernetes: Up and Running (Burns, Beda, Hightower, Evenson)" },
  Terraform: { course: { name: "Terraform tutorials", by: "HashiCorp", url: "https://developer.hashicorp.com/terraform/tutorials" }, book: "Terraform: Up & Running (Brikman)" },
  Go: { course: { name: "A Tour of Go", by: "go.dev", url: "https://go.dev/tour" }, book: "The Go Programming Language (Donovan, Kernighan)" },
  Azure: { course: { name: "Azure Data Fundamentals path", by: "Microsoft Learn", url: "https://learn.microsoft.com/training/" }, book: "Fundamentals of Data Engineering (Reis, Housley)" },
  Statistics: { course: { name: "Introduction to Probability and Statistics", by: "MIT OpenCourseWare", url: "https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/" }, book: "Practical Statistics for Data Scientists (Bruce, Bruce, Gedeck)" },
  Looker: { course: { name: "Looker training", by: "Google Cloud Skills Boost", url: "https://www.cloudskillsboost.google" }, book: "Storytelling with Data (Knaflic)" },
  GCP: { course: { name: "Google Cloud Skills Boost", by: "Google", url: "https://www.cloudskillsboost.google" }, book: "Fundamentals of Data Engineering (Reis, Housley)" },
  // The most-requested skills in the live feed
  "Machine learning": { course: { name: "Machine Learning Crash Course", by: "Google", url: "https://developers.google.com/machine-learning/crash-course" }, book: "Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow (Géron)" },
  LLMs: { course: { name: "LLM Course", by: "Hugging Face", url: "https://huggingface.co/learn/llm-course" }, book: "Build a Large Language Model (From Scratch) (Raschka)" },
  "Deep learning": { course: { name: "Practical Deep Learning for Coders", by: "fast.ai", url: "https://course.fast.ai" }, book: "Deep Learning (Goodfellow, Bengio, Courville), free online" },
  NLP: { course: { name: "LLM Course", by: "Hugging Face", url: "https://huggingface.co/learn/llm-course" }, book: "Speech and Language Processing (Jurafsky, Martin), free online draft" },
  "A/B testing": { course: { name: "A/B Testing", by: "Udacity (free course)", url: "https://www.udacity.com/course/ab-testing--ud257" }, book: "Trustworthy Online Controlled Experiments (Kohavi, Tang, Xu)" },
  Databricks: { course: { name: "Free self-paced training", by: "Databricks Academy", url: "https://www.databricks.com/learn/training/home" }, book: "Learning Spark (Damji et al.)" },
  BigQuery: { course: { name: "BigQuery courses", by: "Google Cloud Skills Boost", url: "https://www.cloudskillsboost.google" }, book: "Google BigQuery: The Definitive Guide (Lakshmanan, Tigani)" },
  TensorFlow: { course: { name: "TensorFlow tutorials", by: "tensorflow.org", url: "https://www.tensorflow.org/tutorials" }, book: "Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow (Géron)" },
  Kafka: { course: { name: "Free Kafka courses", by: "Confluent Developer", url: "https://developer.confluent.io/courses/" }, book: "Kafka: The Definitive Guide (Shapira et al.)" },
  Spark: { course: { name: "Spark quick start", by: "Apache Spark docs", url: "https://spark.apache.org/docs/latest/quick-start.html" }, book: "Learning Spark (Damji et al.)" },
  SQL: { course: { name: "Interactive SQL lessons", by: "SQLBolt", url: "https://sqlbolt.com" }, book: "SQL for Data Analysis (Tanimura)" },
  Python: { course: { name: "The Python Tutorial", by: "python.org", url: "https://docs.python.org/3/tutorial/" }, book: "Python for Data Analysis (McKinney), free online" },
  AWS: { course: { name: "Free digital training", by: "AWS Skill Builder", url: "https://skillbuilder.aws" }, book: "Data Engineering with AWS (Eagar)" },
  MLOps: { course: { name: "Made With ML", by: "Goku Mohandas", url: "https://madewithml.com" }, book: "Designing Machine Learning Systems (Huyen)" },
  Rust: { course: { name: "The Rust Programming Language", by: "rust-lang.org", url: "https://doc.rust-lang.org/book/" }, book: "The Rust Programming Language (Klabnik, Nichols), free online" },
  Scala: { course: { name: "Tour of Scala", by: "scala-lang.org", url: "https://docs.scala-lang.org/tour/tour-of-scala.html" }, book: "Programming in Scala (Odersky, Spoon, Venners)" },
  Java: { course: { name: "Learn Java", by: "dev.java", url: "https://dev.java/learn/" }, book: "Effective Java (Bloch)" },
  "Power BI": { course: { name: "Power BI learning paths", by: "Microsoft Learn", url: "https://learn.microsoft.com/training/powerplatform/power-bi" }, book: "Storytelling with Data (Knaflic)" },
  // Names used by the job matcher's skills dictionary
  PostgreSQL: { course: { name: "PostgreSQL tutorial", by: "postgresql.org", url: "https://www.postgresql.org/docs/current/tutorial.html" }, book: "PostgreSQL: Up and Running (Obe, Hsu)" },
  Pandas: { course: { name: "Pandas", by: "Kaggle Learn", url: "https://www.kaggle.com/learn/pandas" }, book: "Python for Data Analysis (McKinney), free online" },
  NumPy: { course: { name: "Learn NumPy", by: "numpy.org", url: "https://numpy.org/learn/" }, book: "Python for Data Analysis (McKinney), free online" },
  "scikit-learn": { course: { name: "Getting started", by: "scikit-learn.org", url: "https://scikit-learn.org/stable/getting_started.html" }, book: "Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow (Géron)" },
  "Feature engineering": { course: { name: "Feature Engineering", by: "Kaggle Learn", url: "https://www.kaggle.com/learn/feature-engineering" }, book: "Feature Engineering for Machine Learning (Zheng, Casari)" },
  "Data visualization": { course: { name: "Data Visualization", by: "Kaggle Learn", url: "https://www.kaggle.com/learn/data-visualization" }, book: "Storytelling with Data (Knaflic)" },
  Docker: { course: { name: "Get started with Docker", by: "Docker docs", url: "https://docs.docker.com/get-started/" }, book: "Docker Deep Dive (Poulton)" },
  MongoDB: { course: { name: "MongoDB University", by: "MongoDB", url: "https://learn.mongodb.com/" }, book: "MongoDB: The Definitive Guide (Bradshaw, Brazil, Chodorow)" },
  Redis: { course: { name: "Redis learning", by: "redis.io", url: "https://redis.io/learn" }, book: "Redis in Action (Carlson)" },
  Elasticsearch: { course: { name: "Free Elastic training", by: "Elastic", url: "https://www.elastic.co/training/free" }, book: "Elasticsearch in Action (Konda)" },
  Git: { course: { name: "Pro Git", by: "git-scm.com", url: "https://git-scm.com/book/en/v2" }, book: "Pro Git (Chacon, Straub), free online" },
  Linux: { course: { name: "Command line for beginners", by: "Ubuntu", url: "https://ubuntu.com/tutorials/command-line-for-beginners" }, book: "The Linux Command Line (Shotts), free online" },
  Bash: { course: { name: "Command line for beginners", by: "Ubuntu", url: "https://ubuntu.com/tutorials/command-line-for-beginners" }, book: "The Linux Command Line (Shotts), free online" },
  "CI/CD": { course: { name: "GitHub Actions quickstart", by: "GitHub Docs", url: "https://docs.github.com/en/actions/writing-workflows/quickstart" }, book: "Continuous Delivery (Humble, Farley)" },
  FastAPI: { course: { name: "FastAPI tutorial", by: "fastapi.tiangolo.com", url: "https://fastapi.tiangolo.com/tutorial/" }, book: "FastAPI (Lubanovic)" },
  TypeScript: { course: { name: "TypeScript handbook", by: "typescriptlang.org", url: "https://www.typescriptlang.org/docs/handbook/intro.html" }, book: "Effective TypeScript (Vanderkam)" },
  JavaScript: { course: { name: "The Modern JavaScript Tutorial", by: "javascript.info", url: "https://javascript.info/" }, book: "Eloquent JavaScript (Haverbeke), free online" },
  Dagster: { course: { name: "Getting started", by: "Dagster docs", url: "https://docs.dagster.io/getting-started" }, book: "Fundamentals of Data Engineering (Reis, Housley)" },
  MLflow: { course: { name: "MLflow docs", by: "mlflow.org", url: "https://mlflow.org/docs/latest/index.html" }, book: "Designing Machine Learning Systems (Huyen)" },
  RAG: { course: { name: "Short courses", by: "DeepLearning.AI", url: "https://www.deeplearning.ai/short-courses/" }, book: "AI Engineering (Huyen)" },
  Hadoop: { course: { name: "Hadoop documentation", by: "Apache Hadoop", url: "https://hadoop.apache.org/docs/stable/" }, book: "Hadoop: The Definitive Guide (White)" },
  "Data modeling": { course: { name: "dbt Fundamentals", by: "dbt Labs", url: "https://learn.getdbt.com" }, book: "The Data Warehouse Toolkit (Kimball, Ross)" },
  "Data warehousing": { course: { name: "Hands-On Essentials", by: "Snowflake", url: "https://learn.snowflake.com" }, book: "The Data Warehouse Toolkit (Kimball, Ross)" },
  "ETL/ELT": { course: { name: "dbt Fundamentals", by: "dbt Labs", url: "https://learn.getdbt.com" }, book: "Fundamentals of Data Engineering (Reis, Housley)" },
  ETL: { course: { name: "dbt Fundamentals", by: "dbt Labs", url: "https://learn.getdbt.com" }, book: "Fundamentals of Data Engineering (Reis, Housley)" },
  Postgres: { course: { name: "PostgreSQL tutorial", by: "postgresql.org", url: "https://www.postgresql.org/docs/current/tutorial.html" }, book: "PostgreSQL: Up and Running (Obe, Hsu)" },
  "Google Cloud": { course: { name: "Google Cloud Skills Boost", by: "Google", url: "https://www.cloudskillsboost.google" } },
  // Beyond tech: free courses from the organisations that own the tool or set the standard
  Excel: { course: { name: "Excel tutorials", by: "GCFGlobal", url: "https://edu.gcfglobal.org/en/excel/" } },
  "Google Workspace": { course: { name: "Google Workspace Learning Center", by: "Google", url: "https://support.google.com/a/users" } },
  Salesforce: { course: { name: "Trailhead", by: "Salesforce", url: "https://trailhead.salesforce.com/" } },
  SAP: { course: { name: "SAP Learning", by: "SAP", url: "https://learning.sap.com/" } },
  Jira: { course: { name: "Atlassian University", by: "Atlassian", url: "https://www.atlassian.com/university" } },
  Confluence: { course: { name: "Atlassian University", by: "Atlassian", url: "https://www.atlassian.com/university" } },
  Agile: { course: { name: "Agile Coach", by: "Atlassian", url: "https://www.atlassian.com/agile" } },
  SEO: { course: { name: "SEO Starter Guide", by: "Google Search Central", url: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide" } },
  "Digital marketing": { course: { name: "Google Skillshop", by: "Google", url: "https://skillshop.withgoogle.com/" } },
  "Email marketing": { course: { name: "Free courses", by: "HubSpot Academy", url: "https://academy.hubspot.com/courses" } },
  "Social media": { course: { name: "Free courses", by: "HubSpot Academy", url: "https://academy.hubspot.com/courses" } },
  "Lead generation": { course: { name: "Free courses", by: "HubSpot Academy", url: "https://academy.hubspot.com/courses" } },
  CRM: { course: { name: "Free courses", by: "HubSpot Academy", url: "https://academy.hubspot.com/courses" } },
  Accounting: { course: { name: "Accounting and financial statements", by: "Khan Academy", url: "https://www.khanacademy.org/economics-finance-domain/core-finance/accounting-and-financial-stateme" } },
  "Financial reporting": { course: { name: "Accounting and financial statements", by: "Khan Academy", url: "https://www.khanacademy.org/economics-finance-domain/core-finance/accounting-and-financial-stateme" } },
  GIS: { course: { name: "Esri training catalog", by: "Esri", url: "https://www.esri.com/training/catalog/search/" } },
  MATLAB: { course: { name: "MATLAB Onramp", by: "MathWorks", url: "https://matlabacademy.mathworks.com/details/matlab-onramp/gettingstarted" } },
  Cybersecurity: { course: { name: "Introduction to Cybersecurity", by: "Cisco Networking Academy", url: "https://www.netacad.com/courses/introduction-to-cybersecurity" } },
  "Generative AI": { course: { name: "Introduction to Generative AI", by: "Google Cloud Skills Boost", url: "https://www.cloudskillsboost.google/course_templates/536" } },
  Figma: { course: { name: "Figma Learn", by: "Figma", url: "https://help.figma.com/hc/en-us" } },
  HIPAA: { course: { name: "HIPAA training materials", by: "U.S. Dept. of Health & Human Services", url: "https://www.hhs.gov/hipaa/for-professionals/training/index.html" } },
  "Infection control": { course: { name: "Project Firstline", by: "CDC", url: "https://www.cdc.gov/project-firstline/" } },
  OSHA: { course: { name: "OSHA training resources", by: "OSHA", url: "https://www.osha.gov/training" } },
  "Workplace safety": { course: { name: "OSHA training resources", by: "OSHA", url: "https://www.osha.gov/training" } },
  Forklift: { course: { name: "Powered Industrial Trucks eTool", by: "OSHA", url: "https://www.osha.gov/etools/powered-industrial-trucks" } },
  "Bilingual Spanish": { course: { name: "Learn Spanish", by: "Duolingo", url: "https://www.duolingo.com/course/es/en/Learn-Spanish" } },
  French: { course: { name: "Learn French", by: "Duolingo", url: "https://www.duolingo.com/course/fr/en/Learn-French" } },
  German: { course: { name: "Learn German", by: "Duolingo", url: "https://www.duolingo.com/course/de/en/Learn-German" } },
  "Chinese (Mandarin)": { course: { name: "Learn Chinese", by: "Duolingo", url: "https://www.duolingo.com/course/zh/en/Learn-Chinese" } },
  Japanese: { course: { name: "Learn Japanese", by: "Duolingo", url: "https://www.duolingo.com/course/ja/en/Learn-Japanese" } },
  Portuguese: { course: { name: "Learn Portuguese", by: "Duolingo", url: "https://www.duolingo.com/course/pt/en/Learn-Portuguese" } },
};

/** Licenses and certifications: the official page on how to get one (these usually have a fee, so not "featured"). */
const OFFICIAL: Record<string, FreeLink> = {
  CDL: { label: "CDL requirements", by: "FMCSA (official)", url: "https://www.fmcsa.dot.gov/cdl", kind: "docs" },
  "RN license": { label: "NCLEX exam", by: "NCSBN (official)", url: "https://www.nclex.com/", kind: "docs" },
  LPN: { label: "NCLEX exam", by: "NCSBN (official)", url: "https://www.nclex.com/", kind: "docs" },
  "BLS/CPR": { label: "CPR and BLS classes", by: "American Red Cross", url: "https://www.redcross.org/take-a-class/cpr", kind: "docs" },
  ACLS: { label: "ACLS course options", by: "American Heart Association", url: "https://cpr.heart.org/en/courses/advanced-cardiovascular-life-support-course-options", kind: "docs" },
  "DOT regulations": { label: "CDL and driver rules", by: "FMCSA (official)", url: "https://www.fmcsa.dot.gov/cdl", kind: "docs" },
  Hazmat: { label: "OSHA training resources", by: "OSHA", url: "https://www.osha.gov/training", kind: "docs" },
  PPE: { label: "OSHA training resources", by: "OSHA", url: "https://www.osha.gov/training", kind: "docs" },
};

/** What kind of skill it is decides where free courses for it actually exist (edX has nothing on forklifts). */
type Kind = "tech" | "theory" | "office" | "business" | "health" | "trades" | "service" | "education" | "soft" | "language" | "none";
const KINDS: Record<Exclude<Kind, "tech">, string[]> = {
  theory: ["Statistics", "Machine learning", "Deep learning", "NLP", "Computer vision", "A/B testing", "Forecasting", "Financial modeling", "Mathematical modeling", "Pure mathematics"],
  office: ["Excel", "Microsoft Office", "SharePoint", "Google Workspace", "Data entry", "Office administration", "Scheduling", "QuickBooks", "Microsoft Teams"],
  business: [
    "Financial reporting", "Accounting", "GAAP", "CPA", "Accounts payable", "Accounts receivable", "Bookkeeping", "Payroll", "Budgeting", "Auditing",
    "Tax preparation", "Risk management", "Regulatory compliance", "Project management", "Agile", "Product management", "Process improvement", "Lean",
    "Six Sigma", "Root cause analysis", "Quality control", "ISO standards", "Stakeholder management", "Vendor management", "Contract negotiation",
    "Procurement", "Supply chain", "Inventory management", "Logistics", "Demand planning", "Production planning", "Sales", "B2B sales", "Lead generation",
    "CRM", "Customer success", "Marketing", "Digital marketing", "SEO", "Content writing", "Social media", "Email marketing", "Market research",
    "Brand management", "Public relations", "Graphic design", "Video editing", "Technical writing", "Recruiting", "HR administration", "Employee relations",
    "Compensation", "Legal research", "Contract management", "Litigation", "Paralegal", "KPI tracking", "Change management", "Strategic planning",
    "Operations management", "Business development", "Underwriting", "Banking", "Real estate", "Insurance", "Event planning", "Fundraising", "Grant writing",
    "Data analysis", "Data visualization", "Research", "Business analysis", "Investment analysis", "Account management", "Business strategy",
  ],
  health: [
    "Patient care", "RN license", "LPN", "CNA", "EMT", "BLS/CPR", "ACLS", "Electronic health records", "Medical terminology", "Medication administration",
    "Vital signs", "Phlebotomy", "Medical coding", "Medical billing", "HIPAA", "Infection control", "Case management", "Clinical research", "Pharmacy",
    "Laboratory techniques", "Mental health", "Counseling", "Social work", "Long-term care", "Pediatrics", "Oncology", "Critical care", "Telemetry",
    "Wound care", "Physical therapy", "Medical devices", "Biology", "Chemistry",
  ],
  trades: [
    "Forklift", "CDL", "Route planning", "Warehouse operations", "Manufacturing", "GD&T", "PLC", "Machining", "Welding", "Electrical systems", "HVAC",
    "Plumbing", "Carpentry", "Blueprint reading", "Equipment maintenance", "Troubleshooting", "OSHA", "Workplace safety", "Hazmat", "PPE", "GMP",
    "FDA regulations", "DOT regulations", "SOPs", "Food safety", "Food preparation", "Cleaning", "Driving", "Security operations", "Construction management",
  ],
  service: ["Customer service", "Customer experience", "Point of sale", "Merchandising", "Retail operations", "Hospitality"],
  education: ["Teaching", "Curriculum development", "Classroom management", "Special education", "Teaching license", "Instructional design"],
  soft: [
    "Communication", "Leadership", "Team management", "Problem solving", "Training and coaching", "Teamwork", "Time management", "Attention to detail",
    "Multitasking", "Adaptability", "Conflict resolution", "Critical thinking", "Presentation skills",
  ],
  language: ["Bilingual Spanish", "French", "German", "Chinese (Mandarin)", "Japanese", "Portuguese"],
  none: ["Physical stamina"],
};
const KIND_OF = new Map<string, Kind>(Object.entries(KINDS).flatMap(([k, list]) => list.map((s) => [s.toLowerCase(), k as Kind])));

function kindOf(skill: string): Kind {
  const known = KIND_OF.get(skill.toLowerCase());
  if (known) return known;
  // Skills from a job's own requirements (not in the dictionary): a best guess from the words.
  if (/nurs|patient|clinic|medic|health|care\b|therap|pharm|surg|icu|cpr/i.test(skill)) return "health";
  if (/licen[cs]e|certif|forklift|weld|electric|plumb|hvac|safety|osha|driv|warehouse|machin|mechanic|construct|maint/i.test(skill)) return "trades";
  if (/spanish|french|german|chinese|mandarin|japanese|portuguese|korean|arabic|italian|hindi|russian|language|fluen/i.test(skill)) return "language";
  if (/teach|classroom|curricul|student/i.test(skill)) return "education";
  if (/customer|guest|retail|cashier|hospitality|server|barista/i.test(skill)) return "service";
  if (/excel|word|outlook|powerpoint|office|spreadsheet|typing|calendar/i.test(skill)) return "office";
  if (/communicat|leader|team|organi[sz]|interpersonal|detail|time management|problem|motivat|initiative/i.test(skill)) return "soft";
  if (/account|financ|sales|market|manage|budget|audit|legal|compliance|procure|supply|recruit|hr\b|business|analys/i.test(skill)) return "business";
  return "tech";
}

/** Search words that find courses (the dictionary's names are labels, not queries). */
const SEARCH_AS: Record<string, string> = {
  "BLS/CPR": "BLS CPR",
  "RN license": "NCLEX RN",
  LPN: "LPN nursing",
  CNA: "certified nursing assistant",
  EMT: "EMT basic",
  CDL: "CDL commercial driver",
  "Teaching license": "teacher certification",
  "Chinese (Mandarin)": "Mandarin Chinese",
  "Bilingual Spanish": "Spanish",
  SOPs: "standard operating procedures",
  "KPI tracking": "KPIs key performance indicators",
  PPE: "personal protective equipment",
  GMP: "good manufacturing practice",
  "FDA regulations": "FDA regulations compliance",
  "DOT regulations": "DOT regulations",
  Go: "Golang",
  "ERP systems": "ERP",
  "IT support": "IT support technician",
  "Electronic health records": "electronic health records EHR",
  "Vital signs": "vital signs nursing",
  "Medication administration": "medication administration nursing",
  Driving: "defensive driving",
  Cleaning: "commercial cleaning janitorial",
  Research: "research methods",
  "Security operations": "security guard training",
  "Training and coaching": "coaching skills",
  "Long-term care": "long-term care nursing",
  "Critical care": "critical care nursing",
  Telemetry: "telemetry nursing",
  "GD&T": "GD&T geometric dimensioning and tolerancing",
  "HR administration": "human resources",
  LLMs: "large language models",
};

/** Platforms whose search came back with nothing relevant for that skill (checked Nov 2026), so their link is left out. */
const NOT_ON: Record<string, string[]> = {
  edX: ["GAAP", "Tax preparation", "Underwriting", "Accounts payable", "Accounts receivable", "CPA", "Go", "GraphQL", "Payroll", "dbt"],
  Alison: [
    "Adaptability", "CPA", "GAAP", "Litigation", "Multitasking", "Oncology", "RN license", "Recruiting", "Root cause analysis",
    "Attention to detail", "Counseling", "ACLS", "SEO", "Teamwork", "Underwriting",
  ],
  Coursera: [
    "ACLS", "Attention to detail", "Counseling", "German", "Multitasking", "Pediatrics", "Portuguese", "RN license", "Adaptability", "BLS/CPR",
    "Oncology", "French", "Merchandising",
  ],
};
/** Where the exact name finds nothing, a nearby search that does (checked Nov 2026). */
const ALSO: Record<string, FreeLink[]> = {
  Counseling: [{ label: "Counselling courses", by: "Alison (free)", url: "https://alison.com/courses?query=counselling", kind: "course" }],
  Oncology: [
    { label: "Cancer courses", by: "Coursera (free to audit)", url: "https://www.coursera.org/search?query=cancer", kind: "course" },
    { label: "Cancer care courses", by: "Alison (free)", url: "https://alison.com/courses?query=cancer%20care", kind: "course" },
  ],
  "Attention to detail": [{ label: "Soft skills courses", by: "Alison (free)", url: "https://alison.com/courses?query=soft%20skills", kind: "course" }],
  Multitasking: [{ label: "Soft skills courses", by: "Alison (free)", url: "https://alison.com/courses?query=soft%20skills", kind: "course" }],
  Adaptability: [{ label: "Soft skills courses", by: "Alison (free)", url: "https://alison.com/courses?query=soft%20skills", kind: "course" }],
};
const dropped = (skill: string, l: FreeLink) => Object.entries(NOT_ON).some(([site, skills]) => l.by.startsWith(site) && skills.includes(skill));

export type FreeLink = { label: string; by: string; url: string; kind: "course" | "video" | "docs" };

const q = (s: string) => encodeURIComponent(s);

const youtube = (query: string): FreeLink => ({ label: query, by: "YouTube", url: `https://www.youtube.com/results?search_query=${q(query)}`, kind: "video" });
const freeCodeCamp = (s: string): FreeLink => ({ label: `${s} on freeCodeCamp`, by: "freeCodeCamp", url: `https://www.youtube.com/@freecodecamp/search?query=${q(s)}`, kind: "video" });
const coursera = (s: string): FreeLink => ({ label: `${s} courses`, by: "Coursera (free to audit)", url: `https://www.coursera.org/search?query=${q(s)}`, kind: "course" });
const edx = (s: string): FreeLink => ({ label: `${s} courses`, by: "edX (free to audit)", url: `https://www.edx.org/search?q=${q(s)}`, kind: "course" });
const udemy = (s: string): FreeLink => ({ label: `Free ${s} courses`, by: "Udemy (free courses)", url: `https://www.udemy.com/courses/search/?price=price-free&q=${q(s)}`, kind: "course" });
const alison = (s: string): FreeLink => ({ label: `Free ${s} courses`, by: "Alison (free)", url: `https://alison.com/courses?query=${q(s)}`, kind: "course" });
const ocw = (s: string): FreeLink => ({ label: `${s} lectures`, by: "MIT OpenCourseWare", url: `https://ocw.mit.edu/search/?q=${q(s)}`, kind: "course" });

/**
 * Free ways to learn a skill: the curated course when we have one, the official page for a license, then searches on the
 * free platforms that actually teach that kind of skill (coding sites for tech, Alison and OSHA for trades, Coursera and
 * Alison for healthcare, Duolingo for languages), so a search never lands on an empty results page.
 */
export function freeResources(skill: string): { featured: Resource | null; links: FreeLink[] } {
  const featured = learning[skill] ?? null;
  const kind = kindOf(skill);
  const s = SEARCH_AS[skill] ?? skill;
  const byKind: Record<Kind, FreeLink[]> = {
    tech: [youtube(`${s} full course for beginners`), freeCodeCamp(s), coursera(s), edx(s), udemy(s)],
    theory: [youtube(`${s} full course`), coursera(s), edx(s), ocw(s)],
    office: [youtube(`${s} tutorial for beginners`), alison(s), coursera(s)],
    business: [youtube(`${s} explained for beginners`), coursera(s), edx(s), alison(s)],
    health: [youtube(`${s} training`), coursera(s), alison(s)],
    trades: [youtube(`${s} training`), alison(s)],
    service: [youtube(`${s} skills training`), alison(s), coursera(s)],
    education: [youtube(`${s} for teachers`), coursera(s), edx(s)],
    soft: [youtube(`how to improve ${s.toLowerCase()} at work`), coursera(`${s} skills`), alison(s)],
    language: [youtube(`learn ${s} for beginners`), coursera(`${s} language`)],
    none: [],
  };
  const links = [...(OFFICIAL[skill] ? [OFFICIAL[skill]] : []), ...byKind[kind].filter((l) => !dropped(skill, l)), ...(ALSO[skill] ?? [])];
  return { featured, links };
}

/** Skill test -> the topic its free courses are found under (test names are too long to search well). */
const TEST_TOPIC: Record<string, string> = {
  python: "Python", sql: "SQL", excel: "Excel", statistics: "Statistics", aws: "AWS", react: "React", business_strategy: "Business strategy",
  azure: "Azure", machine_learning: "Machine learning", project_management: "Project management", business_analysis: "Business analysis",
  investment_analysis: "Investment analysis", clinical_research: "Clinical research", google_cloud: "Google Cloud", apache_spark: "Spark",
  power_bi: "Power BI", logistics: "Logistics", kubernetes: "Kubernetes", inventory_management: "Inventory management", tableau: "Tableau",
  product_management: "Product management", risk_management: "Risk management", account_management: "Account management",
  computer_vision: "Computer vision", mathematical_modeling: "Mathematical modeling", cybersecurity: "Cybersecurity", generative_ai: "Generative AI",
  procurement: "Procurement", hvac_design: "HVAC", accounts_payable_receivable: "Accounts payable", stakeholder_management: "Stakeholder management",
  supply_chain_planning: "Supply chain", docker: "Docker", technical_documentation: "Technical writing", data_warehousing: "Data warehousing",
  pure_mathematics: "Pure mathematics", recruiting: "Recruiting",
};

/** Free ways to prepare for (or retake) a Rolearch skill test. */
export function testResources(testId: string) {
  return freeResources(TEST_TOPIC[testId] ?? testId);
}

/** False for things no course teaches (lifting 50 lb), so the free-learning section leaves them out. */
export function hasResources(skill: string) {
  const { featured, links } = freeResources(skill);
  return Boolean(featured) || links.length > 0;
}

export function youtubeSearch(skill: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + " tutorial for beginners")}`;
}
