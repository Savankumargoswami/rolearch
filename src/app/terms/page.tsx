import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">Terms</h1>
      <p className="mt-4 text-lg text-muted">Our terms of use will be published here before accounts open.</p>
    </div>
  );
}
