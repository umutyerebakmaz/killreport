"use client";

export default function TermsPage() {
  return (
    <div className="min-h-screen text-gray-200 bg-neutral-900">
      <div className="max-w-4xl px-6 py-12 mx-auto sm:py-16 lg:py-20">
        <h1 className="mb-12 text-4xl font-bold text-white">
          Terms of Service
        </h1>

        {/* Introduction */}
        <section className="mb-12">
          <p className="text-gray-300 mb-4">
            These Terms of Service ("Terms") govern your use of Killreport,
            including our website and API services. By accessing or using
            Killreport, you agree to be bound by these Terms. If you do not
            agree, please do not use our service.
          </p>
        </section>

        {/* Acceptable Use */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Acceptable Use
          </h2>
          <p className="mb-4 text-gray-300">
            When accessing Killreport and our services, you agree to:
          </p>
          <ul className="ml-2 space-y-3 text-gray-300 list-disc list-inside">
            <li>Respect our server resources and rate limits</li>
            <li>Use our services for legitimate purposes only</li>
            <li>
              Not attempt to circumvent security measures or bypass access
              controls
            </li>
            <li>Comply with EVE Online's Terms of Service and EULA</li>
            <li>
              Report security vulnerabilities responsibly through proper
              channels
            </li>
            <li>Treat other users and community members with respect</li>
          </ul>
        </section>

        {/* Prohibited Conduct */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Prohibited Conduct
          </h2>
          <p className="mb-4 text-gray-300">
            We do not tolerate the following activities:
          </p>
          <ul className="ml-2 space-y-3 text-gray-300 list-disc list-inside">
            <li>
              <span className="font-semibold">Service Disruption:</span>{" "}
              Attempts to compromise service availability or functionality
              through DDoS attacks, exploitation, or other malicious means
            </li>
            <li>
              <span className="font-semibold">API Exploitation:</span> Automated
              excessive requests, deliberately overloading our systems, or
              bypassing rate limits
            </li>
            <li>
              <span className="font-semibold">Malicious Scraping:</span>{" "}
              Unauthorized extraction of data through non-API means or
              circumventing our APIs
            </li>
            <li>
              <span className="font-semibold">Spam & Advertising:</span>{" "}
              Unsolicited commercial content, spam, or promotional material on
              our platform
            </li>
            <li>
              <span className="font-semibold">Account Violations:</span> Sharing
              credentials, botting, multi-accounting without authorization, or
              impersonation
            </li>
            <li>
              <span className="font-semibold">Harassment & Abuse:</span> Hateful
              conduct, discrimination, threats, or abusive behavior toward other
              users
            </li>
          </ul>
        </section>

        {/* Community Guidelines */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Community Guidelines
          </h2>
          <p className="mb-4 text-gray-300">
            While Killreport is primarily a data platform, we maintain basic
            community standards for all shared content and interactions.
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-white mb-3">
                What We Encourage
              </h3>
              <ul className="ml-4 space-y-2 text-gray-300 text-sm">
                <li>
                  ✓ Constructive discussion about killmails, tactics, and PvP
                  strategies
                </li>
                <li>
                  ✓ Good-natured banter within EVE Online's cultural context
                </li>
                <li>
                  ✓ Respectful interaction and knowledge sharing with the
                  community
                </li>
                <li>✓ Feedback and suggestions for improving Killreport</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-3">
                What We Don't Allow
              </h3>
              <ul className="ml-4 space-y-2 text-gray-300 text-sm">
                <li>
                  ✗ Hate speech, discrimination, or harassment based on any
                  characteristic
                </li>
                <li>✗ Threats of violence or real-world harm</li>
                <li>✗ Spam or unsolicited commercial solicitation</li>
                <li>✗ Links to malware, viruses, or illegal content</li>
                <li>✗ Doxxing or sharing of real-world personal information</li>
                <li>✗ Sexual content or exploitation</li>
              </ul>
            </div>

            <div className="bg-neutral-800 border border-neutral-700 p-4 rounded">
              <h4 className="font-semibold text-white mb-2">Enforcement</h4>
              <p className="text-sm text-gray-300">
                We reserve the right to remove, edit, or restrict content that
                violates these guidelines. Repeated violations may result in
                content removal, warnings, temporary suspension, or permanent
                ban from Killreport services. We will provide notice when
                possible, but serious violations may result in immediate action.
              </p>
            </div>
          </div>
        </section>

        {/* Limitations & Disclaimers */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Limitations & Disclaimers
          </h2>
          <div className="space-y-4 text-gray-300">
            <p>
              <span className="font-semibold text-orange-400">
                AS-IS Service:
              </span>{" "}
              Killreport is provided as-is for informational and analytical
              purposes. We make no guarantees regarding:
            </p>
            <ul className="ml-4 space-y-2 text-sm list-disc list-inside">
              <li>
                Perfect accuracy of all displayed data (though we aim for it)
              </li>
              <li>Continuous, uninterrupted service availability</li>
              <li>
                Suitability for any particular use case or financial/strategic
                decisions
              </li>
              <li>Protection from all security threats or data breaches</li>
              <li>Compatibility with specific use cases or integrations</li>
            </ul>

            <p className="pt-4">
              <span className="font-semibold text-orange-400">
                Limitation of Liability:
              </span>{" "}
              You use this service at your own risk. To the maximum extent
              permitted by law, Killreport and its operators shall not be liable
              for any indirect, incidental, special, consequential, or punitive
              damages, or any loss of profits or revenue, whether incurred
              directly or indirectly.
            </p>

            <p>
              <span className="font-semibold text-orange-400">
                No Financial Advice:
              </span>{" "}
              Killreport provides data for informational purposes only. We do
              not provide financial, investment, or strategic advice. Any
              decisions you make based on Killreport data are your own
              responsibility.
            </p>
          </div>
        </section>

        {/* Changes to Terms */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Changes to These Terms
          </h2>
          <p className="text-gray-300">
            We may update these Terms periodically as we improve our service and
            respond to legal requirements. We will notify users of material
            changes when possible. Your continued use of Killreport following
            the posting of updated Terms constitutes your acceptance of those
            changes.
          </p>
          <p className="mt-4 text-sm text-gray-400">Last Updated: March 2026</p>
        </section>

        {/* Contact */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Questions About These Terms?
          </h2>
          <div className="space-y-4 text-gray-300">
            <p>
              If you have questions about these Terms of Service, please reach
              out:
            </p>
            <ul className="ml-4 space-y-2">
              <li>
                <a
                  href="https://discord.gg/hGugfm4n"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  Join our Discord community for support
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/umutyerebakmaz/killreport"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  Open an issue on GitHub
                </a>
              </li>
            </ul>
          </div>
        </section>

        <div className="border-t border-neutral-700 pt-8 mt-12">
          <p className="text-sm text-gray-400">
            These Terms of Service are designed to ensure Killreport remains a
            safe and respectful community while complying with legal
            requirements and EVE Online policies.
          </p>
        </div>
      </div>
    </div>
  );
}
