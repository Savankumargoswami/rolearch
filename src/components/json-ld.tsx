const SITE = "https://www.rolearch.com";

/** schema.org structured data for search engines; "<" is escaped so the text can't close the script tag. */
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** A BreadcrumbList from [name, path] pairs, e.g. [["Career roadmaps", "/roadmaps"], ["Nurse", "/roadmaps/nurse"]]. */
export const breadcrumbs = (items: [string, string][]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE}${path}` })),
});

export const publisher = { "@type": "Organization", name: "Rolearch", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/brand/logo.svg` } };
