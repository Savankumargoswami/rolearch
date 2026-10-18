import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Mail, Points, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Rolearch collects, why, who it's shared with, and the choices you have.",
  alternates: { canonical: "/privacy" },
};

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          Rolearch (&ldquo;Rolearch&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) runs rolearch.com, a professional network for finding verified jobs, building a profile and
          sharing work. This policy explains what personal information we collect, how we use it and the choices you have. We are the controller of the
          personal information described here.
        </p>
        <p>
          Questions or requests: <Mail />.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>We collect only what the service needs:</p>
        <Points
          items={[
            <><strong>Account details:</strong> your email address, password (stored only as a secure hash by our authentication provider), account type, and for company accounts the company name and website.</>,
            <><strong>Profile:</strong> your name, photo, headline, location, links, work experience, education, projects, certifications and skills, whether you type them or we read them from your resume.</>,
            <><strong>Resume files:</strong> the PDF or Word file you upload to build your profile. It is stored privately; only you can access it.</>,
            <><strong>Posts and follows:</strong> what you post (text, links, images) and who you follow.</>,
            <><strong>ATS checks:</strong> a resume you upload to check against a job is processed to produce a score and suggestions. We don&rsquo;t keep that file or the improved version after your session.</>,
            <><strong>Technical data:</strong> sign-in cookies, and the IP address, browser type and request logs our hosting providers record to run and protect the service.</>,
          ]}
        />
        <p>
          Jobs you save without an account are stored only in your own browser, not on our servers. We don&rsquo;t use advertising cookies, tracking pixels or
          third-party analytics.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <Points
        items={[
          "To create and secure your account and keep you signed in.",
          "To show your profile, posts and follows to other signed-in members.",
          "To calculate your match with jobs, show missing skills, and suggest free learning resources.",
          "To read resumes you upload, score them against a job, and suggest improvements.",
          "To review posts before they're published, so the feed stays limited to projects, outputs and resources.",
          "To send service emails, such as confirming your email address. We don't send marketing email without your consent.",
          "To prevent abuse, fix problems and keep the service secure.",
        ]}
      />
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: (
      <>
        <p>
          Some features use Claude, an AI model from Anthropic, acting as our service provider. When you upload a resume, write a post, or run an ATS check,
          the relevant text and images are sent to Anthropic to process that request.
        </p>
        <p>
          Anthropic processes this data on our behalf under its commercial terms, which do not allow it to train its models on this data. AI results such
          as match percentages, ATS scores and suggested resume edits are estimates. Check them before relying on them.
        </p>
      </>
    ),
  },
  {
    id: "visible",
    title: "Who can see your information",
    body: (
      <Points
        items={[
          <><strong>Signed-in members</strong> can see your profile (name, photo, headline, location, links, experience, education, projects, certifications, skills), your posts and your follower counts. Visitors who aren&rsquo;t signed in can&rsquo;t.</>,
          <><strong>Only you</strong> can see your email address, your uploaded resume file and your account details.</>,
          <><strong>Employers:</strong> when you apply for a job, you apply on the employer&rsquo;s own website, and what you share there is governed by their privacy policy.</>,
        ]}
      />
    ),
  },
  {
    id: "providers",
    title: "Service providers",
    body: (
      <>
        <p>We share personal information only with providers that run parts of Rolearch for us, under contracts that limit how they can use it:</p>
        <Points
          items={[
            <><strong>Supabase</strong>: database, sign-in and file storage.</>,
            <><strong>Vercel</strong>: website hosting.</>,
            <><strong>Anthropic</strong>: AI processing described above.</>,
            <><strong>Email delivery provider</strong>: sending account emails.</>,
          ]}
        />
        <p>
          We don&rsquo;t sell or rent your personal information, and we don&rsquo;t share it for cross-context behavioural advertising. We may disclose
          information if the law requires it, or to protect the rights and safety of our members.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <p>
        We use only cookies that are needed to keep you signed in and to protect your account. Saved jobs use your browser&rsquo;s local storage. There are
        no advertising or analytics cookies, so there&rsquo;s no cookie banner to accept.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <Points
        items={[
          "Account, profile, posts and follows: until you delete them or close your account.",
          "Replaced profile photos and deleted posts' images: deleted when you replace or remove them.",
          "Resume files: until you replace them or close your account.",
          "ATS check uploads: not stored after the check.",
          "Hosting and security logs: for the limited period our providers keep them.",
        ]}
      />
    ),
  },
  {
    id: "rights",
    title: "Your rights and choices",
    body: (
      <>
        <p>
          You can view and edit your profile at any time, delete your posts, remove your photo and unfollow people. You can also ask us to give you a copy of
          your data, correct it, delete your account, or stop a particular use, by emailing <Mail />. We&rsquo;ll respond within 30 days.
        </p>
        <p>
          Depending on where you live (for example the EU, UK or California), you may have further rights under local law, including the right to complain to
          your data protection authority. We won&rsquo;t treat you differently for using your rights.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <p>
        Rolearch is used worldwide and our providers may process data in the United States and other countries. Where the law requires it, transfers are
        protected by safeguards such as the European Commission&rsquo;s standard contractual clauses.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Data is encrypted in transit, access is limited by row-level security rules so members can only change their own data, and resume files sit in
        private storage. No system is perfectly secure; if we learn of a breach affecting you, we&rsquo;ll tell you as the law requires.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Rolearch is for people aged 16 and over. We don&rsquo;t knowingly collect information from younger children; if you believe we have, contact us and we&rsquo;ll delete it.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We&rsquo;ll post any changes here and update the date at the top. If a change is significant, we&rsquo;ll tell signed-in members before it takes
        effect. See also our{" "}
        <Link href="/terms" className="font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
          Terms of Service
        </Link>
        .
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="October 17, 2026"
      summary={[
        "We collect what the service needs: your account, profile, posts and the resumes you upload.",
        "Your profile and posts are visible to signed-in members only; your resume file is private.",
        "No ads, no trackers, no selling your data.",
        "AI features run on Anthropic's Claude, which doesn't train on your data.",
        "You can edit or delete your information, or ask us for a copy, at any time.",
        "Questions: admin@rolearch.com.",
      ]}
      sections={sections}
      other={{ href: "/terms", label: "Read the Terms of Service" }}
    />
  );
}
