"use client";

import Link from "next/link";

export default function LegalPage() {
  return (
    <div className="min-h-screen text-gray-200 bg-neutral-900">
      <div className="max-w-4xl px-6 py-12 mx-auto sm:py-16 lg:py-20">
        <h1 className="mb-12 text-4xl font-bold text-white">
          Legal Information
        </h1>

        {/* Introduction */}
        <section className="mb-12">
          <p className="mb-6 text-gray-300">
            Welcome to Killreport's legal information center. This page provides
            an overview of our legal framework and how we handle data. For
            detailed information, please visit our dedicated pages:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/terms"
              className="p-4 transition-colors border rounded bg-neutral-800 border-neutral-700 hover:border-cyan-500"
            >
              <h3 className="mb-2 font-semibold text-white">
                Terms of Service
              </h3>
              <p className="text-sm text-gray-400">
                Usage rules, acceptable conduct, and service limitations
              </p>
            </Link>
            <Link
              href="/privacy"
              className="p-4 transition-colors border rounded bg-neutral-800 border-neutral-700 hover:border-cyan-500"
            >
              <h3 className="mb-2 font-semibold text-white">Privacy Policy</h3>
              <p className="text-sm text-gray-400">
                Data collection, usage, storage, and your privacy rights
              </p>
            </Link>
          </div>
        </section>

        {/* EVE Online & CCP Games */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            EVE Online & CCP Games
          </h2>
          <div className="space-y-4 text-gray-300">
            <p>
              EVE Online is the property of CCP Games hf. (CCP). All EVE Online
              related trademarks, logos, and intellectual property belong to CCP
              Games and are protected by international law.
            </p>
            <p>
              Killreport is an independent tool designed to provide real-time
              killmail tracking and analytics for the EVE Online community. We
              operate under license from CCP Games to display and process EVE
              Online data for informational and analytical purposes. We are not
              affiliated with, endorsed by, or associated with CCP Games.
            </p>
            <p>
              CCP Games does not endorse this service and is not responsible for
              the content, functionality, or reliability of Killreport. Any use
              of this service is at your own risk, and CCP Games assumes no
              liability for damages resulting from your use of our platform.
            </p>
          </div>
        </section>

        {/* Data Processing Pipeline */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            How Killreport Works: Our Data Pipeline
          </h2>
          <div className="space-y-4 text-gray-300">
            <p>
              Killreport doesn&apos;t create data—we transform it. Here&apos;s
              how we process EVE Online killmail information:
            </p>
            <div className="pt-4 space-y-3">
              <div className="pl-4 border-l-2 border-cyan-500">
                <h3 className="mb-2 font-semibold text-white">
                  1. Data Ingestion via zKillboard
                </h3>
                <p className="text-sm">
                  We subscribe to zKillboard&apos;s Redis queue, which provides
                  us real-time killmail events. However, we only receive minimal
                  identifiers: the{" "}
                  <span className="text-cyan-400">killmailID</span> and{" "}
                  <span className="text-cyan-400">killmailHash</span>. This is
                  raw, unannotated data—just numbers with no context.
                </p>
              </div>
              <div className="pl-4 border-l-2 border-cyan-500">
                <h3 className="mb-2 font-semibold text-white">
                  2. Data Enrichment via CCP ESI
                </h3>
                <p className="text-sm">
                  Using those IDs and hashes, we query CCP Games&apos; official
                  ESI (EVE Swagger Interface) API to fetch the complete killmail
                  data. This is where raw fight data becomes meaningful:
                  character names, corporation affiliations, damage dealt,
                  fitted modules, and more. We enrich the sparse zKillboard
                  events with full context from CCP&apos;s authoritative source.
                </p>
              </div>
              <div className="pl-4 border-l-2 border-cyan-500">
                <h3 className="mb-2 font-semibold text-white">
                  3. Processing & Indexing
                </h3>
                <p className="text-sm">
                  We process this enriched data to make it searchable and
                  analyzable: calculating statistics, building kill/loss ratios,
                  tracking corporate contributions, and identifying regional
                  activity. Our infrastructure adds value through analysis, not
                  by creating data.
                </p>
              </div>
              <div className="pl-4 border-l-2 border-cyan-500">
                <h3 className="mb-2 font-semibold text-white">
                  4. Display & User Access
                </h3>
                <p className="text-sm">
                  Finally, we present this processed data through
                  Killreport&apos;s web interface, making it accessible and
                  useful to the EVE community for PvP analysis, statistical
                  tracking, and historical record-keeping.
                </p>
              </div>
            </div>
            <p className="pt-4 mt-4 text-sm border-t border-neutral-700">
              <span className="font-semibold text-cyan-400">Key Point:</span>{" "}
              Killreport is an analysis and presentation layer. We don&apos;t
              create killmail data—CCP Games does through EVE Online&apos;s
              combat system. zKillboard notifies us of events, and CCP ESI
              provides the authoritative data. We simply make it more useful.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Questions or Concerns?
          </h2>
          <div className="space-y-4 text-gray-300">
            <p>
              For questions about legal matters, service usage, or privacy
              concerns:
            </p>
            <div className="space-y-3">
              <div className="p-4 border rounded bg-neutral-800 border-neutral-700">
                <h3 className="font-semibold text-white mb-2">
                  Regarding Your EVE Online Data
                </h3>
                <p className="text-sm mb-2">
                  For GDPR requests or concerns about EVE Online data, contact
                  CCP Games:
                </p>
                <a
                  href="mailto:legal@ccpgames.com"
                  className="text-cyan-400 hover:underline text-sm"
                >
                  legal@ccpgames.com
                </a>
              </div>
              <div className="p-4 border rounded bg-neutral-800 border-neutral-700">
                <h3 className="font-semibold text-white mb-2">
                  Regarding Killreport
                </h3>
                <p className="text-sm mb-2">
                  For questions about Killreport's services, features, or
                  policies:
                </p>
                <ul className="ml-4 space-y-1 text-sm">
                  <li>
                    <a
                      href="https://discord.gg/hGugfm4n"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline"
                    >
                      Discord Community
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/umutyerebakmaz/killreport"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline"
                    >
                      GitHub Repository
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <div className="pt-8 mt-12 border-t border-neutral-700">
          <p className="text-sm text-gray-400">
            All EVE related materials are property of{" "}
            <a
              href="https://www.ccpgames.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              CCP Games
            </a>
          </p>
          <p className="text-xs text-gray-500 mt-2">Last Updated: March 2026</p>
        </div>
      </div>
    </div>
  );
}
