import type { Metadata } from "next"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Terms of Use | Inverted World",
  description: "Terms of Use for Inverted World, operated by Subverse, Inc.",
  alternates: {
    canonical: "/terms",
  },
}

const sections = [
  {
    title: "Use of the Site",
    body: [
      "You may use the site only for lawful purposes and in accordance with these Terms. You are responsible for your own activity and for any information you submit.",
      "You may not interfere with the operation or security of the site, scrape or copy content in a way that burdens the service, attempt unauthorized access, introduce malware, impersonate another person, or use the site to violate the rights of others.",
    ],
  },
  {
    title: "Editorial Content",
    body: [
      "The site provides news, commentary, research, media, links, transcripts, summaries, and related informational material. Content is provided for general informational and editorial purposes only.",
      "We may update, remove, correct, rank, summarize, or reorganize content at any time. External source links may change, disappear, or become unavailable.",
    ],
  },
  {
    title: "No Professional Advice",
    body: [
      "Content on the site is not legal, medical, financial, investment, security, or other professional advice. You should not rely on it as a substitute for advice from qualified professionals.",
    ],
  },
  {
    title: "AI Features",
    body: [
      "The site may include AI-generated summaries, answers, rankings, labels, headlines, or research aids. AI output can be incomplete, outdated, or wrong.",
      "You should verify important information against original sources before relying on it, publishing it, or making decisions based on it.",
    ],
  },
  {
    title: "Accounts and Submissions",
    body: [
      "If account, chat, comment, upload, or submission features are offered, you are responsible for the information you provide and for keeping any account credentials secure.",
      "By submitting content, you grant Subverse, Inc. a non-exclusive, worldwide, royalty-free license to host, store, reproduce, display, modify, and use that content as needed to operate, improve, and promote the site.",
    ],
  },
  {
    title: "Intellectual Property",
    body: [
      "The site, branding, design, software, organization, original text, graphics, and other materials are owned by Subverse, Inc. or its licensors and are protected by intellectual property laws.",
      "Third-party articles, videos, documents, posts, names, logos, and media remain the property of their respective owners. Links and excerpts are provided for reference, commentary, indexing, and research.",
    ],
  },
  {
    title: "Third-Party Services",
    body: [
      "The site may link to or embed third-party websites, media platforms, social networks, documents, payment processors, analytics services, AI providers, and hosting services.",
      "Subverse, Inc. does not control third-party services and is not responsible for their content, availability, practices, or policies.",
    ],
  },
  {
    title: "Disclaimers",
    body: [
      "The site is provided on an as-is and as-available basis. To the fullest extent permitted by law, Subverse, Inc. disclaims all warranties, express or implied, including warranties of accuracy, availability, merchantability, fitness for a particular purpose, and non-infringement.",
    ],
  },
  {
    title: "Limitation of Liability",
    body: [
      "To the fullest extent permitted by law, Subverse, Inc. and its officers, directors, employees, contractors, affiliates, and service providers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, data, goodwill, or business opportunities.",
    ],
  },
  {
    title: "Indemnity",
    body: [
      "You agree to defend, indemnify, and hold harmless Subverse, Inc. from claims, damages, losses, liabilities, costs, and expenses arising from your use of the site, your submissions, or your violation of these Terms.",
    ],
  },
  {
    title: "Changes and Termination",
    body: [
      "We may change the site or these Terms at any time. The updated Terms will be posted here with a revised effective date.",
      "We may suspend or terminate access to the site if we believe a user has violated these Terms, created risk, or used the site unlawfully.",
    ],
  },
]

export default function TermsPage() {
  return (
    <InvertedPageShell
      eyebrow="Subverse, Inc."
      title="Terms of Use"
      heroTitle="Terms of Use"
      heroDescription="Effective May 28, 2026."
    >
      <div className="grid gap-5">
        <section className={cn("p-4 text-sm leading-7 text-[#f4efe2]/72 sm:p-5", archiveSurface)}>
          <p>
            These Terms of Use govern your access to and use of Inverted World, a site operated by Subverse, Inc. By using
            the site, you agree to these Terms.
          </p>
          <p className="mt-4">
            Questions can be sent to{" "}
            <a className="text-[#fff8e6] underline decoration-[#df2f2f]/60 underline-offset-4" href="mailto:admin@subverse.net">
              admin@subverse.net
            </a>
            .
          </p>
        </section>

        <section className="grid gap-3">
          {sections.map((section) => (
            <article key={section.title} className={cn("p-4 sm:p-5", archiveSurface)}>
              <h2 className="iw-serif text-3xl leading-none text-[#fff8e6]">{section.title}</h2>
              <div className="mt-4 grid gap-3 text-sm leading-7 text-[#f4efe2]/68">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </InvertedPageShell>
  )
}
