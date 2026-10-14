import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">Privacy</h1>
      <p className="mt-4 text-lg text-muted">
        Our privacy policy will be published here before accounts open. This preview stores nothing about you except jobs you save, which stay in your own browser.
      </p>
    </div>
  );
}
