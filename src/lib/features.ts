// What Rolearch does, in one place: the public Features page, the homepage's structured data and /llms.txt all read
// from this list, so search engines and AI assistants describe the product the way it actually works.

export type Feature = { id: string; name: string; summary: string; points: string[]; href: string };

export const CANDIDATE_FEATURES: Feature[] = [
  {
    id: "jobfit",
    name: "RoleArch Job-Fit Intelligence",
    summary: "A reasoned job-fit report instead of a single keyword score: understand your fit before you apply.",
    points: [
      "Separate scores for skills, transferable capabilities, experience, industry, education and location or eligibility",
      "Every requirement marked as proven in a role, verified by a skill test, partly shown, transferable, not found, or a confirmed gap, with the resume line that shows it",
      "A clear decision: strong fit, apply; potential fit, address specific gaps; stretch role, build skills first; poor fit, don't waste application time; or not enough information yet",
      "Correct anything that's wrong, and the analysis updates",
    ],
    href: "/ats",
  },
  {
    id: "tailoring",
    name: "Evidence-backed AI: evidence-based resume tailoring and cover letters",
    summary: "Tailor your resume and write a cover letter for each job without inventing anything.",
    points: [
      "AI Recruiter Review: every bullet scored for the job, requirements you meet in other words found and quoted, and questions that turn weak bullets into strong ones using your own answers",
      "Every suggested edit shows the job requirement and your original line, with Accept, Edit, Rewrite or Keep original",
      "Skills your resume doesn't show are never added; you're asked instead",
      "Saved resume versions per job, PDF and Word downloads, and a plain-text preview of what scanners read",
      "Cover letters written only from facts in your resume",
    ],
    href: "/ats",
  },
  {
    id: "skills",
    name: "Proctored skill tests and verified badges",
    summary: "Prove your skills with proctored, auto-graded tests in 37 skills, at four levels each.",
    points: [
      "Every candidate gets a different test; a badge needs a score of 90% or more",
      "Skills include SQL, Python, Excel, statistics, machine learning, Power BI, Tableau, AWS, Azure, Google Cloud, Kubernetes, Docker, project management, supply chain planning, procurement, accounts payable and receivable, cybersecurity and more",
      "Badges appear on your profile and count as verified evidence in job-fit reports",
      "Employers you apply to can review your graded answers",
    ],
    href: "/skills",
  },
  {
    id: "discovery",
    name: "Job application decision engine",
    summary: "Live jobs from employers' own careers pages, ranked around your real experience.",
    points: [
      "Jobs from company career pages, refreshed daily, with pay shown when the employer publishes it",
      "Every job classified as strong, potential, stretch or poor fit for you, with the reason",
      "Search by role, skill, country, remote work, visa sponsorship and pay",
    ],
    href: "/jobs",
  },
  {
    id: "roadmap",
    name: "Career gap-to-action roadmaps and career-change guides",
    summary: "For every gap: a learning path, a practical project, and the evidence to add once it's done.",
    points: [
      "Skills to build next, ranked by how often jobs for your target role ask for them",
      "Your transition path, such as manufacturing engineer to operations analyst to data analyst, with the experience that supports it",
      "Learning roadmaps for hundreds of roles, and public guides for common career changes",
    ],
    href: "/guides",
  },
  {
    id: "manager",
    name: "AI application manager and application outcome intelligence",
    summary: "Every application in one place, with the next step for each.",
    points: [
      "Statuses from interested to offer, with a timestamped history",
      "Deadlines, interviews, recruiter contacts and conversations, follow-ups and rejection reasons",
      "A dashboard of what's due, upcoming interviews and your outcomes",
      "Outcome intelligence: interview rates by resume version, job type and hiring platform; CSV export",
    ],
    href: "/tracker",
  },
  {
    id: "interview",
    name: "Interview preparation",
    summary: "Practise with questions built from the actual job description and your resume.",
    points: [
      "Behavioral, technical, role and gap questions this employer is likely to ask you",
      "Feedback on your answers: what worked, what's missing, and the knowledge gaps to close",
    ],
    href: "/interview",
  },
  {
    id: "community",
    name: "Profiles and community",
    summary: "A portfolio-style profile, posts and follows.",
    points: ["A public-style profile with experience, projects, certifications and verified badges", "Post updates, follow people, and read the community feed"],
    href: "/feed",
  },
];

export const EMPLOYER_FEATURES: Feature[] = [
  {
    id: "post",
    name: "Post jobs and manage your pipeline",
    summary: "Verified company accounts post jobs and move applicants through screening, interview and offer.",
    points: ["Applicants ranked by evidence-based job fit", "Each applicant's JobFit report, resume, answers and proctored skill-test results", "Messages and stage updates that candidates see in their tracker"],
    href: "/employers",
  },
  {
    id: "talent",
    name: "Talent search",
    summary: "Verified employers can find candidates who chose to be open to work.",
    points: ["Search by role or skill", "See verified skill badges, target roles and work preferences", "Only opted-in candidates, and never their contact details or resume files"],
    href: "/employers",
  },
  {
    id: "verified",
    name: "Verified skills, not keyword claims",
    summary: "Proctored, auto-graded skill tests show what a candidate can actually do.",
    points: ["Badges at four levels across 37 skills", "Graded answers available to employers the candidate applied to"],
    href: "/employers",
  },
];

/** What isn't part of Rolearch, so descriptions stay accurate. */
export const NOT_OFFERED = [
  "Automatic application submission (you always apply on the employer's site or with your Rolearch profile)",
  "Anonymous company reviews",
  "Guarantees of interviews, ATS results or job offers: fit scores are estimates to guide decisions",
];
