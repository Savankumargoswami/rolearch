// Which applicant tracking system a job link belongs to, from its host (used for the ATS check and outcome stats).
/** The applicant tracking system behind a job link, from its host. */
export function systemFromUrl(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
  const known: [RegExp, string][] = [
    [/myworkdayjobs\.com|workday\.com$/, "Workday"], [/icims\.com$/, "iCIMS"], [/greenhouse\.io$/, "Greenhouse"], [/lever\.co$/, "Lever"],
    [/taleo\.net$/, "Taleo"], [/successfactors\.(com|eu)$|sapsf\.(com|eu)$/, "SuccessFactors"], [/smartrecruiters\.com$/, "SmartRecruiters"],
    [/ashbyhq\.com$/, "Ashby"], [/jobvite\.com$/, "Jobvite"], [/oraclecloud\.com$/, "Oracle"], [/bamboohr\.com$/, "BambooHR"],
    [/workable\.com$/, "Workable"], [/adp\.com$/, "ADP"], [/paylocity\.com$/, "Paylocity"], [/ultipro\.com|ukg\.(com|net)$/, "UKG"],
    [/eightfold\.ai$/, "Eightfold"], [/avature\.net$/, "Avature"], [/rippling\.com$/, "Rippling"],
  ];
  return known.find(([re]) => re.test(host))?.[1] ?? "";
}
