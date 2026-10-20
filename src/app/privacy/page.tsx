import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Mail, NOREPLY_EMAIL, Points, type LegalSection } from "@/components/legal-page";

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
            <><strong>Applications on Rolearch:</strong> when you apply to a job posted on Rolearch, a copy of your profile and resume as sent, your answers to the employer&rsquo;s questions, your note, your match and ATS scores, and the application&rsquo;s status and messages.</>,
            <><strong>Job tracker:</strong> jobs you save or mark as applied, their status and your notes.</>,
            <><strong>Company accounts and job posts:</strong> jobs a company posts, page-view counts for those jobs, and the company&rsquo;s pipeline stages, notes and messages about its applicants.</>,
            <><strong>ATS checks:</strong> a resume you upload to check against a job is processed to produce a score and suggestions. We don&rsquo;t keep that file or the improved version after your session.</>,
            <><strong>Technical data:</strong> sign-in cookies, and the IP address, browser type and request logs our hosting providers record to run and protect the service.</>,
          ]}
        />
        <p>
          We don&rsquo;t use advertising cookies, tracking pixels or third-party analytics. Job-page views on jobs posted on Rolearch are counted per day
          without recording who viewed them.
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
          "To run hiring on Rolearch: sending your application to the employer you chose, showing you its status, and giving employers their pipeline and job statistics.",
          "To review job posts before they're published, so only genuine, lawful jobs appear.",
          "To send account emails, such as confirming your email address (see “Emails from Rolearch” below). We don't send marketing email without your consent.",
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
          Some features use Claude, an AI model from Anthropic, acting as our service provider. When you upload a resume, write a post, run an ATS check,
          or a company posts a job, the relevant text and images are sent to Anthropic to process that request. Match and ATS scores attached to an
          application are calculated by Rolearch&rsquo;s own scoring, not by an AI deciding on your application.
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
          <><strong>Employers you apply to on Rolearch</strong> see what the apply page lists before you send: your name, email, headline, location, links, photo, resume, answers, note and your match and ATS scores for that job. Only that employer sees them. Company notes about you are private to the company.</>,
          <><strong>Employers on their own sites:</strong> for jobs that link to an employer&rsquo;s careers page, you apply there, and what you share is governed by their privacy policy.</>,
          <><strong>Only you</strong> see your job tracker.</>,
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
            <><strong>Email delivery provider</strong>: sending account emails from {NOREPLY_EMAIL}. It receives your email address and the message, only to deliver it.</>,
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
    id: "emails",
    title: "Emails from Rolearch",
    body: (
      <>
        <p>
          Account emails come only from <strong>{NOREPLY_EMAIL}</strong>, sent through our email delivery provider. Today that means the link to confirm your
          email address when you create an account; as features grow, it may include security notices and updates about applications you send on Rolearch.
        </p>
        <Points
          items={[
            <>{NOREPLY_EMAIL} is send-only: replies aren&rsquo;t read. For help or to report a problem, write to <Mail />.</>,
            "Links in our emails only go to rolearch.com. Confirmation links work once and expire after 24 hours.",
            "We never ask for your password, payment details, bank information or ID documents by email, and we never send attachments you need to open to sign in.",
            "These are account emails that the service needs to work, so they aren't optional while you have an account. We don't send marketing email without your consent.",
          ]}
        />
        <p>
          If you get an email that claims to be from Rolearch but comes from another address or links somewhere else, don&rsquo;t click it: forward it to{" "}
          <Mail /> so we can look into it. If you didn&rsquo;t create an account and got a confirmation email, someone may have typed your address by mistake;
          ignore the email and no account will be activated.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <p>
        We use only cookies that are needed to keep you signed in and to protect your account. Saved jobs are kept in your job tracker in your account.
        There are no advertising or analytics cookies, so there&rsquo;s no cookie banner to accept.
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
          "Applications: for as long as the job's employer keeps its account, and up to 2 years after the job closes; you can withdraw an application at any time, and we delete it on request.",
          "Job tracker: until you remove a job or close your account.",
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
      updated="October 20, 2026"
      summary={[
        "We collect what the service needs: your account, profile, posts and the resumes you upload.",
        "Your profile and posts are visible to signed-in members only; your resume file is private.",
        "No ads, no trackers, no selling your data.",
        "AI features run on Anthropic's Claude, which doesn't train on your data.",
        "You can edit or delete your information, or ask us for a copy, at any time.",
        "Applying on Rolearch shares your profile and resume with that employer only, and you see what's sent first.",
        "Account emails come only from noreply@rolearch.com, which never asks for your password or payment details.",
        "Questions: admin@rolearch.com.",
      ]}
      sections={sections}
      other={{ href: "/terms", label: "Read the Terms of Service" }}
    />
  );
}
