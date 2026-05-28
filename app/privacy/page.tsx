import type { Metadata } from "next"
import { archiveSurface, InvertedPageShell } from "@/components/inverted-page-shell"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Privacy Policy | Inverted World",
  description: "Privacy Policy for Inverted World, operated by Subverse, Inc.",
  alternates: {
    canonical: "/privacy",
  },
}

const sections = [
  {
    title: "Information We Collect",
    body: [
      "We may collect information you provide directly, such as your email address, messages, feedback, support requests, account information, or other information you choose to send us.",
      "We may collect technical information automatically, including IP address, browser type, device information, referring pages, pages viewed, approximate location derived from IP address, and timestamps.",
      "If the site offers interactive or AI-powered features, we may process the prompts, questions, uploaded content, source links, and responses needed to provide those features.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "We use information to operate, maintain, secure, and improve the site; respond to requests; measure performance; detect abuse; debug errors; and understand which content is useful to readers.",
      "We may use aggregated or de-identified information to improve coverage, ranking, search, recommendations, and product quality.",
    ],
  },
  {
    title: "Cookies and Analytics",
    body: [
      "We may use cookies, local storage, server logs, analytics tools, and similar technologies to remember preferences, operate the site, measure traffic, prevent fraud, and improve performance.",
      "You can control cookies through your browser settings. Some features may not work correctly if cookies or local storage are disabled.",
    ],
  },
  {
    title: "How We Share Information",
    body: [
      "We do not sell your personal information. We may share information with service providers that help us host, analyze, secure, moderate, or operate the site.",
      "We may disclose information if required by law, legal process, or a good-faith belief that disclosure is necessary to protect rights, safety, security, or the integrity of the site.",
      "If Subverse, Inc. is involved in a merger, acquisition, financing, restructuring, or asset sale, information may be transferred as part of that transaction.",
    ],
  },
  {
    title: "AI and Third-Party Sources",
    body: [
      "The site may use third-party tools and AI services to process public sources, summarize records, organize media, answer questions, or improve retrieval. Information sent through those features may be processed by those service providers according to their agreements with us.",
      "The site links to external sources, media platforms, social networks, and documents. Those sites have their own privacy practices, and this policy does not cover them.",
    ],
  },
  {
    title: "Retention and Security",
    body: [
      "We keep information for as long as reasonably necessary to provide the site, comply with legal obligations, resolve disputes, enforce agreements, and maintain security.",
      "We use reasonable administrative, technical, and organizational safeguards, but no internet service can be guaranteed to be completely secure.",
    ],
  },
  {
    title: "Your Choices",
    body: [
      "You may request access, correction, deletion, or restriction of personal information where applicable law gives you those rights.",
      "You may opt out of non-essential emails by using the unsubscribe link in those messages or contacting us.",
    ],
  },
  {
    title: "Children",
    body: [
      "The site is not directed to children under 13, and we do not knowingly collect personal information from children under 13.",
    ],
  },
  {
    title: "Changes",
    body: [
      "We may update this Privacy Policy from time to time. The updated version will be posted here with a revised effective date.",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <InvertedPageShell
      eyebrow="Subverse, Inc."
      title="Privacy Policy"
      heroTitle="Privacy Policy"
      heroDescription="Effective May 28, 2026."
    >
      <div className="grid gap-5">
        <section className={cn("p-4 text-sm leading-7 text-[#f4efe2]/72 sm:p-5", archiveSurface)}>
          <p>
            This Privacy Policy explains how Subverse, Inc. collects, uses, shares, and protects information in connection with
            Inverted World.
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
