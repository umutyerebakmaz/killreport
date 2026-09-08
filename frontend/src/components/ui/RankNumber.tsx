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
  // justify-end: a column of numbers aligns on its units, so 1 and 10 end at
  // the same x and the avatars beside them all start at the same one.
  //
  // The width is 2ch, not w-10. tabular-nums makes every digit exactly 1ch, so
  // 2ch is the width of "10" in whatever font is loaded — no pixel guess to go
  // stale when the face changes. w-10 was 40px against content that is now
  // about 22px, and with the number flush right every one of those spare
  // pixels sat between the card's edge and the rank.
  //
  // Every list that uses this asks for ten rows, so two digits is the whole
  // range. A three-digit rank would spill into the gap-3 beside it rather
  // than push anything — worth knowing before a caller raises its limit.
  return (
    <div className="flex items-center w-[2ch] shrink-0 justify-end">
      <span className="text-lg font-semibold text-gray-500 tabular-nums">
        {rank}
      </span>
    </div>
  );
}
