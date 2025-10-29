import Link from "next/link";

export default function Home() {
  return (
    <div className="relative overflow-hidden isolate">
      <div className="px-6 py-24 sm:py-32 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-white text-balance sm:text-5xl">
            Eve Online Kill Report
          </h2>
          <p className="max-w-xl mx-auto mt-6 text-gray-300 text-lg/8 text-pretty">
            Track alliances, corporations, and killmails from Eve Online
            universe. Built with GraphQL, DataLoader, and modern web
            technologies.
          </p>
          <div className="flex items-center justify-center mt-10 gap-x-6">
            <Link
              href="/alliances"
              className="rounded-md bg-white/15 px-3.5 py-2.5 text-sm font-semibold text-white inset-ring inset-ring-white/5 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Browse Alliances
            </Link>
            <Link
              href="/corporations"
              className="rounded-md bg-white/15 px-3.5 py-2.5 text-sm font-semibold text-white inset-ring inset-ring-white/5 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Browse Corporations
            </Link>
          </div>
        </div>
      </div>
      <svg
        viewBox="0 0 1024 1024"
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -z-10 size-256 -translate-x-1/2 mask-[radial-gradient(closest-side,white,transparent)]"
      >
        <circle
          r={512}
          cx={512}
          cy={512}
          fill="url(#8d958450-c69f-4251-94bc-4e091a323369)"
          fillOpacity="0.7"
        />
        <defs>
          <radialGradient id="8d958450-c69f-4251-94bc-4e091a323369">
            <stop stopColor="#7775D6" />
            <stop offset={1} stopColor="#E935C1" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}
