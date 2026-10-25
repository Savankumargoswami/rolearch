// Role and place pages (/roles/data-engineer/austin-tx): the searches people type into Google ("data engineer jobs in
// Austin", "remote nursing jobs", "software engineer jobs with visa sponsorship"), each answered with live US jobs.
import type { JobLite } from "@/data/types";

export type Role = { slug: string; name: string; q: string };
export type Place =
  | { slug: string; kind: "metro"; name: string; state: string; lat: number; lon: number }
  | { slug: "remote"; kind: "remote"; name: string }
  | { slug: "visa-sponsorship"; kind: "visa"; name: string };

const role = (name: string, q = name.toLowerCase()): Role => ({ slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, q });

export const ROLES: Role[] = [
  role("Software Engineer"), role("Data Engineer"), role("Data Scientist"), role("Data Analyst"), role("Machine Learning Engineer"),
  role("Full Stack Developer", "full stack"), role("Frontend Developer", "frontend"), role("Java Developer", "java developer"), role("Python Developer", "python developer"),
  role("DevOps Engineer", "devops"), role("Cloud Engineer", "cloud engineer"), role("Cybersecurity Analyst", "security analyst"), role("Network Engineer"),
  role("Product Manager"), role("Project Manager"), role("Business Analyst"), role("UX Designer", "ux designer"), role("Graphic Designer"),
  role("Registered Nurse", "registered nurse"), role("Nurse Practitioner"), role("Medical Assistant"), role("Pharmacist"), role("Pharmacy Technician"),
  role("Physical Therapist"), role("Accountant"), role("Financial Analyst"), role("Customer Service Representative", "customer service"),
  role("Sales Representative", "sales representative"), role("Account Executive"), role("Marketing Manager"), role("Recruiter"), role("Human Resources", "human resources"),
  role("Administrative Assistant"), role("Receptionist"), role("Paralegal"), role("Teacher"), role("Mechanical Engineer"), role("Electrical Engineer"),
  role("Civil Engineer"), role("Truck Driver", "cdl driver"), role("Delivery Driver"), role("Warehouse Associate", "warehouse"), role("Forklift Operator", "forklift"),
  role("Electrician"), role("HVAC Technician", "hvac"), role("Maintenance Technician"), role("Cashier"), role("Retail Sales Associate", "sales associate"),
  role("Store Manager"), role("Cook"), role("Security Officer"),
];

const metro = (name: string, state: string, lat: number, lon: number): Place => ({
  slug: `${name}-${state}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  kind: "metro",
  name,
  state,
  lat,
  lon,
});

export const METROS: Place[] = [
  metro("New York", "NY", 40.71, -74.01), metro("Los Angeles", "CA", 34.05, -118.24), metro("Chicago", "IL", 41.88, -87.63), metro("Dallas", "TX", 32.78, -96.8),
  metro("Houston", "TX", 29.76, -95.37), metro("Austin", "TX", 30.27, -97.74), metro("San Antonio", "TX", 29.42, -98.49), metro("Washington", "DC", 38.91, -77.04),
  metro("Philadelphia", "PA", 39.95, -75.17), metro("Atlanta", "GA", 33.75, -84.39), metro("Miami", "FL", 25.76, -80.19), metro("Orlando", "FL", 28.54, -81.38),
  metro("Tampa", "FL", 27.95, -82.46), metro("Jacksonville", "FL", 30.33, -81.66), metro("Boston", "MA", 42.36, -71.06), metro("Phoenix", "AZ", 33.45, -112.07),
  metro("San Francisco", "CA", 37.77, -122.42), metro("San Jose", "CA", 37.34, -121.89), metro("San Diego", "CA", 32.72, -117.16), metro("Sacramento", "CA", 38.58, -121.49),
  metro("Seattle", "WA", 47.61, -122.33), metro("Portland", "OR", 45.52, -122.68), metro("Denver", "CO", 39.74, -104.99), metro("Salt Lake City", "UT", 40.76, -111.89),
  metro("Las Vegas", "NV", 36.17, -115.14), metro("Minneapolis", "MN", 44.98, -93.27), metro("Detroit", "MI", 42.33, -83.05), metro("Columbus", "OH", 39.96, -83.0),
  metro("Cleveland", "OH", 41.5, -81.69), metro("Cincinnati", "OH", 39.1, -84.51), metro("Indianapolis", "IN", 39.77, -86.16), metro("St. Louis", "MO", 38.63, -90.2),
  metro("Kansas City", "MO", 39.1, -94.58), metro("Nashville", "TN", 36.16, -86.78), metro("Memphis", "TN", 35.15, -90.05), metro("Charlotte", "NC", 35.23, -80.84),
  metro("Raleigh", "NC", 35.78, -78.64), metro("Pittsburgh", "PA", 40.44, -80.0), metro("Baltimore", "MD", 39.29, -76.61), metro("Milwaukee", "WI", 43.04, -87.91),
  metro("Oklahoma City", "OK", 35.47, -97.52), metro("Louisville", "KY", 38.25, -85.76), metro("Richmond", "VA", 37.54, -77.44), metro("New Orleans", "LA", 29.95, -90.07),
  metro("Albuquerque", "NM", 35.08, -106.65), metro("Omaha", "NE", 41.26, -95.93), metro("Boise", "ID", 43.62, -116.2), metro("Birmingham", "AL", 33.52, -86.8),
];

export const SPECIAL: Place[] = [
  { slug: "remote", kind: "remote", name: "Remote" },
  { slug: "visa-sponsorship", kind: "visa", name: "with visa sponsorship" },
];

export const findRole = (slug: string) => ROLES.find((r) => r.slug === slug);
export const findPlace = (slug: string) => [...SPECIAL, ...METROS].find((p) => p.slug === slug);

/** "Data Engineer jobs in Austin, TX", "Remote Data Engineer jobs", "Data Engineer jobs with visa sponsorship". */
export function heading(r: Role, p?: Place) {
  if (!p) return `${r.name} jobs in the US`;
  if (p.kind === "remote") return `Remote ${r.name} jobs`;
  if (p.kind === "visa") return `${r.name} jobs with visa sponsorship`;
  return `${r.name} jobs in ${p.name}, ${p.state}`;
}

export type Stats = { employers: { name: string; n: number }[]; pay: string; cities: string[] };

const usd = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n.toFixed(n < 100 ? 2 : 0).replace(/\.00$/, "")}`);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** What the newest listings say: who's hiring most, typical posted pay, and where. */
export function stats(jobs: JobLite[]): Stats {
  const byCompany = new Map<string, number>();
  for (const j of jobs) byCompany.set(j.company, (byCompany.get(j.company) ?? 0) + 1);
  const employers = [...byCompany].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 6);
  const paid = jobs.filter((j) => j.salary && j.salary.currency === "USD");
  const yearly = paid.filter((j) => j.salary!.period === "year").map((j) => (j.salary!.min + j.salary!.max) / 2);
  const hourly = paid.filter((j) => j.salary!.period === "hour").map((j) => (j.salary!.min + j.salary!.max) / 2);
  const pay = yearly.length >= 3 ? `${usd(median(yearly))} a year` : hourly.length >= 3 ? `${usd(median(hourly))} an hour` : "";
  const byCity = new Map<string, number>();
  for (const j of jobs) if (j.city && j.workplace !== "remote") byCity.set(j.city, (byCity.get(j.city) ?? 0) + 1);
  const cities = [...byCity].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 5);
  return { employers, pay, cities };
}
