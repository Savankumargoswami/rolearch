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
};

export function youtubeSearch(skill: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + " tutorial for beginners")}`;
}
