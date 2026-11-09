// Reads the job posting on the page the member is looking at. Runs only when they click the toolbar button
// (activeTab), only on that one tab, and only reads: it never clicks, scrolls or loads other pages.
// Kept self-contained: chrome.scripting.executeScript serialises this one function into the page.

// eslint-disable-next-line no-unused-vars
function rolearchExtractJob() {
  const MAX = 50000;
  const clean = (s) =>
    String(s || "")
      .replace(/ /g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  const line = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const text = (el) => (el ? clean(el.innerText || el.textContent) : "");
  const first = (sels) => {
    for (const s of sels) {
      try {
        const el = document.querySelector(s);
        if (el && text(el)) return text(el);
      } catch {}
    }
    return "";
  };
  // HTML from structured data is parsed inertly (DOMParser runs no scripts and loads no images).
  const parse = (html) => {
    const marked = String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|h\d|div|ul|ol)>/gi, "\n$&");
    return new DOMParser().parseFromString(marked, "text/html").body.textContent;
  };
  // Some sites (LinkedIn) escape the HTML twice, so tags survive the first pass as text.
  const fromHtml = (html) => {
    let s = parse(html);
    if (/<\/?[a-z][^>]*>/i.test(s)) s = parse(s);
    return clean(s);
  };

  const job = { title: "", company: "", description: "", url: location.href, site: location.hostname.replace(/^www\./, "") };

  // A clean link for list views that show one job beside the results.
  try {
    const u = new URL(location.href);
    if (/linkedin\.com$/.test(u.hostname) && u.searchParams.get("currentJobId")) job.url = `https://www.linkedin.com/jobs/view/${u.searchParams.get("currentJobId")}/`;
    if (/indeed\./.test(u.hostname) && u.searchParams.get("vjk")) job.url = `${u.origin}/viewjob?jk=${u.searchParams.get("vjk")}`;
  } catch {}

  // 1. Structured data (schema.org JobPosting): most careers pages publish it for Google Jobs.
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.textContent);
      const all = [].concat(data).flatMap((d) => [d, ...((d && d["@graph"]) || [])]);
      const jp = all.find((d) => d && [].concat(d["@type"]).includes("JobPosting"));
      if (jp) {
        job.title = line(jp.title);
        const org = jp.hiringOrganization;
        job.company = line(typeof org === "string" ? org : org && org.name);
        job.description = fromHtml(jp.description);
        break;
      }
    } catch {}
  }

  // 2. Job sites whose pages we know.
  const SITES = [
    [/linkedin\.com/, [".job-details-jobs-unified-top-card__job-title h1", ".job-details-jobs-unified-top-card__job-title", ".jobs-unified-top-card__job-title", "h1.top-card-layout__title", "h1"], [".job-details-jobs-unified-top-card__company-name a", ".job-details-jobs-unified-top-card__company-name", ".jobs-unified-top-card__company-name", ".topcard__org-name-link"], ["#job-details", ".jobs-description__content", ".jobs-box__html-content", ".show-more-less-html__markup", ".description__text"]],
    [/indeed\./, ['[data-testid="jobsearch-JobInfoHeader-title"]', ".jobsearch-JobInfoHeader-title", "h1"], ['[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]', ".jobsearch-CompanyInfoContainer a"], ["#jobDescriptionText"]],
    [/glassdoor\./, ['[data-test="job-title"]', "h1"], ['[data-test="employer-name"]', '[data-test="employerName"]'], ['[class*="JobDetails_jobDescription"]', '[data-test="jobDescriptionContent"]', ".jobDescriptionContent"]],
    [/greenhouse\.io/, [".app-title", ".job__title h1", "h1.section-header", "h1"], [".company-name"], [".job__description", "#content", "#app_body"]],
    [/lever\.co/, [".posting-headline h2", "h2"], [], ['[data-qa="job-description"]', ".posting-page .content"]],
    [/myworkdayjobs\.com|workday/, ['[data-automation-id="jobPostingHeader"]', "h2", "h1"], [], ['[data-automation-id="jobPostingDescription"]']],
    [/ashbyhq\.com/, ["h1"], [], ['[class*="_descriptionText"]', '[class*="description"]']],
    [/ziprecruiter\./, ["h1"], ['[class*="company_name"]', ".hiring_company"], [".job_description", '[class*="job_description"]']],
    [/wellfound\.com|angel\.co/, ["h1"], ['a[href*="/company/"]'], ['[class*="description"]']],
    [/rolearch\.com/, ["h1"], [], ["article", "main"]],
  ];
  const site = SITES.find(([re]) => re.test(location.hostname));
  if (site) {
    const [, t, c, d] = site;
    job.title = job.title || line(first(t));
    job.company = job.company || line(first(c));
    const desc = first(d);
    if (desc.length > job.description.length) job.description = desc;
  }

  // 3. Text the member selected wins: it's how they point at the description on an unusual page.
  const picked = clean(String(window.getSelection ? window.getSelection() : ""));
  if (picked.length >= 200) job.description = picked;

  // 4. Any other page: the heading, the site name, and the longest description-like block.
  if (!job.title) job.title = line(first(["h1"])) || line((document.querySelector('meta[property="og:title"]') || {}).content) || line(document.title);
  // Page titles often read "Data Engineer at Acme" or "Data Engineer - Acme | Careers".
  if (!job.company) job.company = line(((document.title.match(/\bat\s+([^|–—]+?)\s*(?:[|–—]|$)/) || [])[1]) || "");
  if (!job.company) job.company = line((document.querySelector('meta[property="og:site_name"]') || {}).content);
  if (job.description.length < 200) {
    let best = "";
    for (const el of document.querySelectorAll('[class*="description" i], [id*="description" i], [class*="job-details" i], article, main')) {
      const s = text(el);
      if (s.length > best.length && s.length <= MAX) best = s;
    }
    if (best.length > job.description.length) job.description = best;
  }

  job.title = job.title.slice(0, 200);
  job.company = job.company.slice(0, 120);
  job.description = job.description.slice(0, MAX);
  return job;
}
