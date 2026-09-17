/**
 * The colour scale for a character's security status.
 *
 * One table, two readings. The ranked rows draw the stripe down their left
 * edge; the character page and the entity cards draw the figure. A threshold
 * that moved in one and not the other would colour the same character two
 * ways on two screens, and keeping the bands in a single list is what makes
 * that impossible.
 *
 * The class strings are written out in full rather than built from a colour
 * name, because Tailwind finds classes by scanning the source for them and a
 * `border-l-${hue}-400` is not there to find.
 *
 * `border-l-*`, not `border-*`, and that is not a stylistic preference. A
 * ranked row sits in a `divide-y divide-white/5` list, and Tailwind emits that
 * divider as `:where(.divide-white\/5 > :not(:last-child)) { border-color }` —
 * inside :where(), so it carries no specificity whatever. A plain
 * `border-red-400` is (0,1,0), sets border-color on all four sides, and wins,
 * which repainted every row's bottom divider in the security colour. The
 * side-specific class touches border-left-color alone and leaves the divider
 * where it was.
 */
const BANDS = [
  { min: 5, text: 'text-blue-400', border: 'border-l-blue-400' },
  { min: 0, text: 'text-green-400', border: 'border-l-green-400' },
  { min: -2, text: 'text-yellow-400', border: 'border-l-yellow-400' },
  { min: -5, text: 'text-orange-400', border: 'border-l-orange-400' },
  { min: -Infinity, text: 'text-red-400', border: 'border-l-red-400' },
] as const;

/** A character whose security status never arrived is not a sixth band. */
const UNKNOWN = { text: 'text-gray-400', border: 'border-l-gray-400' } as const;

const bandFor = (status: number | null | undefined) =>
  status === null || status === undefined
    ? UNKNOWN
    : (BANDS.find((band) => status >= band.min) ?? UNKNOWN);

/** The ink for the figure itself. */
export const getSecurityStatusColor = (
  status: number | null | undefined,
): string => bandFor(status).text;

/** The stripe down the left edge of a row. Left edge only — see above. */
export const getSecurityStatusBorderColor = (
  status: number | null | undefined,
): string => bandFor(status).border;
