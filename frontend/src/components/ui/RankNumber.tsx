export interface RankNumberProps {
  /** 1-based position in the list. */
  rank: number;
}

/**
 * The list position shown to the left of an entry. Deliberately flat: no
 * medals for the top three and no per-rank colour, so the eye reads the list
 * as one ranked column rather than a podium plus an afterthought.
 */
export default function RankNumber({ rank }: RankNumberProps) {
  // w-10, not w-8: at text-lg a two-digit rank overflows 32px, and this
  // component does not cap the list — it renders whatever it is given.
  return (
    <div className="flex items-center justify-center w-10 shrink-0">
      <span className="text-lg font-semibold text-gray-500 tabular-nums">
        #{rank}
      </span>
    </div>
  );
}
