import Link from "next/link";

/**
 * Renders a link to an alliance page with an optional ticker, falling back to
 * "#id" when the name hasn't been resolved yet and "Unknown" when there's no id.
 * Shared across the sovereignty dashboard and structures pages.
 */
export function AllianceLink({
  id,
  name,
  ticker,
}: {
  id?: number | null;
  name?: string | null;
  ticker?: string | null;
}) {
  if (!id) return <span className="text-gray-500">Unknown</span>;
  return (
    <span>
      <Link
        href={`/alliances/${id}`}
        prefetch={false}
        className="text-cyan-400 hover:text-cyan-300"
      >
        {name ?? `#${id}`}
      </Link>
      {ticker && <span className="ml-2 text-sm text-yellow-400">[{ticker}]</span>}
    </span>
  );
}
