// Career-change guides (blueprint 9.4: SEO role-transition guides with concrete skill mapping). Public pages for the
// first customer segment: experienced professionals moving from engineering, manufacturing, quality and operations
// into analytics and business roles. Each guide maps what carries over, what to learn, and the proof to build.

export type Guide = {
  slug: string;
  from: string;
  to: string;
  bridge: string;
  /** Experience that transfers, and how to say it. */
  carries: { skill: string; how: string }[];
  /** What to learn, most important first. */
  learn: string[];
  /** Portfolio projects that prove the move. */
  projects: string[];
  /** Rolearch skill tests that verify the key skills. */
  tests: string[];
};

export const GUIDES: Guide[] = [
  {
    slug: "manufacturing-engineer-to-data-analyst",
    from: "Manufacturing engineer",
    to: "Data analyst",
    bridge: "Operations / process analyst",
    carries: [
      { skill: "Process improvement", how: "Show a before-and-after metric you moved (downtime, scrap, cycle time) and how you measured it." },
      { skill: "Root cause analysis", how: "Frame it as hypothesis-driven analysis: the data you pulled, what you ruled out, what you found." },
      { skill: "KPIs and reporting", how: "OEE, yield and throughput dashboards are business dashboards; name the audience and the decision they drove." },
      { skill: "Excel and statistics", how: "SPC, capability studies and regression on process data are analytics work; say so plainly." },
    ],
    learn: ["SQL (joins, aggregation, window functions)", "A BI tool (Power BI or Tableau)", "Python with pandas", "Business metrics outside the plant (revenue, retention, funnel)"],
    projects: ["Analyse a public sales or supply dataset in SQL and publish the queries and findings", "Build a one-page dashboard that answers one business question, with a short write-up of the decision it supports"],
    tests: ["SQL", "Excel", "Statistics", "Power BI"],
  },
  {
    slug: "quality-engineer-to-data-analyst",
    from: "Quality engineer",
    to: "Data analyst",
    bridge: "Quality data analyst",
    carries: [
      { skill: "Statistical process control", how: "Control charts and capability analysis are statistics on real data; show a decision they changed." },
      { skill: "Defect analysis", how: "Pareto and root-cause work is segmentation and diagnosis, the core of analysis." },
      { skill: "Audit and documentation", how: "Careful, reproducible work: describe how others reused your analysis." },
    ],
    learn: ["SQL", "Python with pandas", "A BI tool", "Experiment design and A/B testing basics"],
    projects: ["Recreate an SPC analysis on public manufacturing data in Python, with a short notebook", "A dashboard tracking defect rates by line and shift, with the insight it shows"],
    tests: ["SQL", "Python", "Statistics"],
  },
  {
    slug: "mechanical-engineer-to-business-analyst",
    from: "Mechanical engineer",
    to: "Business analyst",
    bridge: "Technical / systems business analyst",
    carries: [
      { skill: "Requirements and specifications", how: "Engineering specs are requirements: show how you gathered and traced them." },
      { skill: "Cross-functional work", how: "Working with production, suppliers and customers is stakeholder management." },
      { skill: "Problem solving with data", how: "Design trade-offs and test analysis show structured, evidence-based decisions." },
    ],
    learn: ["Requirements and user stories", "Process mapping (BPMN)", "SQL for reporting", "Agile delivery basics"],
    projects: ["Map an end-to-end process you know, identify the bottleneck and write the requirements for a fix", "Write a short business case with costs, benefits and risks for one improvement"],
    tests: ["Business analysis & requirements", "SQL", "Stakeholder management"],
  },
  {
    slug: "mechanical-engineer-to-supply-chain-analyst",
    from: "Mechanical engineer",
    to: "Supply chain analyst",
    bridge: "Production planning / materials analyst",
    carries: [
      { skill: "Capacity and production planning", how: "Show the volumes, constraints and schedules you planned around." },
      { skill: "Vendor and part management", how: "Supplier qualification and BOM work map directly to sourcing and MRP." },
      { skill: "Cost analysis", how: "Cost-downs and make-or-buy decisions are supply chain analysis." },
    ],
    learn: ["MRP and S&OP", "Inventory policy (safety stock, reorder points)", "Excel modelling", "SQL"],
    projects: ["Build an inventory model for a sample product line with safety stock and reorder points", "An S&OP-style plan comparing level and chase strategies with costs"],
    tests: ["Supply chain planning", "Inventory management", "Excel"],
  },
  {
    slug: "operations-manager-to-business-intelligence-analyst",
    from: "Operations manager",
    to: "Business intelligence analyst",
    bridge: "Operations analytics / reporting lead",
    carries: [
      { skill: "KPIs and dashboards", how: "You already run the business on metrics: name the KPIs you owned and the targets you hit." },
      { skill: "Stakeholder management", how: "Turning numbers into decisions for leaders is the BI job." },
      { skill: "Process improvement", how: "Show a change you led and the metric that proved it." },
    ],
    learn: ["SQL", "Power BI or Tableau, including data modelling", "DAX or calculated fields", "Data quality basics"],
    projects: ["A star-schema dashboard for an operations dataset with three decision-ready views", "Document a metric definition end to end: source, logic, owner"],
    tests: ["Power BI", "Tableau", "SQL"],
  },
  {
    slug: "operations-manager-to-supply-chain-analyst",
    from: "Operations manager",
    to: "Supply chain analyst",
    bridge: "Planning / logistics analyst",
    carries: [
      { skill: "Inventory and fulfilment", how: "Stock levels, service levels and lead times you managed are core supply chain metrics." },
      { skill: "Vendor management", how: "Supplier performance reviews and negotiations transfer directly." },
      { skill: "Scheduling and capacity", how: "Show the constraints you balanced and the result." },
    ],
    learn: ["Demand forecasting", "Inventory optimisation", "Logistics cost modelling", "SQL and Excel modelling"],
    projects: ["Forecast demand for a public dataset and measure accuracy (MAPE, bias)", "A landed-cost comparison of two shipping lanes"],
    tests: ["Supply chain planning", "Logistics & transportation", "Inventory management"],
  },
  {
    slug: "qa-engineer-to-data-engineer",
    from: "QA engineer",
    to: "Data engineer",
    bridge: "Test automation / data quality engineer",
    carries: [
      { skill: "Automation", how: "Test frameworks and CI pipelines are engineering: show what you automated and how often it runs." },
      { skill: "Data validation", how: "Checking correctness at scale is data quality engineering." },
      { skill: "Python and SQL", how: "Name the scripts and queries you wrote and what they checked." },
    ],
    learn: ["SQL and data modelling", "Python for pipelines", "Orchestration (Airflow or dbt)", "A data warehouse (Snowflake, BigQuery or Redshift)"],
    projects: ["Build a small ELT pipeline with tests that load public data into a warehouse", "Add data quality checks to a pipeline and report failures"],
    tests: ["SQL", "Python", "Data warehousing"],
  },
  {
    slug: "business-analyst-to-data-scientist",
    from: "Business analyst",
    to: "Data scientist",
    bridge: "Data analyst",
    carries: [
      { skill: "Problem framing", how: "Turning a vague business question into an analysis plan is the hardest part of data science." },
      { skill: "Stakeholder communication", how: "Show a recommendation you made and what changed because of it." },
      { skill: "SQL and reporting", how: "Name the data you pulled and the questions it answered." },
    ],
    learn: ["Python with pandas and scikit-learn", "Statistics and experiment design", "Machine learning basics", "Model evaluation"],
    projects: ["Predict a business outcome on public data, with an honest evaluation and a plain-language write-up", "Design and analyse an A/B test on a sample dataset"],
    tests: ["Python", "Statistics", "Machine learning"],
  },
  {
    slug: "accountant-to-financial-analyst",
    from: "Accountant",
    to: "Financial analyst",
    bridge: "Senior accountant / FP&A analyst",
    carries: [
      { skill: "Financial statements", how: "Reading and reconciling statements is the foundation of analysis." },
      { skill: "Excel", how: "Show the models and reconciliations you built, not just the tools." },
      { skill: "Accuracy and controls", how: "Close and audit experience shows reliable numbers." },
    ],
    learn: ["Financial modelling (three-statement)", "Budgeting and forecasting", "Valuation basics", "Business partnering"],
    projects: ["Build a three-statement model for a public company", "A variance analysis explaining budget versus actual for a sample business"],
    tests: ["Excel", "Investment analysis & portfolio management", "Accounts payable & receivable"],
  },
  {
    slug: "software-engineer-to-machine-learning-engineer",
    from: "Software engineer",
    to: "Machine learning engineer",
    bridge: "ML / data platform engineer",
    carries: [
      { skill: "Production engineering", how: "Shipping and running services reliably is most of ML engineering." },
      { skill: "Python and APIs", how: "Name the services you built and their scale." },
      { skill: "Cloud and pipelines", how: "Deployment and data pipelines carry over directly." },
    ],
    learn: ["Machine learning fundamentals", "Model training and evaluation", "MLOps (tracking, serving, monitoring)", "Working with LLMs"],
    projects: ["Train, serve and monitor a small model behind an API", "A retrieval-augmented generation demo with an evaluation set"],
    tests: ["Machine learning", "Python", "Generative AI & LLMs"],
  },
];

export const guide = (slug: string) => GUIDES.find((g) => g.slug === slug) ?? null;
