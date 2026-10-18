import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Mail, Points, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using Rolearch: accounts, jobs, posting, AI features and your content.",
  alternates: { canonical: "/terms" },
};

const link = "font-medium underline decoration-line underline-offset-4 hover:decoration-ink";

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreeing to these terms",
    body: (
      <p>
        These terms apply when you use rolearch.com (&ldquo;Rolearch&rdquo;). By creating an account or using the site, you agree to them and to our{" "}
        <Link href="/privacy" className={link}>
          Privacy Policy
        </Link>
        . If you use Rolearch for a company, you confirm you&rsquo;re allowed to accept these terms for it.
      </p>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <Points
        items={[
          "You must be at least 16 years old.",
          "Give accurate information, keep your password safe, and tell us if you think someone else has used your account.",
          "One person per personal account. Company accounts must use an email at the company's own domain.",
          "You're responsible for what happens under your account.",
        ]}
      />
    ),
  },
  {
    id: "jobs",
    title: "Jobs on Rolearch",
    body: (
      <>
        <p>
          Most jobs on Rolearch come from employers&rsquo; own public careers pages. We check them regularly and link straight to the employer&rsquo;s posting,
          but we don&rsquo;t employ anyone, and we can&rsquo;t guarantee that a listing is complete, current or still open. Applications happen on the
          employer&rsquo;s website, under their terms.
        </p>
        <p>Rolearch never charges job seekers to apply for a job.</p>
      </>
    ),
  },
  {
    id: "posting",
    title: "Posting rules",
    body: (
      <>
        <p>Posts on Rolearch are for sharing work and knowledge. You can post:</p>
        <Points items={["a project you built or worked on", "an output of your work, like a chart, result, benchmark or code", "a genuinely useful resource, with a line on why"]} />
        <p>Posts aren&rsquo;t for:</p>
        <Points
          items={[
            "personal feelings, life updates, motivation or announcements of jobs, promotions, certificates or awards",
            "self-promotion, job seeking, ads or engagement bait",
            "anything illegal, hateful, harassing, sexual, violent, misleading or that infringes someone else's rights",
            "other people's personal information or confidential company information",
          ]}
        />
        <p>
          Every post is reviewed automatically before it&rsquo;s published, and we may remove content or limit accounts that break these rules. If you think
          something was removed by mistake, email <Mail />.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <p>
        You own what you post and upload. You give Rolearch a non-exclusive, worldwide, royalty-free licence to host, store, display and process it so we can
        run the service (for example, showing your profile to members and reading your resume). This licence ends when you delete the content, except for
        copies kept for a limited time in backups. Only upload content you have the right to share.
      </p>
    ),
  },
  {
    id: "ai",
    title: "Match scores, ATS checks and AI suggestions",
    body: (
      <>
        <p>
          Match percentages, missing skills, ATS scores and suggested resume edits are estimates to help you prepare. They&rsquo;re not a promise that an
          employer&rsquo;s system will score you the same way or that you&rsquo;ll get an interview. Rolearch is not affiliated with Workday, Jobscan or any
          employer&rsquo;s hiring system.
        </p>
        <p>
          You&rsquo;re responsible for what you submit to employers. Only claim skills and experience you really have; suggestions never replace your own
          judgement.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <Points
        items={[
          "Don't scrape, copy or bulk-download profiles, posts or jobs, or use bots to access the site.",
          "Don't impersonate anyone or create fake accounts or companies.",
          "Don't send spam, or contact members for anything other than genuine professional reasons.",
          "Don't try to break, overload or get around the site's security or posting review.",
          "Don't use the service to break the law.",
        ]}
      />
    ),
  },
  {
    id: "links",
    title: "Other websites",
    body: <p>Rolearch links to employers&rsquo; sites, courses and other resources we don&rsquo;t control. Their own terms and privacy policies apply there.</p>,
  },
  {
    id: "ending",
    title: "Ending your account",
    body: (
      <p>
        You can stop using Rolearch at any time and ask us to delete your account by emailing <Mail />. We may suspend or close accounts that break these terms
        or put other members at risk, and we&rsquo;ll tell you why unless the law or safety prevents it.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and liability",
    body: (
      <>
        <p>
          Rolearch is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent the law allows, we don&rsquo;t give warranties about the
          service, job listings, member content or AI results, and we aren&rsquo;t liable for indirect or consequential losses, lost opportunities or lost
          profits.
        </p>
        <p>Nothing in these terms limits rights you have under consumer law that can&rsquo;t be limited by contract.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        We may update these terms as Rolearch grows. We&rsquo;ll post changes here and update the date at the top, and tell signed-in members about
        significant changes before they take effect. Questions: <Mail />.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="October 17, 2026"
      summary={[
        "Be 16 or older, give accurate details, and keep your account secure.",
        "Jobs link to employers' own pages; we check them but can't guarantee them.",
        "Posts are for projects, outputs and resources only, and are reviewed first.",
        "You own your content; you let us host and show it to run the service.",
        "Match and ATS scores are estimates; only claim skills you really have.",
        "No scraping, spam, fake accounts or abuse.",
      ]}
      sections={sections}
      other={{ href: "/privacy", label: "Read the Privacy Policy" }}
    />
  );
}
