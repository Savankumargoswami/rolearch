// Free learning resources per skill. Curated; a weekly job checks links in production.
export type Resource = { course: { name: string; by: string; url: string }; book: string };

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
};

export type FreeLink = { label: string; by: string; url: string; kind: "course" | "video" | "docs" };

const q = (s: string) => encodeURIComponent(s);

/**
 * Free ways to learn a skill: the curated course when we have one, then searches on the big free
 * platforms (YouTube, freeCodeCamp, edX, Coursera's free-to-audit courses, Udemy's free courses, MIT OCW).
 */
export function freeResources(skill: string): { featured: Resource | null; links: FreeLink[] } {
  const featured = learning[skill] ?? null;
  const theory = /statistic|machine learning|deep learning|nlp|computer vision|forecasting|a\/b/i.test(skill);
  const links: FreeLink[] = [
    { label: `${skill} full course`, by: "YouTube", url: `https://www.youtube.com/results?search_query=${q(`${skill} full course for beginners`)}`, kind: "video" },
    { label: `${skill} on freeCodeCamp`, by: "freeCodeCamp", url: `https://www.youtube.com/@freecodecamp/search?query=${q(skill)}`, kind: "video" },
    { label: `${skill} courses`, by: "edX (free to audit)", url: `https://www.edx.org/search?q=${q(skill)}`, kind: "course" },
    { label: `${skill} courses`, by: "Coursera (free to audit)", url: `https://www.coursera.org/search?query=${q(skill)}`, kind: "course" },
    { label: `Free ${skill} courses`, by: "Udemy", url: `https://www.udemy.com/courses/search/?price=price-free&q=${q(skill)}`, kind: "course" },
  ];
  if (theory) links.push({ label: `${skill} lectures`, by: "MIT OpenCourseWare", url: `https://ocw.mit.edu/search/?q=${q(skill)}`, kind: "course" });
  return { featured, links };
}

export function youtubeSearch(skill: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + " tutorial for beginners")}`;
}
