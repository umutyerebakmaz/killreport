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
  return (
    <div className="flex items-center justify-center w-8 shrink-0">
      <span className="text-xs font-semibold text-gray-500 tabular-nums">
        #{rank}
      </span>
    </div>
  );
}
