// Occupation categories, matching the worker's rolearch_worker/categories.py.
export const WHITE = ["software", "data", "engineering", "design", "marketing", "sales", "finance", "hr", "legal", "science", "admin", "education", "customer", "social"] as const;
export const BLUE = ["driving", "logistics", "trades", "manufacturing", "facilities", "hospitality", "retail", "security"] as const;
export const CATEGORIES = [...WHITE, "healthcare", ...BLUE, "other"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Browse groups: "white" = office and professional, "blue" = hands-on and hourly. */
export const GROUPS = ["all", "white", "blue"] as const;

export const isCategory = (c: string): c is Category => (CATEGORIES as readonly string[]).includes(c);
