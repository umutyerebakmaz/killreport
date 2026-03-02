"use client";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen text-gray-200 bg-neutral-900">
      <div className="max-w-4xl px-6 py-12 mx-auto sm:py-16 lg:py-20">
        <h1 className="mb-12 text-4xl font-bold text-white">Privacy Policy</h1>

        {/* Introduction */}
        <section className="mb-12">
          <p className="text-gray-300 mb-4">
            Killreport respects your privacy. This Privacy Policy explains what
            information we collect, how we use it, and your rights regarding
            your data. We are committed to transparency and data protection.
          </p>
          <p className="text-sm text-gray-400">Last Updated: March 2026</p>
        </section>

        {/* What Information We Collect */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            What Information We Collect
          </h2>
          <p className="mb-4 text-gray-300">
            Through your use of Killreport, we receive and process the following
            information:
          </p>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-white mb-2">
                EVE Online Character Data
              </h3>
              <p className="text-sm text-gray-300 ml-4">
                When you log in via EVE Online's SSO (Single Sign-On), we
                receive your character name, ID, corporation ID, and alliance ID
                directly from CCP Games' official ESI API. This data is obtained
                with your explicit consent through the OAuth login process.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">
                Killmail Information
              </h3>
              <p className="text-sm text-gray-300 ml-4">
                We store and process combat records (killmails) that you
                authorize us to track. This includes kill details, involved
                parties, ships, locations, and timestamps.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">
                Authentication Data
              </h3>
              <p className="text-sm text-gray-300 ml-4">
                We store authentication tokens (access and refresh tokens)
                locally in your browser to maintain your login session. These
                are necessary for your account security.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">
                Session Information
              </h3>
              <p className="text-sm text-gray-300 ml-4">
                We maintain a session ID to track your activity within
                Killreport during your visit. This expires when you close your
                browser.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">Usage Analytics</h3>
              <p className="text-sm text-gray-300 ml-4">
                We collect basic usage metrics: which pages you visit, how long
                you spend on them, and which features you use. This helps us
                understand how Killreport is used and identify areas for
                improvement.
              </p>
            </div>
          </div>
        </section>

        {/* How We Process Your Data */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            How We Use Your Information
          </h2>
          <p className="mb-4 text-gray-300">
            We use the information we collect for:
          </p>
          <ul className="ml-4 space-y-3 text-gray-300 list-disc list-inside">
            <li>
              <span className="font-semibold">Display & Analysis:</span> To show
              you your personal killboard statistics, combat history, and
              rankings
            </li>
            <li>
              <span className="font-semibold">Search & Tracking:</span> To
              provide advanced search features, custom reports, and persistent
              tracking across sessions
            </li>
            <li>
              <span className="font-semibold">Service Improvement:</span> To
              identify bugs, optimize performance, and develop new features
              based on usage patterns
            </li>
            <li>
              <span className="font-semibold">Security:</span> To detect and
              prevent abuse, unauthorized access, and malicious activity
            </li>
            <li>
              <span className="font-semibold">Legal Compliance:</span> To comply
              with legal obligations and protect our rights
            </li>
          </ul>
        </section>

        {/* Our Data Processing Pipeline */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            How Killreport Processes Data
          </h2>
          <div className="space-y-4 text-gray-300">
            <p>
              Killreport transforms raw event data into useful analytics. Our
              data pipeline includes:
            </p>

            <div className="space-y-3 pt-4">
              <div className="border-l-2 border-cyan-500 pl-4">
                <h3 className="font-semibold text-white mb-2">
                  1. Data Ingestion
                </h3>
                <p className="text-sm">
                  Real-time killmail notifications from zKillboard's Redis queue
                </p>
              </div>
              <div className="border-l-2 border-cyan-500 pl-4">
                <h3 className="font-semibold text-white mb-2">
                  2. Data Enrichment
                </h3>
                <p className="text-sm">
                  Complete killmail data fetched from CCP Games' ESI API
                </p>
              </div>
              <div className="border-l-2 border-cyan-500 pl-4">
                <h3 className="font-semibold text-white mb-2">
                  3. Processing & Storage
                </h3>
                <p className="text-sm">
                  Creating searchable indexes and aggregated statistics
                </p>
              </div>
              <div className="border-l-2 border-cyan-500 pl-4">
                <h3 className="font-semibold text-white mb-2">
                  4. Presentation
                </h3>
                <p className="text-sm">
                  Displaying processed data through our web interface
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-400 pt-4">
              For a detailed technical explanation of our data pipeline, see our{" "}
              <a href="/legal" className="text-cyan-400 hover:underline">
                Legal Information
              </a>{" "}
              page.
            </p>
          </div>
        </section>

        {/* Browser Storage */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Local Data Storage
          </h2>
          <p className="mb-4 text-gray-300">
            Killreport stores certain data in your browser's local storage for
            functionality and performance:
          </p>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-white mb-2 text-sm">
                Local Storage
              </h3>
              <ul className="ml-4 space-y-2 text-sm text-gray-300 list-disc list-inside">
                <li>
                  <span className="text-cyan-400">eve_access_token</span> - Your
                  ESI authentication token
                </li>
                <li>
                  <span className="text-cyan-400">eve_refresh_token</span> -
                  Token for automatic session renewal
                </li>
                <li>
                  <span className="text-cyan-400">eve_token_expiry</span> - When
                  your token expires
                </li>
                <li>
                  <span className="text-cyan-400">eve_user</span> - Your cached
                  character profile data
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2 text-sm">
                Session Storage
              </h3>
              <ul className="ml-4 space-y-2 text-sm text-gray-300 list-disc list-inside">
                <li>
                  <span className="text-cyan-400">session_id</span> - Unique
                  session identifier (cleared when you close your browser)
                </li>
              </ul>
            </div>

            <div className="bg-neutral-800 border border-neutral-700 p-4 rounded">
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-semibold text-cyan-400">Important:</span>{" "}
                We do NOT use traditional cookies. All data is stored in your
                browser's storage, which you can clear at any time through your
                browser settings.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                No Google Analytics, no tracking pixels, no third-party
                telemetry.
              </p>
            </div>
          </div>
        </section>

        {/* What We Don't Do */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Your Privacy Commitments
          </h2>
          <p className="mb-4 text-gray-300">
            We are committed to protecting your privacy:
          </p>
          <ul className="ml-4 space-y-3 text-gray-300 list-disc list-inside">
            <li>
              <span className="font-semibold">✗ No Third-Party Selling:</span>{" "}
              We will never sell or distribute your personal data to third
              parties
            </li>
            <li>
              <span className="font-semibold">✗ No Tracking Networks:</span> We
              do not use Google Analytics, Facebook Pixel, or other cross-site
              tracking
            </li>
            <li>
              <span className="font-semibold">
                ✗ No Behavioral Advertising:
              </span>{" "}
              We do not use your data for targeted advertisements
            </li>
            <li>
              <span className="font-semibold">✗ No Unwarranted Sharing:</span>{" "}
              Your information is not shared without explicit permission
            </li>
            <li>
              <span className="font-semibold">✗ No Telemetry Leaks:</span> We
              collect no telemetry beyond what's necessary for functionality
            </li>
          </ul>
        </section>

        {/* Data Ownership */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            About EVE Online Data Ownership
          </h2>
          <div className="bg-neutral-800 border border-neutral-700 p-4 rounded space-y-3">
            <p className="text-gray-300">
              <span className="font-semibold text-orange-400">Important:</span>{" "}
              All EVE Online related data is owned by CCP Games. For detailed
              information about data ownership, licensing, and GDPR requests,
              please see our{" "}
              <a href="/legal" className="text-cyan-400 hover:underline">
                Legal Information
              </a>{" "}
              page.
            </p>
          </div>
        </section>

        {/* Security */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Data Security
          </h2>
          <p className="text-gray-300">
            We implement reasonable security measures to protect your data from
            unauthorized access, alteration, or disclosure. However, no system
            is completely secure. We cannot guarantee absolute security of any
            data you transmit through our services.
          </p>
          <p className="mt-4 text-gray-300">
            <span className="font-semibold text-orange-400">
              Report Security Issues:
            </span>{" "}
            If you discover a security vulnerability, please report it
            responsibly through our{" "}
            <a
              href="https://discord.gg/hGugfm4n"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              Discord
            </a>{" "}
            or{" "}
            <a
              href="https://github.com/umutyerebakmaz/killreport"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </section>

        {/* Your Rights */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Your Rights & Data Control
          </h2>
          <p className="mb-4 text-gray-300">
            Depending on your location and applicable laws:
          </p>
          <ul className="ml-4 space-y-3 text-gray-300 list-disc list-inside">
            <li>
              <span className="font-semibold">Access:</span> You can view your
              stored data by logging into your account
            </li>
            <li>
              <span className="font-semibold">Deletion:</span> You can clear
              your browser storage, which will delete locally stored data
            </li>
            <li>
              <span className="font-semibold">Portability:</span> You can export
              your data via our API
            </li>
            <li>
              <span className="font-semibold">GDPR/Privacy Rights:</span>{" "}
              Contact us on Discord or GitHub to discuss your specific regional
              rights
            </li>
          </ul>
        </section>

        {/* Contact */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Questions About Your Privacy?
          </h2>
          <div className="space-y-4 text-gray-300">
            <p>
              If you have questions about our privacy practices or wish to
              exercise your privacy rights:
            </p>
            <ul className="ml-4 space-y-2">
              <li>
                <a
                  href="https://discord.gg/hGugfm4n"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  Contact us on Discord
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
            We are committed to maintaining your trust through transparent and
            responsible data practices.
          </p>
        </div>
      </div>
    </div>
  );
}
