import { CorporationCharactersQuery } from "@/generated/graphql";
import Link from "next/link";
import Loader from "../Loader";

// Extract the Character type from the GraphQL query result
export type Character = NonNullable<
  CorporationCharactersQuery["characters"]["items"][number]
>;

interface CharactersTableProps {
  characters: Character[];
  loading: boolean;
}

export default function CharactersTable({
  characters,
  loading,
}: CharactersTableProps) {
  if (loading) {
    return <Loader size="md" text="Loading characters..." className="py-12" />;
  }

  if (characters.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">No character found</div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden border border-white/10">
      <table className="table">
        <thead className="bg-white/5">
          <tr>
            <th className="th-cell">Name</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {characters.map((char) => (
            <tr key={char.id} className="transition-colors hover:bg-white/5">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://images.evetech.net/Character/${char.id}_64.png`}
                    alt={char.name}
                    width={48}
                    height={48}
                  />
                  <Link
                    href={`/characters/${char.id}`}
                    prefetch={false}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    {char.name}
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
